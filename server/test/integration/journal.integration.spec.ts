/**
 * Consultation du journal d'audit, contre une vraie base.
 *
 * Il n'y a pas de couche applicative ici : lire un journal, c'est une requête. Ce qui mérite
 * d'être prouvé l'est donc en base :
 *
 *  - la pagination ne saute et ne répète aucune ligne, même quand on écrit pendant qu'on lit —
 *    sur un journal d'audit, une ligne sautée est une ligne qu'on ne verra jamais ;
 *  - le nom de l'acteur est résolu à la lecture, et son absence n'efface pas l'événement ;
 *  - la table reste en ajout seul : aucune lecture ne peut la modifier.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import type { SqlExecutor } from '../../src/infra/db/sql-executor.ts';
import { PgJournalAudit } from '../../src/infra/db/pg-journal.ts';

const URL_TEST = process.env.DATABASE_URL_TEST;
const decrire = URL_TEST ? describe : describe.skip;

let pool: pg.Pool;
let db: SqlExecutor;
let journal: PgJournalAudit;
let entityId: string;

function uuid(): string {
  return crypto.randomUUID();
}

async function ecrire(
  action: string,
  acteur = 'systeme',
  cibleId = 'cible-1',
  quand: string | null = null,
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_events (actor, action, target_type, target_id, payload_hash, ts)
     VALUES ($1, $2, 'test', $3, repeat('a', 64), COALESCE($4::timestamptz, now()))`,
    [acteur, action, cibleId, quand],
  );
}

decrire('intégration PostgreSQL — journal d’audit', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_TEST });
    db = {
      query: async (texte, params = []) => {
        const r = await pool.query(texte, params as unknown[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
    };
    journal = new PgJournalAudit(db);
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
    await pool.query(`INSERT INTO entities (id, raison_sociale) VALUES ($1, 'Assur''Trans')`, [
      entityId,
    ]);
  });

  describe('lecture', () => {
    it('rend le plus récent en premier', async () => {
      // Un journal se lit à l'envers : ce qui vient d'arriver est ce qu'on cherche.
      await ecrire('PREMIER');
      await ecrire('DEUXIEME');
      await ecrire('TROISIEME');

      const page = await journal.consulter({}, null, 10);

      expect(page.evenements.map((e) => e.action)).toEqual(['TROISIEME', 'DEUXIEME', 'PREMIER']);
    });

    it('rend l’empreinte, jamais un payload', async () => {
      // Le schéma ne conserve que l'empreinte : un journal qui accumule des numéros de
      // téléphone devient lui-même un fichier à protéger.
      await ecrire('CHAUFFEUR_CREE');

      const page = await journal.consulter({}, null, 10);

      expect(page.evenements[0].empreinte).toHaveLength(64);
      expect(Object.keys(page.evenements[0])).not.toContain('payload');
    });

    it('annonce qu’il n’y a pas de suite quand tout tient sur une page', async () => {
      await ecrire('SEUL');

      const page = await journal.consulter({}, null, 10);

      expect(page.curseurSuivant).toBeNull();
    });
  });

  describe('pagination', () => {
    it('ne saute ni ne répète aucune ligne', async () => {
      for (let n = 0; n < 7; n += 1) await ecrire(`ACTION_${n}`);

      const vus: string[] = [];
      let curseur: string | null = null;
      do {
        const page: Awaited<ReturnType<typeof journal.consulter>> = await journal.consulter(
          {},
          curseur,
          3,
        );
        vus.push(...page.evenements.map((e) => e.action));
        curseur = page.curseurSuivant;
      } while (curseur !== null);

      expect(vus).toHaveLength(7);
      expect(new Set(vus).size).toBe(7);
    });

    it('reste stable quand on écrit entre deux pages', async () => {
      // Un OFFSET decalerait toutes les lignes suivantes a chaque nouvelle ecriture, et on
      // sauterait celle qu'on cherchait. La pagination par cle ne bouge pas.
      for (let n = 0; n < 5; n += 1) await ecrire(`ANCIEN_${n}`);

      const premiere = await journal.consulter({}, null, 2);
      await ecrire('SURVENU_ENTRE_DEUX');
      const seconde = await journal.consulter({}, premiere.curseurSuivant, 10);

      const vus = [...premiere.evenements, ...seconde.evenements].map((e) => e.action);
      expect(vus).not.toContain('SURVENU_ENTRE_DEUX');
      expect(new Set(vus).size).toBe(5);
    });
  });

  describe('filtres', () => {
    it('filtre par action', async () => {
      await ecrire('REGLEMENT_EXECUTE');
      await ecrire('CHAUFFEUR_CREE');
      await ecrire('REGLEMENT_EXECUTE');

      const page = await journal.consulter({ action: 'REGLEMENT_EXECUTE' }, null, 10);

      expect(page.evenements).toHaveLength(2);
    });

    it('filtre par acteur', async () => {
      await ecrire('A', 'reprise');
      await ecrire('B', 'envoi');

      const page = await journal.consulter({ acteur: 'reprise' }, null, 10);

      expect(page.evenements.map((e) => e.action)).toEqual(['A']);
    });

    it('filtre par cible : toute la vie d’un bon en une requête', async () => {
      await ecrire('VOUCHER_ISSUED', 'systeme', 'BON-1');
      await ecrire('BON_ENVOYE', 'envoi', 'BON-1');
      await ecrire('VOUCHER_ISSUED', 'systeme', 'BON-2');

      const page = await journal.consulter({ cibleId: 'BON-1' }, null, 10);

      expect(page.evenements.map((e) => e.action)).toEqual(['BON_ENVOYE', 'VOUCHER_ISSUED']);
    });

    it('borne sur les dates, dernier jour inclus', async () => {
      await ecrire('AVANT', 'systeme', 'c', '2026-08-31T23:00:00.000Z');
      await ecrire('DEDANS', 'systeme', 'c', '2026-09-15T12:00:00.000Z');
      await ecrire('DERNIER_JOUR', 'systeme', 'c', '2026-09-30T22:00:00.000Z');
      await ecrire('APRES', 'systeme', 'c', '2026-10-01T01:00:00.000Z');

      const page = await journal.consulter(
        { depuis: '2026-09-01', jusqua: '2026-09-30' },
        null,
        10,
      );

      expect(page.evenements.map((e) => e.action).sort()).toEqual(['DEDANS', 'DERNIER_JOUR']);
    });

    it('ne propose que des actions réellement présentes', async () => {
      // Une liste ecrite en dur proposerait des filtres qui ne rendent rien, et manquerait les
      // actions ajoutees depuis.
      await ecrire('ZEBRE');
      await ecrire('ALPHA');
      await ecrire('ALPHA');

      expect(await journal.actionsConnues()).toEqual(['ALPHA', 'ZEBRE']);
    });
  });

  describe('le nom de l’acteur', () => {
    it('est résolu à la lecture pour un opérateur', async () => {
      const id = uuid();
      await pool.query(
        `INSERT INTO operateurs (id, nom, msisdn, role) VALUES ($1, 'Awa Fall', $2, 'ADMIN')`,
        [id, '+221770000055'],
      );
      await ecrire('OPERATEUR_CREE', id);

      const page = await journal.consulter({}, null, 10);

      expect(page.evenements[0].acteurNom).toBe('Awa Fall');
    });

    it('est résolu pour un chauffeur', async () => {
      const id = uuid();
      await pool.query(
        `INSERT INTO drivers (id, entity_id, nom, msisdn)
         VALUES ($1, $2, 'Moussa Ndiaye', '+221770000011')`,
        [id, entityId],
      );
      await ecrire('PAYMENT_SESSION_CREATED', id);

      expect((await journal.consulter({}, null, 10)).evenements[0].acteurNom).toBe(
        'Moussa Ndiaye',
      );
    });

    it('manque sans effacer l’événement quand le compte a disparu', async () => {
      // Le journal survit au referentiel : c'est tout l'interet d'une table en ajout seul.
      await ecrire('OPERATEUR_CREE', uuid());

      const e = (await journal.consulter({}, null, 10)).evenements[0];

      expect(e.acteurNom).toBeNull();
      expect(e.action).toBe('OPERATEUR_CREE');
    });

    it('reste nul pour un mécanisme, qui n’est pas une personne', async () => {
      await ecrire('REGLEMENT_REPRIS', 'reprise');

      expect((await journal.consulter({}, null, 10)).evenements[0].acteurNom).toBeNull();
    });
  });

  describe('ajout seul', () => {
    it('un événement ne peut être ni modifié ni supprimé', async () => {
      // Les regles DO INSTEAD NOTHING n'echouent pas : elles n'ont simplement aucun effet.
      await ecrire('IMMUABLE', 'awa');

      await pool.query(`UPDATE audit_events SET actor = 'pirate'`);
      await pool.query(`DELETE FROM audit_events`);

      const page = await journal.consulter({}, null, 10);
      expect(page.evenements).toHaveLength(1);
      expect(page.evenements[0].acteur).toBe('awa');
    });
  });
});
