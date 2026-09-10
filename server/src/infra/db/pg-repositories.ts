/**
 * Implémentations Postgres des ports de persistance.
 *
 * Deux points méritent l'attention plus que le reste :
 *
 *  1. **Les BIGINT arrivent en chaîne.** node-postgres ne convertit pas les `bigint` en `number`,
 *     parce qu'ils peuvent dépasser l'entier sûr. Toute lecture de montant passe donc par
 *     `montantDepuisSql`, qui refuse une décimale plutôt que de l'arrondir en silence.
 *  2. **Les écritures conditionnelles sont la garantie d'atomicité**, pas une commodité. Un
 *     `SELECT` suivi d'un `UPDATE` laisserait passer deux pompistes ; `UPDATE ... WHERE
 *     statut = $attendu` n'en laisse passer qu'un, et `rowCount` dit lequel.
 */

import { type XOF, xof } from '../../domain/money.ts';
import type { FuelVoucher, VoucherStatut } from '../../domain/fuel-voucher.ts';
import type { EventMeta, ProcessedEventStore } from '../webhooks/webhook.ts';
import type {
  CheckoutSession,
  CheckoutSessionRepository,
  DeliveryRequest,
  Driver,
  DriverPayment,
  DriverPaymentRepository,
  DriverRepository,
  EnvoiAFaire,
  VoucherDeliveryQueue,
  VoucherRepository,
} from '../../ports/repositories.ts';
import type { SqlExecutor } from './sql-executor.ts';

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
  }
}

/** Convertit un BIGINT lu en base. Refuse tout ce qui n'est pas un entier de francs. */
function montantDepuisSql(valeur: unknown, colonne: string): XOF {
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

function instant(valeur: unknown, colonne: string): string {
  if (valeur instanceof Date) return valeur.toISOString();
  if (typeof valeur === 'string') return new Date(valeur).toISOString();
  throw new PersistenceError(`colonne ${colonne} : horodatage attendu`);
}

function instantOuNull(valeur: unknown): string | null {
  if (valeur instanceof Date) return valeur.toISOString();
  if (typeof valeur === 'string') return new Date(valeur).toISOString();
  return null;
}

// ---------------------------------------------------------------- bons

function versBon(ligne: Record<string, unknown>): FuelVoucher {
  return {
    id: texte(ligne.id, 'fuel_vouchers.id'),
    driverId: texte(ligne.driver_id, 'fuel_vouchers.driver_id'),
    montant: montantDepuisSql(ligne.montant_xof, 'fuel_vouchers.montant_xof'),
    statut: texte(ligne.statut, 'fuel_vouchers.statut') as VoucherStatut,
    emisA: instant(ligne.emis_a, 'fuel_vouchers.emis_a'),
    expireA: instant(ligne.expire_a, 'fuel_vouchers.expire_a'),
    paymentRef: texte(ligne.payment_ref, 'fuel_vouchers.payment_ref'),
    consommeA: instantOuNull(ligne.consomme_a),
    stationId: texteOuNull(ligne.station_id),
    operateurId: texteOuNull(ligne.operateur_id),
    redemptionId: texteOuNull(ligne.redemption_id),
    motifAnnulation: texteOuNull(ligne.motif_annulation),
  };
}

const COLONNES_BON = `id, driver_id, montant_xof, statut, emis_a, expire_a, payment_ref,
                      consomme_a, station_id, operateur_id, redemption_id, motif_annulation`;

export class PgVoucherRepository implements VoucherRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findById(id: string): Promise<FuelVoucher | null> {
    const r = await this.db.query(`SELECT ${COLONNES_BON} FROM fuel_vouchers WHERE id = $1`, [id]);
    return r.rows.length === 0 ? null : versBon(r.rows[0]);
  }

  async findByPaymentId(paymentId: string): Promise<FuelVoucher | null> {
    const r = await this.db.query(
      `SELECT ${COLONNES_BON} FROM fuel_vouchers WHERE payment_id = $1`,
      [paymentId],
    );
    return r.rows.length === 0 ? null : versBon(r.rows[0]);
  }

  /** `ON CONFLICT DO NOTHING` sur `payment_id` : un paiement ne finance qu'un bon. */
  async saveIfNew(bon: FuelVoucher, paymentId: string): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO fuel_vouchers
         (id, driver_id, payment_id, montant_xof, statut, emis_a, expire_a, payment_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (payment_id) DO NOTHING`,
      [
        bon.id,
        bon.driverId,
        paymentId,
        String(bon.montant),
        bon.statut,
        bon.emisA,
        bon.expireA,
        bon.paymentRef,
      ],
    );
    return r.rowCount > 0;
  }

  async listerParChauffeur(driverId: string, limite: number): Promise<readonly FuelVoucher[]> {
    const r = await this.db.query(
      `SELECT ${COLONNES_BON} FROM fuel_vouchers
        WHERE driver_id = $1 ORDER BY emis_a DESC LIMIT $2`,
      [driverId, limite],
    );
    return r.rows.map(versBon);
  }

  /**
   * Écriture conditionnelle. Zéro ligne affectée signifie que le statut a changé entre la
   * lecture et l'écriture — un autre pompiste, une annulation, une expiration balayée.
   */
  async saveIfStatut(bon: FuelVoucher, statutAttendu: VoucherStatut): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE fuel_vouchers
          SET statut = $3,
              consomme_a = $4,
              station_id = $5,
              operateur_id = $6,
              redemption_id = $7,
              motif_annulation = $8
        WHERE id = $1 AND statut = $2`,
      [
        bon.id,
        statutAttendu,
        bon.statut,
        bon.consommeA,
        bon.stationId,
        bon.operateurId,
        bon.redemptionId,
        bon.motifAnnulation,
      ],
    );
    return r.rowCount > 0;
  }
}

