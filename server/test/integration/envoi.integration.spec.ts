/**
 * La file d'envoi contre une vraie base.
 *
 * Ce qui se joue ici ne peut pas se prouver en mémoire : que deux workers lancés en même temps
 * n'expédient pas le même bon. La garantie n'est pas dans le code du worker — elle est dans le
 * `FOR UPDATE SKIP LOCKED` de la réclamation. Un `SELECT` suivi d'un `UPDATE` passerait tous
 * les tests unitaires et enverrait deux fois le même QR au chauffeur.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { xof } from '../../src/domain/money.ts';
import type { SqlExecutor } from '../../src/infra/db/sql-executor.ts';
import { PgVoucherDeliveryQueue } from '../../src/infra/db/pg-repositories.ts';

const URL_TEST = process.env.DATABASE_URL_TEST;
const decrire = URL_TEST ? describe : describe.skip;

let pool: pg.Pool;
let db: SqlExecutor;
let file: PgVoucherDeliveryQueue;

let entityId: string;
let driverId: string;
let paymentId: string;
let voucherId: string;

function uuid(): string {
  return crypto.randomUUID();
}

decrire('intégration PostgreSQL — file d’envoi', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_TEST });
    db = {
      query: async (texte, params = []) => {
        const r = await pool.query(texte, params as unknown[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
    };
    file = new PgVoucherDeliveryQueue(db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE voucher_deliveries, fuel_vouchers, checkout_sessions, driver_payments,
               card_transactions, api_tokens, cards, drivers, stations, operateurs,
               reconciliations, webhook_events, payment_intents, invoices,
               te_contracts, wave_transactions, entities, audit_events, job_locks
      RESTART IDENTITY CASCADE
    `);

    entityId = uuid();
    driverId = uuid();
    paymentId = uuid();
    voucherId = uuid();

    await pool.query(`INSERT INTO entities (id, raison_sociale) VALUES ($1, 'Assur''Trans')`, [
      entityId,
    ]);
    await pool.query(
      `INSERT INTO drivers (id, entity_id, nom, msisdn)
       VALUES ($1, $2, 'Moussa Ndiaye', '+221770000011')`,
      [driverId, entityId],
    );
    await pool.query(
      `INSERT INTO driver_payments (id, driver_id, montant_xof, canal, reference, recu_a)
       VALUES ($1, $2, 20000, 'WAVE_CHECKOUT', $3, now())`,
      [paymentId, driverId, `cos-${paymentId}`],
    );
    await pool.query(
      `INSERT INTO fuel_vouchers (id, driver_id, payment_id, montant_xof, statut, emis_a,
                                  expire_a, payment_ref)
       VALUES ($1, $2, $3, 20000, 'EMIS', now(), now() + interval '24 hours', $4)`,
      [voucherId, driverId, paymentId, `WAVE_CHECKOUT/${paymentId}`],
    );
  });

  async function empiler(destinataire = '+221770000011') {
    return file.enqueue({
      voucherId,
      destinataire,
      montant: xof(20_000),
      // Le jeton est passé mais délibérément non conservé : il vaut du carburant.
      token: 'AT1.charge.signature',
      expireA: new Date(Date.now() + 86_400_000).toISOString(),
    });
  }

  it('n’enregistre jamais le jeton', async () => {
    // La table est une trace d'acheminement, pas un coffre.
    const id = await empiler();

    const r = await pool.query('SELECT * FROM voucher_deliveries WHERE id = $1', [id]);
    expect(JSON.stringify(r.rows[0])).not.toContain('AT1.');
    expect(JSON.stringify(r.rows[0])).not.toContain('signature');
  });

  it('empile en attente, sans tentative', async () => {
    const id = await empiler();

    const r = await pool.query('SELECT statut, tentatives FROM voucher_deliveries WHERE id = $1', [
      id,
    ]);
    expect(r.rows[0]).toMatchObject({ statut: 'EN_ATTENTE', tentatives: 0 });
  });

  describe('réclamation', () => {
    it('rend la ligne et la marque en cours', async () => {
      const id = await empiler();

      const reclames = await file.reclamer(10, 3);

      expect(reclames).toHaveLength(1);
      expect(reclames[0]).toMatchObject({ id, voucherId, destinataire: '+221770000011' });
      const r = await pool.query('SELECT statut FROM voucher_deliveries WHERE id = $1', [id]);
      expect(r.rows[0].statut).toBe('ENVOI_EN_COURS');
    });

    it('compte la tentative dès la réclamation, pas après l’envoi', async () => {
      // Si le worker meurt en plein envoi, la tentative doit être comptée : sinon une
      // passerelle qui fait planter le processus serait réessayée sans fin.
      const id = await empiler();

      await file.reclamer(10, 3);

      const r = await pool.query('SELECT tentatives FROM voucher_deliveries WHERE id = $1', [id]);
      expect(r.rows[0].tentatives).toBe(1);
    });

    it('deux réclamations concurrentes ne se recouvrent pas', async () => {
      // Le cœur du sujet. Sans `FOR UPDATE SKIP LOCKED`, les deux workers expédieraient le même
      // bon et le chauffeur recevrait deux fois le même code.
      await empiler();
      await empiler();
      await empiler();

      const [a, b] = await Promise.all([file.reclamer(2, 3), file.reclamer(2, 3)]);

      const ids = [...a, ...b].map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(3);
    });

    it('ne rend pas deux fois la même ligne au même worker', async () => {
      await empiler();

      const premier = await file.reclamer(10, 3);
      const second = await file.reclamer(10, 3);

      expect(premier).toHaveLength(1);
      expect(second).toHaveLength(0);
    });

    it('prend les plus anciennes d’abord', async () => {
      const vieux = await empiler();
      await pool.query(
        `UPDATE voucher_deliveries SET created_at = now() - interval '1 hour' WHERE id = $1`,
        [vieux],
      );
      await empiler();

      const reclames = await file.reclamer(1, 3);

      expect(reclames[0].id).toBe(vieux);
    });

    it('laisse les lignes ayant épuisé leurs tentatives', async () => {
      const id = await empiler();
      await pool.query('UPDATE voucher_deliveries SET tentatives = 3 WHERE id = $1', [id]);

      expect(await file.reclamer(10, 3)).toHaveLength(0);
    });
  });

  describe('sort de l’envoi', () => {
    it('marque envoyé, avec la référence du fournisseur', async () => {
      const id = await empiler();
      await file.reclamer(10, 3);

      await file.marquerEnvoye(id, 'wamid.42');

      const r = await pool.query(
        'SELECT statut, provider_ref, erreur FROM voucher_deliveries WHERE id = $1',
        [id],
      );
      expect(r.rows[0]).toMatchObject({ statut: 'ENVOYE', provider_ref: 'wamid.42', erreur: null });
    });

    it('remet en attente tant qu’il reste des tentatives', async () => {
      const id = await empiler();
      await file.reclamer(10, 3);

      await file.marquerEchec(id, 'coupure réseau', 3);

      const r = await pool.query('SELECT statut, erreur FROM voucher_deliveries WHERE id = $1', [
        id,
      ]);
      expect(r.rows[0]).toMatchObject({ statut: 'EN_ATTENTE', erreur: 'coupure réseau' });
    });

    it('clôt en échec une fois le plafond atteint, ce qui la rend visible en incident', async () => {
      const id = await empiler();
      await file.reclamer(10, 1);

      await file.marquerEchec(id, 'numéro injoignable', 1);

      const r = await pool.query('SELECT statut FROM voucher_deliveries WHERE id = $1', [id]);
      expect(r.rows[0].statut).toBe('ECHEC');

      // C'est cette bascule qui fait apparaître le chauffeur dans les incidents du tableau de
      // bord : il a payé et n'a rien reçu.
      const incidents = await pool.query(
        `SELECT count(*)::int AS n FROM voucher_deliveries WHERE statut = 'ECHEC'`,
      );
      expect(incidents.rows[0].n).toBe(1);
    });

    it('tronque un motif démesuré plutôt que de faire échouer l’écriture', async () => {
      const id = await empiler();
      await file.reclamer(10, 3);

      await file.marquerEchec(id, 'x'.repeat(5000), 3);

      const r = await pool.query('SELECT erreur FROM voucher_deliveries WHERE id = $1', [id]);
      expect(r.rows[0].erreur.length).toBeLessThanOrEqual(500);
    });

    it('refuse en base un échec sans motif', async () => {
      // Un incident sans raison ne se diagnostique pas six mois plus tard.
      const id = await empiler();

      await expect(
        pool.query(`UPDATE voucher_deliveries SET statut = 'ECHEC' WHERE id = $1`, [id]),
      ).rejects.toThrow(/echec_motive/);
    });
  });
});
