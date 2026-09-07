/**
 * Tests d'intégration sur une vraie base PostgreSQL.
 *
 * Ce que les tests unitaires ne peuvent pas prouver : que les contraintes écrites dans les
 * migrations font réellement ce qu'on croit. Un `ON CONFLICT` sur une colonne sans index unique
 * ne protège rien, et un `UPDATE ... WHERE statut` ne sérialise que si la base le sérialise.
 *
 * Démarrage :
 *   npm run db:up && npm run migrate -- <url> && npm run test:integration
 *
 * Sans `DATABASE_URL_TEST`, la suite est ignorée plutôt qu'en échec : un poste sans Docker ne
 * doit pas voir rouge pour cette raison.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { xof } from '../../src/domain/money.ts';
import { emitVoucher, redeemVoucher } from '../../src/domain/fuel-voucher.ts';
import type { SqlExecutor } from '../../src/infra/db/sql-executor.ts';
import {
  PgCheckoutSessionRepository,
  PgDriverPaymentRepository,
  PgDriverRepository,
  PgProcessedEventStore,
  PgVoucherDeliveryQueue,
  PgVoucherRepository,
} from '../../src/infra/db/pg-repositories.ts';
import { PgAccessTokenVerifier, empreinte, genererJeton } from '../../src/infra/auth/api-tokens.ts';

const URL_TEST = process.env.DATABASE_URL_TEST;
const decrire = URL_TEST ? describe : describe.skip;

let pool: pg.Pool;
let db: SqlExecutor;

let entityId: string;
let driverId: string;
let stationId: string;

function uuid(): string {
  return crypto.randomUUID();
}

decrire('intégration PostgreSQL', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_TEST });
    db = {
      query: async (texte, params = []) => {
        const r = await pool.query(texte, params as unknown[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
    };
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    // Table rase entre chaque test : l'ordre d'exécution ne doit rien changer au résultat.
    await pool.query(`
      TRUNCATE voucher_deliveries, fuel_vouchers, checkout_sessions, driver_payments,
               card_transactions, api_tokens, cards, drivers, stations,
               reconciliations, webhook_events, payment_intents, invoices,
               te_contracts, wave_transactions, entities
      RESTART IDENTITY CASCADE
    `);

    entityId = uuid();
    driverId = uuid();
    stationId = uuid();

    await pool.query(`INSERT INTO entities (id, raison_sociale) VALUES ($1, 'Assur''Trans')`, [
      entityId,
    ]);
    await pool.query(
      `INSERT INTO drivers (id, entity_id, nom, msisdn) VALUES ($1, $2, 'Moussa Ndiaye', '+221770000001')`,
      [driverId, entityId],
    );
    await pool.query(`INSERT INTO stations (id, code, nom) VALUES ($1, 'ST-3', 'Dakar 3')`, [
      stationId,
    ]);
  });

  // ------------------------------------------------------------------ montants

  describe('montants', () => {
    it('un montant lu revient en entier, pas en chaîne ni en flottant', async () => {
      const paiement = await creerPaiement(20_000);
      const bon = emitVoucher({
        id: uuid(),
        driverId,
        montant: xof(20_000),
        emisA: '2026-09-06T10:00:00.000Z',
        validiteHeures: 24,
        paymentRef: 'WAVE_CHECKOUT/cos-1',
      });
      await new PgVoucherRepository(db).saveIfNew(bon, paiement);

      const relu = await new PgVoucherRepository(db).findById(bon.id);
      expect(relu?.montant).toBe(20_000);
      expect(Number.isInteger(relu?.montant)).toBe(true);
    });

    it('la base refuse un montant nul ou négatif', async () => {
      await expect(
        pool.query(
          `INSERT INTO driver_payments (id, driver_id, montant_xof, canal, reference, recu_a)
           VALUES ($1, $2, 0, 'WAVE_CHECKOUT', 'x', now())`,
          [uuid(), driverId],
        ),
      ).rejects.toThrow(/montant_positif/);
    });

    it('la base refuse un PAN complet dans une carte', async () => {
      await pool.query(
        `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                   delai_reglement_jours)
         VALUES ($1, $2, 'TE-1', 10000000, 30)`,
        [uuid(), entityId],
      );
      const contrat = (await pool.query('SELECT id FROM te_contracts LIMIT 1')).rows[0].id;

      await expect(
        pool.query(`INSERT INTO cards (id, contract_id, pan_masque) VALUES ($1, $2, $3)`, [
          uuid(),
          contrat,
          '4111111111111111',
        ]),
      ).rejects.toThrow(/pan_masque_only/);
    });
  });

  // ------------------------------------------------------- un paiement, un bon

  describe('un paiement finance exactement un bon', () => {
    it('la seconde émission sur le même paiement est refusée par la base', async () => {
      const paiement = await creerPaiement(20_000);
      const repo = new PgVoucherRepository(db);

      const premier = await repo.saveIfNew(bonPour(paiement), paiement);
      const second = await repo.saveIfNew(bonPour(paiement), paiement);

      expect(premier).toBe(true);
      expect(second).toBe(false);
      expect((await pool.query('SELECT count(*) FROM fuel_vouchers')).rows[0].count).toBe('1');
    });

    it('deux émissions concurrentes sur le même paiement : une seule aboutit', async () => {
      const paiement = await creerPaiement(20_000);
      const repo = new PgVoucherRepository(db);

      const resultats = await Promise.all([
        repo.saveIfNew(bonPour(paiement), paiement),
        repo.saveIfNew(bonPour(paiement), paiement),
        repo.saveIfNew(bonPour(paiement), paiement),
      ]);

      expect(resultats.filter(Boolean)).toHaveLength(1);
    });

    it('un paiement rejoué sur le même couple (canal, référence) est refusé', async () => {
      const repo = new PgDriverPaymentRepository(db);
      const ligne = {
        id: uuid(),
        driverId,
        montant: xof(20_000),
        canal: 'WAVE_CHECKOUT',
        reference: 'cos-1',
        recuA: '2026-09-06T10:00:00.000Z',
      };

      expect(await repo.saveIfNew(ligne)).toBe(true);
      expect(await repo.saveIfNew({ ...ligne, id: uuid() })).toBe(false);
    });
  });

  // ------------------------------------------------------- consommation unique

  describe('consommation d’un bon', () => {
    it('deux pompistes concurrents : un seul sert', async () => {
      const paiement = await creerPaiement(20_000);
      const repo = new PgVoucherRepository(db);
      const bon = bonPour(paiement);
      await repo.saveIfNew(bon, paiement);

      const scan = (redemptionId: string, operateur: string) =>
        repo.saveIfStatut(
          redeemVoucher(bon, {
            redemptionId,
            stationId,
            operateurId: operateur,
            asOf: '2026-09-06T14:00:00.000Z',
          }).next,
          'EMIS',
        );

      const resultats = await Promise.all([scan('scan-a', 'p-1'), scan('scan-b', 'p-2')]);

      expect(resultats.filter(Boolean)).toHaveLength(1);
      const relu = await repo.findById(bon.id);
      expect(relu?.statut).toBe('CONSOMME');
    });

    it('la base refuse un bon consommé sans trace de qui l’a servi', async () => {
      const paiement = await creerPaiement(20_000);
      const bon = bonPour(paiement);
      await new PgVoucherRepository(db).saveIfNew(bon, paiement);

      await expect(
        pool.query(`UPDATE fuel_vouchers SET statut = 'CONSOMME' WHERE id = $1`, [bon.id]),
      ).rejects.toThrow(/consomme_trace/);
    });

    it('un même identifiant de scan ne peut pas consommer deux bons différents', async () => {
      const repo = new PgVoucherRepository(db);
      const p1 = await creerPaiement(20_000, 'cos-1');
      const p2 = await creerPaiement(20_000, 'cos-2');
      const b1 = bonPour(p1);
      const b2 = bonPour(p2);
      await repo.saveIfNew(b1, p1);
      await repo.saveIfNew(b2, p2);

      const consommer = (bon: typeof b1) =>
        repo.saveIfStatut(
          redeemVoucher(bon, {
            redemptionId: 'scan-partage',
            stationId,
            operateurId: 'p-1',
            asOf: '2026-09-06T14:00:00.000Z',
          }).next,
          'EMIS',
        );

      expect(await consommer(b1)).toBe(true);
      await expect(consommer(b2)).rejects.toThrow(/redemption_unique/);
    });
  });

  // ------------------------------------------------------------------ webhooks

  describe('déduplication des webhooks', () => {
    it('cinq marquages concurrents du même événement : un seul passe', async () => {
      const store = new PgProcessedEventStore(db);
      const meta = { eventType: 'checkout.session.completed', payloadHash: 'a'.repeat(64) };

      const resultats = await Promise.all(
        Array.from({ length: 5 }, () => store.markIfNew('evt-1', meta)),
      );

      expect(resultats.filter(Boolean)).toHaveLength(1);
    });

    it('après oubli, un rejeu peut aboutir', async () => {
      const store = new PgProcessedEventStore(db);
      const meta = { eventType: 't', payloadHash: 'h' };

      expect(await store.markIfNew('evt-1', meta)).toBe(true);
      await store.forget('evt-1');
      expect(await store.markIfNew('evt-1', meta)).toBe(true);
    });
  });

  // -------------------------------------------------------------------- accès

  describe('jetons d’API', () => {
    it('un jeton valide résout son porteur ; le jeton en clair n’est jamais stocké', async () => {
      const jeton = genererJeton();
      await pool.query(
        `INSERT INTO api_tokens (id, role, subject, token_hash, station_id, expire_a)
         VALUES ($1, 'STATION_OPERATOR', 'pompiste-12', $2, $3, now() + interval '1 hour')`,
        [uuid(), empreinte(jeton), stationId],
      );

      const principal = await new PgAccessTokenVerifier(db).verify(jeton);
      expect(principal).toEqual({
        subject: 'pompiste-12',
        role: 'STATION_OPERATOR',
        stationId,
      });

      const stocke = (await pool.query('SELECT token_hash FROM api_tokens')).rows[0].token_hash;
      expect(stocke).not.toBe(jeton);
      expect(stocke).toMatch(/^[0-9a-f]{64}$/);
    });

    it('un jeton révoqué ne résout plus rien', async () => {
      const jeton = genererJeton();
      await pool.query(
        `INSERT INTO api_tokens (id, role, subject, token_hash, revoque_a, expire_a)
         VALUES ($1, 'ADMIN', 'admin-1', $2, now(), now() + interval '1 hour')`,
        [uuid(), empreinte(jeton)],
      );
      expect(await new PgAccessTokenVerifier(db).verify(jeton)).toBeNull();
    });

    it('la base refuse un pompiste sans station de rattachement', async () => {
      await expect(
        pool.query(
          `INSERT INTO api_tokens (id, role, subject, token_hash, expire_a)
           VALUES ($1, 'STATION_OPERATOR', 'p-9', $2, now() + interval '1 hour')`,
          [uuid(), empreinte(genererJeton())],
        ),
      ).rejects.toThrow(/pompiste_rattache/);
    });
  });

  // ------------------------------------------------------- sessions et envois

  describe('sessions de paiement et file d’envoi', () => {
    it('une session se relit avec son montant et son chauffeur', async () => {
      const repo = new PgCheckoutSessionRepository(db);
      await repo.save({
        reference: 'REF-1',
        driverId,
        montant: xof(20_000),
        canal: 'WAVE_CHECKOUT',
        sessionId: null,
      });
      await repo.attacherSessionId('REF-1', 'cos-1');

      const relu = await repo.findByReference('REF-1');
      expect(relu).toMatchObject({ driverId, montant: 20_000, sessionId: 'cos-1' });
    });

    it('la mise en file n’écrit pas le jeton signé', async () => {
      const paiement = await creerPaiement(20_000);
      const bon = bonPour(paiement);
      await new PgVoucherRepository(db).saveIfNew(bon, paiement);

      await new PgVoucherDeliveryQueue(db).enqueue({
        voucherId: bon.id,
        destinataire: '+221770000001',
        montant: xof(20_000),
        token: 'AT1.charge.signature',
        expireA: bon.expireA,
      });

      const lignes = await pool.query('SELECT * FROM voucher_deliveries');
      expect(JSON.stringify(lignes.rows)).not.toContain('AT1.');
      expect(lignes.rows[0].statut).toBe('EN_ATTENTE');
    });

    it('un chauffeur se relit par son identifiant', async () => {
      const d = await new PgDriverRepository(db).findById(driverId);
      expect(d).toMatchObject({ msisdn: '+221770000001', statut: 'ACTIF' });
    });

    it('la base refuse un numéro qui n’est pas au format E.164', async () => {
      await expect(
        pool.query(
          `INSERT INTO drivers (id, entity_id, nom, msisdn) VALUES ($1, $2, 'X', '77 000 00 01')`,
          [uuid(), entityId],
        ),
      ).rejects.toThrow(/msisdn_e164/);
    });
  });

  // ------------------------------------------------------------ rapprochement

  describe('rapprochement', () => {
    it('un MATCHED dans la tolérance enregistrée est accepté', async () => {
      await expect(
        pool.query(
          `INSERT INTO reconciliations (id, periode, ecart_xof, tolerance_xof, statut, invoice_id,
                                        payment_intent_id, wave_transaction_id)
           VALUES ($1, '2026-08-31', -400, 500, 'MATCHED', NULL, NULL, $2)`,
          [uuid(), await creerMouvementWave()],
        ),
      ).resolves.toBeTruthy();
    });

    it('un MATCHED hors tolérance est refusé par la base', async () => {
      await expect(
        pool.query(
          `INSERT INTO reconciliations (id, periode, ecart_xof, tolerance_xof, statut,
                                        wave_transaction_id)
           VALUES ($1, '2026-08-31', -600, 500, 'MATCHED', $2)`,
          [uuid(), await creerMouvementWave()],
        ),
      ).rejects.toThrow(/matched_dans_la_tolerance/);
    });

    it('une ligne de rapprochement qui ne pointe vers rien est refusée', async () => {
      await expect(
        pool.query(
          `INSERT INTO reconciliations (id, periode, statut) VALUES ($1, '2026-08-31', 'ORPHAN')`,
          [uuid()],
        ),
      ).rejects.toThrow(/non_vide/);
    });
  });

  // ------------------------------------------------------------------- audit

  describe('journal d’audit', () => {
    it('un événement d’audit ne peut être ni modifié ni supprimé', async () => {
      await pool.query(
        `INSERT INTO audit_events (actor, action, target_type, target_id, payload_hash)
         VALUES ('admin-1', 'VOUCHER_ISSUED', 'fuel_voucher', 'BON-1', 'h')`,
      );

      // Les règles DO INSTEAD NOTHING n'échouent pas : elles n'ont simplement aucun effet.
      await pool.query(`UPDATE audit_events SET actor = 'pirate'`);
      await pool.query(`DELETE FROM audit_events`);

      const r = await pool.query('SELECT actor FROM audit_events');
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].actor).toBe('admin-1');
    });
  });

  // ------------------------------------------------------------------ helpers

  async function creerPaiement(montant: number, reference = 'cos-1'): Promise<string> {
    const id = uuid();
    await pool.query(
      `INSERT INTO driver_payments (id, driver_id, montant_xof, canal, reference, recu_a)
       VALUES ($1, $2, $3, 'WAVE_CHECKOUT', $4, now())`,
      [id, driverId, String(montant), reference],
    );
    return id;
  }

  function bonPour(paymentId: string) {
    return emitVoucher({
      id: uuid(),
      driverId,
      montant: xof(20_000),
      emisA: '2026-09-06T10:00:00.000Z',
      validiteHeures: 24,
      paymentRef: `WAVE_CHECKOUT/${paymentId}`,
    });
  }

  async function creerMouvementWave(): Promise<string> {
    const id = uuid();
    await pool.query(
      `INSERT INTO wave_transactions (id, wave_tx_id, date_tx, sens, montant_xof, raw_json)
       VALUES ($1, $2, now(), 'OUT', 20000, '{}'::jsonb)`,
      [id, `pw-${id}`],
    );
    return id;
  }
});