// ---------------------------------------------------------------- paiements

export class PgDriverPaymentRepository implements DriverPaymentRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findByReference(canal: string, reference: string): Promise<DriverPayment | null> {
    const r = await this.db.query(
      `SELECT id, driver_id, montant_xof, canal, reference, recu_a
         FROM driver_payments WHERE canal = $1 AND reference = $2`,
      [canal, reference],
    );
    if (r.rows.length === 0) return null;
    const l = r.rows[0];
    return {
      id: texte(l.id, 'driver_payments.id'),
      driverId: texte(l.driver_id, 'driver_payments.driver_id'),
      montant: montantDepuisSql(l.montant_xof, 'driver_payments.montant_xof'),
      canal: texte(l.canal, 'driver_payments.canal'),
      reference: texte(l.reference, 'driver_payments.reference'),
      recuA: instant(l.recu_a, 'driver_payments.recu_a'),
    };
  }

  async saveIfNew(paiement: DriverPayment): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO driver_payments (id, driver_id, montant_xof, canal, reference, recu_a)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (canal, reference) DO NOTHING`,
      [
        paiement.id,
        paiement.driverId,
        String(paiement.montant),
        paiement.canal,
        paiement.reference,
        paiement.recuA,
      ],
    );
    return r.rowCount > 0;
  }
}

// ---------------------------------------------------------------- sessions

export class PgCheckoutSessionRepository implements CheckoutSessionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findByReference(reference: string): Promise<CheckoutSession | null> {
    const r = await this.db.query(
      `SELECT reference, driver_id, montant_xof, canal, session_id
         FROM checkout_sessions WHERE reference = $1`,
      [reference],
    );
    if (r.rows.length === 0) return null;
    const l = r.rows[0];
    return {
      reference: texte(l.reference, 'checkout_sessions.reference'),
      driverId: texte(l.driver_id, 'checkout_sessions.driver_id'),
      montant: montantDepuisSql(l.montant_xof, 'checkout_sessions.montant_xof'),
      canal: texte(l.canal, 'checkout_sessions.canal'),
      sessionId: texteOuNull(l.session_id),
    };
  }

  async save(session: CheckoutSession): Promise<void> {
    await this.db.query(
      `INSERT INTO checkout_sessions (reference, driver_id, montant_xof, canal, session_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.reference,
        session.driverId,
        String(session.montant),
        session.canal,
        session.sessionId,
      ],
    );
  }

  async attacherSessionId(reference: string, sessionId: string): Promise<void> {
    await this.db.query(`UPDATE checkout_sessions SET session_id = $2 WHERE reference = $1`, [
      reference,
      sessionId,
    ]);
  }
}

// ---------------------------------------------------------------- chauffeurs

