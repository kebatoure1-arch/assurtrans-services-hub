/**
 * Dépôts PostgreSQL du cycle de règlement.
 *
 * Trois index posés dès la première migration font le travail que le code ne peut pas faire :
 *
 *  - `payment_intents_idempotency` — une clé d'idempotence, une intention. Rejouer le job
 *    d'échéance cinq fois n'émet qu'un ordre.
 *  - `payment_intents_une_vivante_par_facture` — index unique PARTIEL, excluant `FAILED` et
 *    `CANCELLED`. Une facture ne porte qu'une intention vivante ; une intention annulée libère
 *    la place.
 *  - `invoices (contract_id, numero)` — une facture ne s'enregistre qu'une fois.
 *
 * Le code ne vérifie aucune de ces trois choses par une lecture préalable. Entre le `SELECT` et
 * l'`INSERT`, une autre transaction passerait, et le contrôle n'aurait servi qu'à se rassurer.
 * On écrit, et on lit ce que la base a accepté.
 */

import { type XOF, type XofDelta, xof } from '../../domain/money.ts';
import type {
  CanalReglement,
  PaymentIntent,
  PaymentIntentStatut,
} from '../../domain/payment-intent.ts';
import type {
  Invoice,
  InvoiceRepository,
  InvoiceStatut,
  PaymentIntentRepository,
} from '../../ports/settlement.ts';
import type { SqlExecutor } from './sql-executor.ts';

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

function texte(valeur: unknown, colonne: string): string {
  if (typeof valeur !== 'string') {
    throw new PersistenceError(`colonne ${colonne} : chaîne attendue`);
  }
  return valeur;
}

function texteOuNull(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null;
}

/** Une DATE de PostgreSQL revient en `Date` ; on la ramène au jour ISO, sans heure. */
function jour(valeur: unknown, colonne: string): string {
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  if (typeof valeur === 'string') return valeur.slice(0, 10);
  throw new PersistenceError(`colonne ${colonne} : date attendue`);
}

function factureDepuisLigne(l: Record<string, unknown>): Invoice {
  return {
    id: texte(l.id, 'id'),
    contractId: texte(l.contract_id, 'contract_id'),
    numero: texte(l.numero, 'numero'),
    periodeDebut: jour(l.periode_debut, 'periode_debut'),
    periodeFin: jour(l.periode_fin, 'periode_fin'),
    montant: montant(l.montant_xof, 'montant_xof'),
    dateEmission: jour(l.date_emission, 'date_emission'),
    dateEcheance: jour(l.date_echeance, 'date_echeance'),
    statut: texte(l.statut, 'statut') as InvoiceStatut,
  };
}

const COLONNES_FACTURE = `id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                          date_emission, date_echeance, statut`;

