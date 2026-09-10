/**
 * Le rapprochement contre une vraie base.
 *
 * Ce qui ne se prouve qu'ici : qu'un recalcul n'efface pas la décision d'un humain, et que deux
 * personnes tranchant le même écart au même instant n'écrivent pas deux notes dont une seule
 * sera lue. Ces garanties tiennent à un `WHERE resolu_at IS NULL` — pas à du code applicatif.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { xof } from '../../src/domain/money.ts';
import type { ReconLine } from '../../src/domain/reconciliation.ts';
import type { SqlExecutor } from '../../src/infra/db/sql-executor.ts';
import {
  PgRapprochementRepository,
  PgReleveRepository,
  PgSourcesDuRapprochement,
} from '../../src/infra/db/pg-rapprochement.ts';

const URL_TEST = process.env.DATABASE_URL_TEST;
const decrire = URL_TEST ? describe : describe.skip;
const PERIODE = '2026-08-31';

let pool: pg.Pool;
let db: SqlExecutor;
let releve: PgReleveRepository;
let sources: PgSourcesDuRapprochement;
let rangement: PgRapprochementRepository;

let entityId: string;
let contractId: string;

function uuid(): string {
  return crypto.randomUUID();
}

function ligne(surcharge: Partial<ReconLine> = {}): ReconLine {
  return {
    statut: 'ORPHAN',
    invoiceId: null,
    paymentIntentId: null,
    waveTransactionId: null,
    ecartXof: 0 as never,
    toleranceXof: xof(0),
    motif: 'sortie de fonds sans intention',
    ...surcharge,
  };
}

decrire('intégration PostgreSQL — rapprochement', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_TEST });
    db = {
      query: async (texte, params = []) => {
        const r = await pool.query(texte, params as unknown[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
    };
    releve = new PgReleveRepository(db);
    sources = new PgSourcesDuRapprochement(db);
    // Le remplacement epingle une connexion : `BEGIN` et `COMMIT` sur un pool partiraient sur
    // des connexions differentes, et la transaction resterait ouverte a jamais.
    rangement = new PgRapprochementRepository(db, {
      async inTransaction(bloc) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const tx = {
            query: async (texte: string, params: readonly unknown[] = []) => {
              const r = await client.query(texte, params as unknown[]);
              return { rows: r.rows, rowCount: r.rowCount ?? 0 };
            },
          };
          const resultat = await bloc(tx);
          await client.query('COMMIT');
          return resultat;
        } catch (cause) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw cause;
        } finally {
          client.release();
        }
      },
    });
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
    contractId = uuid();
    await pool.query(`INSERT INTO entities (id, raison_sociale) VALUES ($1, 'Assur''Trans')`, [
      entityId,
    ]);
    await pool.query(
      `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                 delai_reglement_jours)
       VALUES ($1, $2, 'TE-1', 10000000, 30)`,
      [contractId, entityId],
    );
  });

  describe('relevé saisi à la main', () => {
    it('enregistre puis relit un mouvement', async () => {
      const id = uuid();

      expect(
        await releve.ajouterSiNouveau({
          id,
          waveTxId: 'pw-1',
          dateTx: '2026-08-15T10:00:00.000Z',
          sens: 'OUT',
          montant: xof(2_000_000),
          contrepartie: 'TotalEnergies',
        }),
      ).toBe(true);

      const lu = await releve.listerSurPeriode('2026-08-01', '2026-08-31');
      expect(lu).toHaveLength(1);
      expect(lu[0]).toMatchObject({ waveTxId: 'pw-1', sens: 'OUT', montant: 2_000_000 });
    });

    it('ne double pas une ligne saisie deux fois', async () => {
      // Une saisie manuelle se refrappe. L'index unique sur `wave_tx_id` l'absorbe.
      const commun = {
        waveTxId: 'pw-1',
        dateTx: '2026-08-15T10:00:00.000Z',
        sens: 'OUT' as const,
        montant: xof(2_000_000),
        contrepartie: null,
      };

      expect(await releve.ajouterSiNouveau({ id: uuid(), ...commun })).toBe(true);
      expect(await releve.ajouterSiNouveau({ id: uuid(), ...commun })).toBe(false);
      expect(await releve.listerSurPeriode('2026-08-01', '2026-08-31')).toHaveLength(1);
    });

    it('borne sur la période, dernier jour inclus', async () => {
      const poser = (waveTxId: string, dateTx: string) =>
        releve.ajouterSiNouveau({
          id: uuid(),
          waveTxId,
          dateTx,
          sens: 'OUT',
          montant: xof(1_000),
          contrepartie: null,
        });
      await poser('avant', '2026-07-31T23:00:00.000Z');
      await poser('dernier-jour', '2026-08-31T22:00:00.000Z');
      await poser('apres', '2026-09-01T01:00:00.000Z');

      const lu = await releve.listerSurPeriode('2026-08-01', '2026-08-31');

      expect(lu.map((m) => m.waveTxId)).toEqual(['dernier-jour']);
    });

    it('refuse de retirer une ligne adossée à un rapprochement', async () => {
      // Effacer un mouvement deja rapproche laisserait une ligne pointant vers rien.
      const id = uuid();
      await releve.ajouterSiNouveau({
        id,
        waveTxId: 'pw-1',
        dateTx: '2026-08-15T10:00:00.000Z',
        sens: 'OUT',
        montant: xof(2_000_000),
        contrepartie: null,
      });
      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: id })]);

      expect(await releve.supprimer(id)).toBe(false);
    });
  });

  describe('remplacement d’une période', () => {
    async function mouvement(waveTxId = 'pw-1'): Promise<string> {
      const id = uuid();
      await releve.ajouterSiNouveau({
        id,
        waveTxId,
        dateTx: '2026-08-15T10:00:00.000Z',
        sens: 'OUT',
        montant: xof(2_000_000),
        contrepartie: null,
      });
      return id;
    }

    it('rejouer remplace au lieu d’accumuler', async () => {
      const w = await mouvement();

      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);
      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);

      expect(await rangement.listerPourPeriode(PERIODE)).toHaveLength(1);
    });

    it('épargne une ligne qu’un humain a tranchée', async () => {
      // Le cœur du sujet : recalculer ne doit pas effacer une enquête. La condition
      // `WHERE resolu_at IS NULL` est ce qui l'en empêche.
      const w = await mouvement();
      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);
      const avant = (await rangement.listerPourPeriode(PERIODE))[0];
      await rangement.resoudre(avant.id, 'omar', 'frais bancaires, vu avec Wave');

      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);

      const apres = await rangement.listerPourPeriode(PERIODE);
      const resolue = apres.find((l) => l.resoluPar === 'omar');
      expect(resolue).toBeDefined();
      expect(resolue?.note).toBe('frais bancaires, vu avec Wave');
    });

    it('ne repose pas un constat déjà tranché', async () => {
      // Sans cela, recalculer recreait une ligne ouverte a cote de celle qu'un humain venait
      // de resoudre : on lui redemandait de trancher ce qu'il avait tranche, et la resolution
      // devenait decorative.
      const w = await mouvement();
      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);
      const avant = (await rangement.listerPourPeriode(PERIODE))[0];
      await rangement.resoudre(avant.id, 'omar', 'frais bancaires');

      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);

      const apres = await rangement.listerPourPeriode(PERIODE);
      expect(apres).toHaveLength(1);
      expect(apres[0].resoluPar).toBe('omar');
    });

    it('repose un constat qui porte sur autre chose', async () => {
      // La resolution vaut pour CE constat, pas pour la periode entiere.
      const w1 = await mouvement('pw-1');
      const w2 = await mouvement('pw-2');
      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w1 })]);
      const avant = (await rangement.listerPourPeriode(PERIODE))[0];
      await rangement.resoudre(avant.id, 'omar', 'frais bancaires');

      await rangement.remplacerPourPeriode(PERIODE, [
        ligne({ waveTransactionId: w1 }),
        ligne({ waveTransactionId: w2 }),
      ]);

      const apres = await rangement.listerPourPeriode(PERIODE);
      expect(apres).toHaveLength(2);
      expect(apres.filter((l) => l.resoluPar === null)).toHaveLength(1);
    });

    it('ne touche pas aux autres périodes', async () => {
      const w = await mouvement();
      await rangement.remplacerPourPeriode('2026-07-31', [ligne({ waveTransactionId: w })]);

      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);

      expect(await rangement.listerPourPeriode('2026-07-31')).toHaveLength(1);
    });

    it('refuse en base un MATCHED hors tolérance', async () => {
      // Un chiffre faux au rapprochement doit echouer ici, pas devant un dirigeant.
      const w = await mouvement();

      await expect(
        rangement.remplacerPourPeriode(PERIODE, [
          ligne({
            statut: 'MATCHED',
            waveTransactionId: w,
            ecartXof: 5_000 as never,
            toleranceXof: xof(0),
          }),
        ]),
      ).rejects.toThrow(/tolerance/);
    });

    it('refuse en base une ligne qui ne pointe vers rien', async () => {
      await expect(rangement.remplacerPourPeriode(PERIODE, [ligne()])).rejects.toThrow(
        /non_vide/,
      );
    });
  });

  describe('résolution', () => {
    async function posee(): Promise<string> {
      const w = uuid();
      await releve.ajouterSiNouveau({
        id: w,
        waveTxId: `pw-${w.slice(0, 8)}`,
        dateTx: '2026-08-15T10:00:00.000Z',
        sens: 'OUT',
        montant: xof(1_000),
        contrepartie: null,
      });
      await rangement.remplacerPourPeriode(PERIODE, [ligne({ waveTransactionId: w })]);
      return (await rangement.listerPourPeriode(PERIODE))[0].id;
    }

    it('deux résolutions simultanées : une seule passe', async () => {
      const id = await posee();

      const [a, b] = await Promise.all([
        rangement.resoudre(id, 'omar', 'frais bancaires'),
        rangement.resoudre(id, 'fatou', 'erreur de saisie'),
      ]);

      expect([a, b].filter(Boolean)).toHaveLength(1);
    });

    it('une ligne résolue cesse de bloquer le cycle', async () => {
      const id = await posee();
      expect(await rangement.resteDesLignesBloquantes()).toBe(true);

      await rangement.resoudre(id, 'omar', 'frais bancaires');

      expect(await rangement.resteDesLignesBloquantes()).toBe(false);
    });

    it('une facture jamais ordonnancée ne bloque pas son propre ordonnancement', async () => {
      // Sinon le systeme se verrouille sur lui-meme : pour ordonnancer la facture il faudrait
      // preparer un reglement, et preparer est bloque parce qu'elle n'est pas ordonnancee.
      // Une telle ligne ne porte aucun mouvement de fonds : c'est une tache, pas une inconnue.
      const f = uuid();
      await pool.query(
        `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                               date_emission, date_echeance)
         VALUES ($1, $2, 'TE-OUBLIEE', '2026-07-01', '2026-07-31', 500000, '2026-08-01',
                 '2026-08-20')`,
        [f, contractId],
      );
      await rangement.remplacerPourPeriode(PERIODE, [
        ligne({ statut: 'ORPHAN', invoiceId: f, motif: 'échue et jamais ordonnancée' }),
      ]);

      expect(await rangement.resteDesLignesBloquantes()).toBe(false);
    });

    it('un MATCHED ne bloque jamais', async () => {
      const w = uuid();
      await releve.ajouterSiNouveau({
        id: w,
        waveTxId: 'pw-ok',
        dateTx: '2026-08-15T10:00:00.000Z',
        sens: 'OUT',
        montant: xof(1_000),
        contrepartie: null,
      });
      await rangement.remplacerPourPeriode(PERIODE, [
        ligne({ statut: 'MATCHED', waveTransactionId: w, ecartXof: 0 as never }),
      ]);

      expect(await rangement.resteDesLignesBloquantes()).toBe(false);
    });

    it('range les orphelins et les écarts avant le reste', async () => {
      // Ce qui demande une décision se lit en premier.
      const a = uuid();
      const b = uuid();
      for (const [id, tx] of [
        [a, 'pw-a'],
        [b, 'pw-b'],
      ] as const) {
        await releve.ajouterSiNouveau({
          id,
          waveTxId: tx,
          dateTx: '2026-08-15T10:00:00.000Z',
          sens: 'OUT',
          montant: xof(1_000),
          contrepartie: null,
        });
      }
      await rangement.remplacerPourPeriode(PERIODE, [
        ligne({ statut: 'MATCHED', waveTransactionId: a, ecartXof: 0 as never }),
        ligne({ statut: 'ORPHAN', waveTransactionId: b }),
      ]);

      const lues = await rangement.listerPourPeriode(PERIODE);

      expect(lues[0].statut).toBe('ORPHAN');
    });
  });

  describe('les trois voies', () => {
    it('remonte les factures échues à la date d’arrêté, réglées comprises', async () => {
      // Une facture marquée reglee dont aucun mouvement ne correspond est exactement
      // l'anomalie qu'un rapprochement doit trouver.
      const poser = (numero: string, echeance: string, statut: string) =>
        pool.query(
          `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin,
                                 montant_xof, date_emission, date_echeance, statut)
           VALUES ($1, $2, $3, '2026-07-01', '2026-07-31', 1000000, '2026-08-01', $4, $5)`,
          [uuid(), contractId, numero, echeance, statut],
        );
      await poser('TE-A', '2026-08-15', 'OUVERTE');
      await poser('TE-B', '2026-08-20', 'REGLEE');
      await poser('TE-C', '2026-09-15', 'OUVERTE');

      const factures = await sources.facturesEchuesAu(contractId, PERIODE);

      expect(factures.map((f) => f.numero)).toEqual(['TE-A', 'TE-B']);
    });

    it('remonte une facture réglée par anticipation, dont l’échéance tombe plus tard', async () => {
      // Trouve en rapprochant pour de bon : un versement d'octobre pour une facture de
      // novembre laissait son mouvement sans contrepartie, et un reglement parfaitement
      // legitime ressortait en « sortie de fonds sans intention ».
      const f = uuid();
      const i = uuid();
      const w = uuid();
      await pool.query(
        `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                               date_emission, date_echeance)
         VALUES ($1, $2, 'TE-NOV', '2026-10-01', '2026-10-31', 750000, '2026-11-01',
                 '2026-11-30')`,
        [f, contractId],
      );
      await pool.query(
        `INSERT INTO payment_intents (id, invoice_id, montant_xof, statut, canal,
                                      reference_imputation, idempotency_key, prepare_par,
                                      wave_payout_id)
         VALUES ($1, $2, 750000, 'SENT', 'DRY_RUN', 'ATS/TE-NOV', $3, 'awa', 'pw-anticipe')`,
        [i, f, uuid()],
      );
      await releve.ajouterSiNouveau({
        id: w,
        waveTxId: 'pw-anticipe',
        dateTx: '2026-08-20T10:00:00.000Z',
        sens: 'OUT',
        montant: xof(750_000),
        contrepartie: 'TotalEnergies',
      });

      const factures = await sources.facturesEchuesAu(contractId, PERIODE);

      expect(factures.map((f2) => f2.numero)).toContain('TE-NOV');
    });

    it('ne remonte pas une facture à venir dont rien n’est parti', async () => {
      // L'inverse serait faux aussi : une facture non echue et non reglee apparaitrait comme
      // « jamais ordonnancee », ce qui n'a aucun sens avant son echeance.
      await pool.query(
        `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                               date_emission, date_echeance)
         VALUES ($1, $2, 'TE-DEC', '2026-11-01', '2026-11-30', 900000, '2026-12-01',
                 '2026-12-31')`,
        [uuid(), contractId],
      );

      const factures = await sources.facturesEchuesAu(contractId, PERIODE);

      expect(factures.map((f) => f.numero)).not.toContain('TE-DEC');
    });

    it('rend une liste vide sans interroger la base quand il n’y a aucune facture', async () => {
      expect(await sources.intentionsDesFactures([])).toEqual([]);
    });
  });
});