export class PgDriverRepository implements DriverRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findById(id: string): Promise<Driver | null> {
    const r = await this.db.query(
      `SELECT id, nom, msisdn, statut FROM drivers WHERE id = $1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    const l = r.rows[0];
    return {
      id: texte(l.id, 'drivers.id'),
      nom: texte(l.nom, 'drivers.nom'),
      msisdn: texte(l.msisdn, 'drivers.msisdn'),
      statut: texte(l.statut, 'drivers.statut') as Driver['statut'],
    };
  }
}

// ---------------------------------------------------------------- file d'envoi

export class PgVoucherDeliveryQueue implements VoucherDeliveryQueue {
  constructor(private readonly db: SqlExecutor) {}

  /**
   * Le jeton signé n'est **pas** enregistré ici : il vaut du carburant, et une table de
   * journalisation d'envois n'est pas l'endroit où le conserver. Le worker d'envoi le
   * reconstruit à partir du bon au moment d'expédier.
   */
  async enqueue(demande: DeliveryRequest): Promise<string> {
    const r = await this.db.query(
      `INSERT INTO voucher_deliveries (voucher_id, canal, destinataire, statut)
       VALUES ($1, 'WHATSAPP', $2, 'EN_ATTENTE')
       RETURNING id`,
      [demande.voucherId, demande.destinataire],
    );
    if (r.rows.length === 0) {
      throw new PersistenceError(`mise en file impossible pour le bon ${demande.voucherId}`);
    }
    return texte(r.rows[0].id, 'voucher_deliveries.id');
  }

  /**
   * Reclame des envois, atomiquement.
   *
   * `FOR UPDATE SKIP LOCKED` est ce qui rend deux workers sans danger : chacun verrouille les
   * lignes qu'il prend, et l'autre passe a cote au lieu d'attendre. Un `SELECT` suivi d'un
   * `UPDATE` les laisserait tous deux expedier le meme bon.
   *
   * La ligne passe en `ENVOI_EN_COURS` et son compteur avance **des la reclamation**, pas
   * apres. Si le worker meurt en plein envoi, la tentative est comptee : sans cela une
   * passerelle qui fait crasher le processus serait reessayee sans fin.
   */
  async reclamer(limite: number, maxTentatives: number): Promise<readonly EnvoiAFaire[]> {
    const r = await this.db.query(
      `UPDATE voucher_deliveries d
          SET statut = 'ENVOI_EN_COURS',
              tentatives = d.tentatives + 1,
              updated_at = now()
        WHERE d.id IN (
                SELECT id FROM voucher_deliveries
                 WHERE statut = 'EN_ATTENTE'
                   AND tentatives < $2
                 ORDER BY created_at ASC
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED)
        RETURNING d.id, d.voucher_id, d.destinataire, d.tentatives`,
      [limite, maxTentatives],
    );

    return r.rows.map((l) => ({
      id: texte(l.id, 'voucher_deliveries.id'),
      voucherId: texte(l.voucher_id, 'voucher_deliveries.voucher_id'),
      destinataire: texte(l.destinataire, 'voucher_deliveries.destinataire'),
      tentatives: Number(l.tentatives),
    }));
  }

  async marquerEnvoye(id: string, reference: string | null): Promise<void> {
    await this.db.query(
      `UPDATE voucher_deliveries
          SET statut = 'ENVOYE', provider_ref = $2, erreur = NULL, updated_at = now()
        WHERE id = $1`,
      [id, reference],
    );
  }

  /**
   * Echec d'un envoi.
   *
   * La ligne retourne en attente tant qu'il reste des tentatives, et n'est close en `ECHEC`
   * qu'une fois le plafond atteint. C'est cette bascule qui la fait apparaitre dans les
   * incidents du tableau de bord : un chauffeur qui a paye sans rien recevoir doit se voir.
   */
  async marquerEchec(id: string, motif: string, maxTentatives: number): Promise<void> {
    await this.db.query(
      `UPDATE voucher_deliveries
          SET statut = CASE WHEN tentatives >= $3 THEN 'ECHEC' ELSE 'EN_ATTENTE' END,
              erreur = $2,
              updated_at = now()
        WHERE id = $1`,
      [id, motif.slice(0, 500), maxTentatives],
    );
  }
}

// ---------------------------------------------------------------- webhooks

export class PgProcessedEventStore implements ProcessedEventStore {
  constructor(private readonly db: SqlExecutor) {}

  /**
   * L'insertion est l'opération atomique : deux livraisons concurrentes du même événement,
   * une seule insère.
   */
  async markIfNew(eventId: string, meta: EventMeta): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO webhook_events (event_id, event_type, payload_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, meta.eventType, meta.payloadHash],
    );
    return r.rowCount > 0;
  }

  async forget(eventId: string): Promise<void> {
    await this.db.query(`DELETE FROM webhook_events WHERE event_id = $1`, [eventId]);
  }
}