export class PgInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findById(id: string): Promise<Invoice | null> {
    const r = await this.db.query(`SELECT ${COLONNES_FACTURE} FROM invoices WHERE id = $1`, [id]);
    return r.rows.length === 0 ? null : factureDepuisLigne(r.rows[0]);
  }

  async saveIfNew(f: Invoice): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                             date_emission, date_echeance, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (contract_id, numero) DO NOTHING`,
      [
        f.id,
        f.contractId,
        f.numero,
        f.periodeDebut,
        f.periodeFin,
        f.montant,
        f.dateEmission,
        f.dateEcheance,
        f.statut,
      ],
    );
    return r.rowCount === 1;
  }

  async lister(contractId: string, limite: number): Promise<readonly Invoice[]> {
    const r = await this.db.query(
      `SELECT ${COLONNES_FACTURE} FROM invoices
        WHERE contract_id = $1
        ORDER BY date_echeance DESC, numero DESC
        LIMIT $2`,
      [contractId, limite],
    );
    return r.rows.map(factureDepuisLigne);
  }

  async changerStatut(id: string, statut: InvoiceStatut): Promise<boolean> {
    const r = await this.db.query('UPDATE invoices SET statut = $2 WHERE id = $1', [id, statut]);
    return r.rowCount === 1;
  }
}

function intentionDepuisLigne(l: Record<string, unknown>): PaymentIntent {
  const montantRegle = l.montant_regle_xof ?? null;
  const ecart = l.ecart_xof ?? null;

  return {
    id: texte(l.id, 'id'),
    invoiceId: texte(l.invoice_id, 'invoice_id'),
    montant: montant(l.montant_xof, 'montant_xof'),
    statut: texte(l.statut, 'statut') as PaymentIntentStatut,
    canal: texte(l.canal, 'canal') as CanalReglement,
    referenceImputation: texteOuNull(l.reference_imputation) ?? '',
    idempotencyKey: texteOuNull(l.idempotency_key),
    wavePayoutId: texteOuNull(l.wave_payout_id),
    preparePar: texte(l.prepare_par, 'prepare_par'),
    approuvePar: texteOuNull(l.approuve_par),
    executePar: texteOuNull(l.execute_par),
    motifReview: texteOuNull(l.motif_review),
    montantRegle: montantRegle === null ? null : montant(montantRegle, 'montant_regle_xof'),
    // L'écart est le seul montant du domaine qui peut être négatif : il est signé par
    // construction (`attendu - constaté`). Il ne passe donc pas par `xof`, qui refuse le négatif.
    ecartXof: ecart === null ? null : (Number(ecart) as XofDelta),
  };
}

const COLONNES_INTENTION = `id, invoice_id, montant_xof, statut, canal, reference_imputation,
                            idempotency_key, wave_payout_id, prepare_par, approuve_par,
                            execute_par, motif_review, montant_regle_xof, ecart_xof`;

export class PgPaymentIntentRepository implements PaymentIntentRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findById(id: string): Promise<PaymentIntent | null> {
    const r = await this.db.query(
      `SELECT ${COLONNES_INTENTION} FROM payment_intents WHERE id = $1`,
      [id],
    );
    return r.rows.length === 0 ? null : intentionDepuisLigne(r.rows[0]);
  }

  /**
   * `ON CONFLICT DO NOTHING` sans cible : les deux index — clé d'idempotence et intention
   * vivante unique par facture — doivent l'un comme l'autre faire échouer l'insertion sans
   * lever. Nommer une cible n'en couvrirait qu'un.
   */
  async saveIfNew(i: PaymentIntent): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO payment_intents (id, invoice_id, montant_xof, statut, canal,
                                    reference_imputation, idempotency_key, prepare_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        i.id,
        i.invoiceId,
        i.montant,
        i.statut,
        i.canal,
        i.referenceImputation,
        // Nul en préparation, et c'est voulu : la clé se tire à l'envoi, une par tentative.
        // PostgreSQL autorise plusieurs NULL dans un index unique, donc les brouillons
        // coexistent sans affaiblir la garantie « une clé, une intention » (migration 0008).
        i.idempotencyKey,
        i.preparePar,
      ],
    );
    return r.rowCount === 1;
  }

  /**
   * Écriture conditionnelle sur le statut.
   *
   * C'est la seule chose qui empêche deux administrateurs d'exécuter la même intention : le
   * second `UPDATE` ne trouve plus `statut = $attendu` et ne touche aucune ligne.
   */
  async saveIfStatut(i: PaymentIntent, statutAttendu: PaymentIntentStatut): Promise<boolean> {
    const r = await this.db.query(
      // Le statut est cast explicitement : `$2` sert a la fois de valeur ecrite dans une
      // colonne enum et de comparaison textuelle dans les CASE. Sans cast, PostgreSQL refuse
      // — « inconsistent types deduced for parameter » — parce qu'il ne peut pas deduire un
      // type unique pour les deux usages.
      `UPDATE payment_intents
          SET statut = $2::payment_intent_statut,
              idempotency_key = COALESCE($3, idempotency_key),
              wave_payout_id = $4,
              approuve_par = $5,
              execute_par = $6,
              motif_review = $7,
              montant_regle_xof = $8,
              ecart_xof = $9,
              ts_approved    = CASE WHEN $2::text = 'APPROVED'    THEN now() ELSE ts_approved END,
              ts_dispatching = CASE WHEN $2::text = 'DISPATCHING' THEN now() ELSE ts_dispatching END,
              ts_sent        = CASE WHEN $2::text = 'SENT'        THEN now() ELSE ts_sent END,
              ts_settled     = CASE WHEN $2::text IN ('SETTLED', 'VARIANCE') THEN now()
                                    ELSE ts_settled END
        WHERE id = $1 AND statut = $10::payment_intent_statut`,
      [
        i.id,
        i.statut,
        i.idempotencyKey,
        i.wavePayoutId,
        i.approuvePar,
        i.executePar,
        i.motifReview,
        i.montantRegle,
        i.ecartXof,
        statutAttendu,
      ],
    );
    return r.rowCount === 1;
  }

  async lister(contractId: string, limite: number): Promise<readonly PaymentIntent[]> {
    const r = await this.db.query(
      `SELECT ${COLONNES_INTENTION.split(',')
        .map((c) => `p.${c.trim()}`)
        .join(', ')}
         FROM payment_intents p
         JOIN invoices i ON i.id = p.invoice_id
        WHERE i.contract_id = $1
        ORDER BY p.ts_created DESC
        LIMIT $2`,
      [contractId, limite],
    );
    return r.rows.map(intentionDepuisLigne);
  }

  /**
   * Cumul engagé sur la journée civile.
   *
   * « Engagé » = tout ce qui est parti ou en train de partir, y compris `NEEDS_REVIEW` : une
   * intention en revue a peut-être donné lieu à un versement, et tant qu'on l'ignore elle doit
   * peser sur le plafond. L'oublier permettrait de dépasser le plafond en enchaînant les
   * ambiguïtés.
   */
  /**
   * Intentions abandonnees en plein envoi.
   *
   * `ts_dispatching < $1` est la borne d'age : une intention passee en DISPATCHING il y a dix
   * secondes appartient peut-etre encore a un appel en vol. On prend les plus anciennes
   * d'abord — ce sont celles dont l'incertitude dure depuis le plus longtemps.
   */
  async listerInterrompues(avant: string, limite: number): Promise<readonly PaymentIntent[]> {
    const r = await this.db.query(
      `SELECT ${COLONNES_INTENTION}
         FROM payment_intents
        WHERE statut = 'DISPATCHING'
          AND ts_dispatching IS NOT NULL
          AND ts_dispatching < $1
        ORDER BY ts_dispatching ASC
        LIMIT $2`,
      [avant, limite],
    );
    return r.rows.map(intentionDepuisLigne);
  }

  async cumulDuJour(
    contractId: string,
    jourIso: string,
    saufIntentId: string | null,
  ): Promise<XOF> {
    const r = await this.db.query(
      `SELECT COALESCE(SUM(p.montant_xof), 0) AS total
         FROM payment_intents p
         JOIN invoices i ON i.id = p.invoice_id
        WHERE i.contract_id = $1
          AND ($3::uuid IS NULL OR p.id <> $3::uuid)
          AND p.statut IN ('DISPATCHING', 'SENT', 'SETTLED', 'RECONCILED', 'VARIANCE',
                           'NEEDS_REVIEW')
          AND p.ts_dispatching >= $2::date
          AND p.ts_dispatching <  ($2::date + interval '1 day')`,
      [contractId, jourIso, saufIntentId],
    );
    return montant(r.rows[0]?.total ?? 0, 'total');
  }
}
