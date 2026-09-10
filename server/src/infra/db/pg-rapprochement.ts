/**
 * Dépôts PostgreSQL du rapprochement.
 *
 * Le point délicat est le remplacement d'une période. Rejouer un rapprochement doit donner le
 * même état, donc effacer les lignes précédentes — sauf celles qu'un humain a tranchées. La
 * suppression porte donc une condition : `WHERE resolu_at IS NULL`. Sans elle, recalculer
 * effacerait le travail d'enquête de quelqu'un, ce qui est pire que de ne pas recalculer.
 *
 * Les deux opérations tiennent dans une transaction : entre l'effacement et l'insertion, une
 * lecture verrait une période vide et conclurait à tort que tout va bien.
 */

import { type XOF, type XofDelta, xof } from '../../domain/money.ts';
import type {
  ReconciliationStatut,
  ReconInvoice,
  ReconIntent,
  ReconLine,
  ReconWaveTx,
} from '../../domain/reconciliation.ts';
import type { PaymentIntentStatut } from '../../domain/payment-intent.ts';
import type {
  LigneRangee,
  MouvementReleve,
  RapprochementRepository,
  ReleveRepository,
  SourcesDuRapprochement,
} from '../../ports/rapprochement.ts';
import type { SqlExecutor, TransactionRunner } from './sql-executor.ts';

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
  }
}

/** Les BIGINT arrivent en chaîne. Une décimale est refusée, jamais arrondie. */
function montant(valeur: unknown, colonne: string): XOF {
  if (typeof valeur === 'number') return xof(valeur);
  if (typeof valeur === 'bigint') return xof(Number(valeur));
  if (typeof valeur !== 'string' || !/^-?\d+$/.test(valeur)) {
    throw new PersistenceError(
      `colonne ${colonne} : entier de francs CFA attendu, reçu « ${String(valeur)} »`,
    );
  }
  return xof(Number(valeur));
}

function texte(v: unknown): string {
  return typeof v === 'string' ? v : String(v);
}

function texteOuNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function jour(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return texte(v).slice(0, 10);
}

function instant(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
}

// ---------------------------------------------------------------- relevé

export class PgReleveRepository implements ReleveRepository {
  constructor(private readonly db: SqlExecutor) {}

  /**
   * `wave_tx_id` est unique en base : saisir deux fois la même ligne de relevé ne la double
   * pas. C'est important pour une saisie manuelle, où la double frappe est la règle.
   */
  async ajouterSiNouveau(m: MouvementReleve): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO wave_transactions (id, wave_tx_id, date_tx, sens, montant_xof, contrepartie,
                                      raw_json)
       VALUES ($1, $2, $3, $4, $5, $6, '{"source":"saisie manuelle"}'::jsonb)
       ON CONFLICT (wave_tx_id) DO NOTHING`,
      [m.id, m.waveTxId, m.dateTx, m.sens, m.montant, m.contrepartie],
    );
    return r.rowCount === 1;
  }

  async listerSurPeriode(debut: string, fin: string): Promise<readonly MouvementReleve[]> {
    const r = await this.db.query(
      `SELECT id, wave_tx_id, date_tx, sens, montant_xof, contrepartie
         FROM wave_transactions
        WHERE date_tx >= $1::date AND date_tx < ($2::date + interval '1 day')
        ORDER BY date_tx ASC`,
      [debut, fin],
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      waveTxId: texte(l.wave_tx_id),
      dateTx: instant(l.date_tx) ?? '',
      sens: texte(l.sens) as 'IN' | 'OUT',
      montant: montant(l.montant_xof, 'montant_xof'),
      contrepartie: texteOuNull(l.contrepartie),
    }));
  }

  /** Une ligne saisie par erreur se retire, tant qu'aucun rapprochement ne s'y adosse. */
  async supprimer(id: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM wave_transactions
        WHERE id = $1
          AND NOT EXISTS (SELECT 1 FROM reconciliations WHERE wave_transaction_id = $1)`,
      [id],
    );
    return r.rowCount === 1;
  }
}

// ---------------------------------------------------------------- les trois voies

export class PgSourcesDuRapprochement implements SourcesDuRapprochement {
  constructor(private readonly db: SqlExecutor) {}

  /**
   * Les factures que cette période doit expliquer.
   *
   * Deux ensembles, et il faut les deux :
   *
   *  - celles **échues** à la date d'arrêté, réglées ou non. On ne filtre pas sur le statut :
   *    une facture marquée réglée dont aucun mouvement ne correspond au relevé est exactement
   *    l'anomalie qu'un rapprochement doit trouver.
   *  - celles **réglées par anticipation**, dont le versement figure au relevé de la période
   *    alors que l'échéance tombe plus tard. Les omettre laissait leur mouvement sans
   *    contrepartie, et un règlement parfaitement légitime ressortait en « sortie de fonds sans
   *    intention » — trouvé en rapprochant pour de bon.
   *
   * On ne prend pas simplement toutes les factures du contrat : celles à venir, sans versement,
   * apparaîtraient comme jamais ordonnancées, ce qui serait faux dans l'autre sens.
   */
  async facturesEchuesAu(contractId: string, fin: string): Promise<readonly ReconInvoice[]> {
    const debut = `${fin.slice(0, 7)}-01`;
    const r = await this.db.query(
      `SELECT DISTINCT i.id, i.numero, i.montant_xof, i.date_echeance
         FROM invoices i
         LEFT JOIN payment_intents p ON p.invoice_id = i.id
        WHERE i.contract_id = $1
          AND (i.date_echeance <= $2::date
               OR (p.wave_payout_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM wave_transactions w
                                WHERE w.wave_tx_id = p.wave_payout_id
                                  AND w.date_tx >= $3::date
                                  AND w.date_tx < ($2::date + interval '1 day'))))
        ORDER BY i.date_echeance ASC`,
      [contractId, fin, debut],
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      numero: texte(l.numero),
      montantXof: montant(l.montant_xof, 'montant_xof'),
      dateEcheance: jour(l.date_echeance),
    }));
  }

  async intentionsDesFactures(ids: readonly string[]): Promise<readonly ReconIntent[]> {
    if (ids.length === 0) return [];
    const r = await this.db.query(
      `SELECT id, invoice_id, montant_xof, statut, wave_payout_id
         FROM payment_intents
        WHERE invoice_id = ANY($1::uuid[])`,
      [ids],
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      invoiceId: texte(l.invoice_id),
      montantXof: montant(l.montant_xof, 'montant_xof'),
      statut: texte(l.statut) as PaymentIntentStatut,
      wavePayoutId: texteOuNull(l.wave_payout_id),
    }));
  }

  async releve(debut: string, fin: string): Promise<readonly ReconWaveTx[]> {
    const r = await this.db.query(
      `SELECT id, wave_tx_id, sens, montant_xof, contrepartie
         FROM wave_transactions
        WHERE date_tx >= $1::date AND date_tx < ($2::date + interval '1 day')
        ORDER BY date_tx ASC`,
      [debut, fin],
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      waveTxId: texte(l.wave_tx_id),
      sens: texte(l.sens) as 'IN' | 'OUT',
      montantXof: montant(l.montant_xof, 'montant_xof'),
      contrepartie: texteOuNull(l.contrepartie),
    }));
  }
}

// ---------------------------------------------------------------- rangement

export class PgRapprochementRepository implements RapprochementRepository {
  /**
   * Deux dépendances, et ce n'est pas une commodité.
   *
   * `db` sert aux lectures. `transactions` sert au remplacement, qui doit épingler UNE
   * connexion : `BEGIN` et `COMMIT` envoyés sur un pool partent sur des connexions
   * différentes, la transaction ouverte n'est jamais close, et la connexion reste « idle in
   * transaction » jusqu'à épuisement du pool. Le symptôme n'est pas une erreur mais une
   * requête qui ne répond plus — trouvé en soldant un rapprochement pour de bon.
   */
  constructor(
    private readonly db: SqlExecutor,
    private readonly transactions: TransactionRunner,
  ) {}

  /**
   * Remplace le rapprochement d'une période, en épargnant les lignes résolues.
   *
   * Le tout dans une transaction : entre l'effacement et l'insertion, une lecture verrait une
   * période vide et conclurait à tort que rien ne bloque.
   */
  async remplacerPourPeriode(periode: string, lignes: readonly ReconLine[]): Promise<void> {
    await this.transactions.inTransaction(async (tx) => {
      await tx.query(
        `DELETE FROM reconciliations WHERE periode = $1::date AND resolu_at IS NULL`,
        [periode],
      );

      for (const l of lignes) {
        // Un constat déjà tranché ne se repose pas. Sans cette condition, recalculer recréait
        // une ligne ouverte à côté de celle qu'un humain venait de résoudre : on lui
        // redemandait de trancher ce qu'il avait tranché, et la résolution devenait
        // décorative. L'identité d'un constat, c'est le triplet qu'il désigne.
        await tx.query(
          `INSERT INTO reconciliations (periode, invoice_id, payment_intent_id,
                                        wave_transaction_id, ecart_xof, statut, tolerance_xof,
                                        note)
           SELECT $1::date, $2, $3, $4, $5, $6::reconciliation_statut, $7, $8
            WHERE NOT EXISTS (
                    SELECT 1 FROM reconciliations
                     WHERE periode = $1::date
                       AND resolu_at IS NOT NULL
                       AND invoice_id IS NOT DISTINCT FROM $2
                       AND payment_intent_id IS NOT DISTINCT FROM $3
                       AND wave_transaction_id IS NOT DISTINCT FROM $4)`,
          [
            periode,
            l.invoiceId,
            l.paymentIntentId,
            l.waveTransactionId,
            l.ecartXof,
            l.statut,
            l.toleranceXof,
            l.motif,
          ],
        );
      }
    });
  }

  async listerPourPeriode(periode: string): Promise<readonly LigneRangee[]> {
    const r = await this.db.query(
      `SELECT id, periode, invoice_id, payment_intent_id, wave_transaction_id, ecart_xof,
              statut, tolerance_xof, note, resolu_par, resolu_at
         FROM reconciliations
        WHERE periode = $1::date
        ORDER BY CASE statut WHEN 'ORPHAN' THEN 0 WHEN 'VARIANCE' THEN 1 ELSE 2 END,
                 created_at ASC`,
      [periode],
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      periode: jour(l.periode),
      statut: texte(l.statut) as ReconciliationStatut,
      invoiceId: texteOuNull(l.invoice_id),
      paymentIntentId: texteOuNull(l.payment_intent_id),
      waveTransactionId: texteOuNull(l.wave_transaction_id),
      ecartXof: Number(l.ecart_xof) as XofDelta,
      toleranceXof: montant(l.tolerance_xof, 'tolerance_xof'),
      motif: texteOuNull(l.note) ?? '',
      note: texteOuNull(l.note),
      resoluPar: texteOuNull(l.resolu_par),
      resoluA: instant(l.resolu_at),
    }));
  }

  /**
   * Écriture conditionnelle : `resolu_at IS NULL`.
   *
   * Deux personnes qui tranchent le même écart au même instant, ce sont deux notes dont une
   * seule sera lue. La seconde apprend qu'elle est arrivée après.
   */
  async resoudre(id: string, acteur: string, note: string): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE reconciliations
          SET resolu_par = $2, resolu_at = now(), note = $3
        WHERE id = $1 AND resolu_at IS NULL`,
      [id, acteur, note],
    );
    return r.rowCount === 1;
  }

  /**
   * Reste-t-il un mouvement de fonds inexpliqué ?
   *
   * §11 bloque le cycle suivant sur un écart ou un orphelin non résolu — mais seulement sur
   * ceux qui concernent de l'argent parti ou peut-être parti. Une ligne qui dit « cette facture
   * échue n'a jamais été ordonnancée » ne porte aucun mouvement : c'est une tâche à faire, pas
   * une inconnue.
   *
   * Les compter bloquerait l'ordonnancement de la facture par le fait même qu'elle n'est pas
   * ordonnancée. Le système se serait verrouillé sur lui-même — trouvé en soldant un
   * rapprochement puis en essayant de préparer le règlement suivant.
   */
  async resteDesLignesBloquantes(): Promise<boolean> {
    const r = await this.db.query(
      `SELECT EXISTS (
                SELECT 1 FROM reconciliations
                 WHERE statut <> 'MATCHED'
                   AND resolu_at IS NULL
                   AND (wave_transaction_id IS NOT NULL
                        OR payment_intent_id IS NOT NULL)) AS bloque`,
    );
    return r.rows[0]?.bloque === true;
  }
}
