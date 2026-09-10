/**
 * Les requêtes du côté administration, exécutées pour de bon.
 *
 * Les tests unitaires de ces dépôts passent par une doublure qui vérifie la FORME du SQL. Une
 * doublure accepte `resolu_a` sur une table dont la colonne s'appelle `resolu_at` : le test est
 * vert, et le tableau de bord répond 500 au premier appel réel. C'est exactement ce qui est
 * arrivé. Ce fichier exécute chaque requête contre une vraie base — ce qui, pour du SQL, est la
 * seule vérification qui prouve quelque chose.
 *
 * On y vérifie aussi ce que les requêtes comptent, pas seulement qu'elles s'exécutent : une
 * requête syntaxiquement valide qui additionne les mauvaises lignes est un chiffre faux affiché
 * à un dirigeant.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import type { SqlExecutor } from '../../src/infra/db/sql-executor.ts';
import {
  PgContratRepository,
  PgDirectoryRepository,
  PgPilotageRepository,
} from '../../src/infra/db/pg-admin.ts';

const URL_TEST = process.env.DATABASE_URL_TEST;
const decrire = URL_TEST ? describe : describe.skip;

let pool: pg.Pool;
let db: SqlExecutor;

let entityId: string;
let contractId: string;
let driverId: string;
let stationId: string;

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Un bon, dans l'état voulu, avec le paiement qui le finance.
 *
 * Le schéma refuse un bon sans paiement, et un bon consommé sans trace de qui l'a servi. Ces
 * contraintes sont voulues : la fixture s'y plie plutôt que de les contourner, sinon le test
 * porterait sur des lignes que la production ne produira jamais.
 */
async function bon(options: {
  montant: number;
  statut: 'EMIS' | 'CONSOMME' | 'ANNULE';
  emisA?: string;
  consommeA?: string | null;
  expireA?: string;
}): Promise<string> {
  const id = uuid();
  const paiementId = uuid();
  const consomme = options.statut === 'CONSOMME';

  await pool.query(
    `INSERT INTO driver_payments (id, driver_id, montant_xof, canal, reference, recu_a)
     VALUES ($1, $2, $3, 'WAVE_CHECKOUT', $4, now())`,
    [paiementId, driverId, options.montant, `cos-${paiementId}`],
  );

  await pool.query(
    `INSERT INTO fuel_vouchers (id, driver_id, payment_id, montant_xof, statut, emis_a, expire_a,
                                consomme_a, station_id, operateur_id, redemption_id,
                                motif_annulation, payment_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      driverId,
      paiementId,
      options.montant,
      options.statut,
      options.emisA ?? new Date().toISOString(),
      options.expireA ?? new Date(Date.now() + 86_400_000).toISOString(),
      consomme ? (options.consommeA ?? new Date().toISOString()) : null,
      consomme ? stationId : null,
      consomme ? 'pompiste-1' : null,
      consomme ? `red-${id}` : null,
      options.statut === 'ANNULE' ? 'annulé par le test' : null,
      `WAVE_CHECKOUT/${paiementId}`,
    ],
  );
  return id;
}

decrire('intégration PostgreSQL — administration', () => {
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
    await pool.query(`
      TRUNCATE voucher_deliveries, fuel_vouchers, checkout_sessions, driver_payments,
               card_transactions, api_tokens, cards, drivers, stations, operateurs,
               reconciliations, webhook_events, payment_intents, invoices,
               te_contracts, wave_transactions, entities, audit_events
      RESTART IDENTITY CASCADE
    `);

    entityId = uuid();
    contractId = uuid();
    driverId = uuid();
    stationId = uuid();

    await pool.query(`INSERT INTO entities (id, raison_sociale) VALUES ($1, 'Assur''Trans')`, [
      entityId,
    ]);
    await pool.query(
      `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                 delai_reglement_jours)
       VALUES ($1, $2, 'TE-1', 10000000, 30)`,
      [contractId, entityId],
    );
    await pool.query(
      `INSERT INTO drivers (id, entity_id, nom, msisdn)
       VALUES ($1, $2, 'Moussa Ndiaye', '+221770000001')`,
      [driverId, entityId],
    );
    await pool.query(`INSERT INTO stations (id, code, nom) VALUES ($1, 'ST-3', 'Dakar 3')`, [
      stationId,
    ]);
  });

  describe('contrat courant', () => {
    it('lit le contrat et ses seuils', async () => {
      const contrat = await new PgContratRepository(db).courant(entityId);

      expect(contrat).not.toBeNull();
      expect(contrat?.numeroCompte).toBe('TE-1');
      expect(contrat?.encoursAutorise).toBe(10_000_000);
      expect(contrat?.canalReglement).toBe('DRY_RUN');
    });

    it('retourne le plus récent quand l’entité en a plusieurs', async () => {
      // Un contrat renegocié ne remplace pas l'ancien en base : il s'ajoute.
      await pool.query(
        `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                   delai_reglement_jours, created_at)
         VALUES ($1, $2, 'TE-2', 20000000, 45, now() + interval '1 day')`,
        [uuid(), entityId],
      );

      const contrat = await new PgContratRepository(db).courant(entityId);

      expect(contrat?.numeroCompte).toBe('TE-2');
      expect(contrat?.encoursAutorise).toBe(20_000_000);
    });

    it('retourne null pour une entité sans contrat', async () => {
      const autre = uuid();
      await pool.query(`INSERT INTO entities (id, raison_sociale) VALUES ($1, 'Sans contrat')`, [
        autre,
      ]);

      expect(await new PgContratRepository(db).courant(autre)).toBeNull();
    });
  });

  describe('mesures de pilotage', () => {
    it('ne compte comme encours que les bons consommés', async () => {
      await bon({ montant: 20_000, statut: 'CONSOMME', consommeA: new Date().toISOString() });
      await bon({ montant: 50_000, statut: 'EMIS' });
      await bon({ montant: 30_000, statut: 'ANNULE' });

      const total = await new PgPilotageRepository(db).consommationNonFacturee(contractId);

      expect(total).toBe(20_000);
    });

    it('exclut du non facturé ce qui est déjà couvert par une facture', async () => {
      const avant = '2026-08-01T10:00:00.000Z';
      const apres = '2026-09-05T10:00:00.000Z';
      await pool.query(
        `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin,
                               montant_xof, date_emission, date_echeance, statut)
         VALUES ($1, $2, 'F-1', '2026-07-01', '2026-08-31', 100000,
                 '2026-09-01', '2026-09-30', 'OUVERTE')`,
        [uuid(), contractId],
      );
      await bon({ montant: 20_000, statut: 'CONSOMME', consommeA: avant });
      await bon({ montant: 35_000, statut: 'CONSOMME', consommeA: apres });

      const total = await new PgPilotageRepository(db).consommationNonFacturee(contractId);

      expect(total).toBe(35_000);
    });

    it('mesure le rythme sur la fenêtre demandée, sans la borne haute', async () => {
      await bon({ montant: 20_000, statut: 'CONSOMME', consommeA: '2026-07-01T10:00:00.000Z' });
      await bon({ montant: 35_000, statut: 'CONSOMME', consommeA: '2026-09-05T10:00:00.000Z' });

      const total = await new PgPilotageRepository(db).consommationSurFenetre(
        contractId,
        '2026-08-08T00:00:00.000Z',
      );

      expect(total).toBe(35_000);
    });

    it('ne compte en circulation que les bons émis non périmés', async () => {
      await bon({ montant: 20_000, statut: 'EMIS' });
      await bon({
        montant: 15_000,
        statut: 'EMIS',
        emisA: new Date(Date.now() - 90_000_000).toISOString(),
        expireA: new Date(Date.now() - 3_600_000).toISOString(),
      });
      await bon({ montant: 40_000, statut: 'CONSOMME', consommeA: new Date().toISOString() });

      const total = await new PgPilotageRepository(db).bonsEnCirculation();

      expect(total).toBe(20_000);
    });

    it('ne compte en impayé échu ni les factures réglées ni celles non échues', async () => {
      const facture = (numero: string, echeance: string, statut: string, montant: number) =>
        pool.query(
          `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin,
                                 montant_xof, date_emission, date_echeance, statut)
           VALUES ($1, $2, $3, '2026-07-01', '2026-07-31', $4, '2026-08-01', $5, $6)`,
          [uuid(), contractId, numero, montant, echeance, statut],
        );

      await facture('F-echue', '2026-08-01', 'OUVERTE', 100_000);
      await facture('F-reglee', '2026-08-01', 'REGLEE', 250_000);
      await facture('F-a-venir', '2027-01-01', 'OUVERTE', 400_000);

      const total = await new PgPilotageRepository(db).facturesEchuesImpayees(contractId);

      expect(total).toBe(100_000);
    });

    it('sépare l’émission de la consommation dans l’activité du jour', async () => {
      // Un bon émis hier et servi aujourd'hui compte dans la consommation du jour, pas dans
      // l'émission. Confondre les deux ferait apparaître du chiffre d'affaires deux fois.
      await bon({
        montant: 20_000,
        statut: 'CONSOMME',
        emisA: '2026-09-05T08:00:00.000Z',
        consommeA: new Date().toISOString(),
      });
      await bon({ montant: 50_000, statut: 'EMIS' });

      const activite = await new PgPilotageRepository(db).activiteDuJour(
        new Date(Date.now() - 3_600_000).toISOString(),
      );

      expect(activite).toEqual({
        bonsEmis: 1,
        montantEmis: 50_000,
        bonsConsommes: 1,
        montantConsomme: 20_000,
      });
    });
  });

  describe('incidents', () => {
    it('ne remonte rien sur une base saine', async () => {
      expect(await new PgPilotageRepository(db).incidents()).toEqual([]);
    });

    it('remonte un règlement en revue, un écart non résolu et un QR non parti', async () => {
      await pool.query(
        `INSERT INTO payment_intents (id, invoice_id, montant_xof, statut, idempotency_key,
                                      canal, prepare_par)
         VALUES ($1, $2, 500000, 'NEEDS_REVIEW', $3, 'DRY_RUN', 'admin-1')`,
        [uuid(), await facturePourIntention(), uuid()],
      );
      await pool.query(
        `INSERT INTO reconciliations (id, periode, invoice_id, payment_intent_id,
                                      wave_transaction_id, ecart_xof, statut)
         VALUES ($1, '2026-09-01', NULL, NULL, $2, 15000, 'VARIANCE')`,
        [uuid(), await mouvementWave()],
      );
      const bonId = await bon({ montant: 20_000, statut: 'EMIS' });
      await pool.query(
        // Un echec porte toujours sa raison : la contrainte `voucher_deliveries_echec_motive`
        // l'exige, parce qu'un incident sans motif ne se diagnostique pas six mois plus tard.
        `INSERT INTO voucher_deliveries (id, voucher_id, canal, destinataire, statut, erreur,
                                         tentatives)
         VALUES ($1, $2, 'WHATSAPP', '+221770000001', 'ECHEC', 'destinataire injoignable', 3)`,
        [uuid(), bonId],
      );

      const incidents = await new PgPilotageRepository(db).incidents();

      expect(incidents.map((i) => i.type).sort()).toEqual([
        'ECART_RAPPROCHEMENT',
        'ENVOI_QR_ECHOUE',
        'REGLEMENT_EN_REVUE',
      ]);
      expect(incidents.filter((i) => i.gravite === 'CRITIQUE')).toHaveLength(2);
    });

    it('ne remonte pas un écart déjà résolu', async () => {
      // La colonne s'appelle `resolu_at`. Une requête qui interroge `resolu_a` s'exécutait sans
      // erreur contre la doublure de test et faisait tomber le tableau de bord en production.
      await pool.query(
        `INSERT INTO reconciliations (id, periode, wave_transaction_id, ecart_xof, statut,
                                      resolu_par, resolu_at)
         VALUES ($1, '2026-09-01', $2, 15000, 'VARIANCE', 'admin', now())`,
        [uuid(), await mouvementWave()],
      );

      expect(await new PgPilotageRepository(db).incidents()).toEqual([]);
    });
  });

  describe('référentiel', () => {
    it('refuse un numéro déjà porté par un chauffeur', async () => {
      const depot = new PgDirectoryRepository(db);

      expect(await depot.numeroLibre('+221770000001')).toBe(false);
      expect(await depot.numeroLibre('+221770000099')).toBe(true);
    });

    it('refuse un numéro déjà porté par un opérateur', async () => {
      const depot = new PgDirectoryRepository(db);
      await depot.creerOperateur({
        id: uuid(),
        nom: 'Awa Fall',
        msisdn: '+221770000055',
        role: 'ADMIN',
        stationId: null,
        statut: 'ACTIF',
      });

      expect(await depot.numeroLibre('+221770000055')).toBe(false);
    });

    it('crée et relit un pompiste rattaché à sa station', async () => {
      const depot = new PgDirectoryRepository(db);
      const id = uuid();
      await depot.creerOperateur({
        id,
        nom: 'Ibrahima Sow',
        msisdn: '+221770000077',
        role: 'STATION_OPERATOR',
        stationId,
        statut: 'ACTIF',
      });

      const operateurs = await depot.listerOperateurs();

      expect(operateurs).toHaveLength(1);
      expect(operateurs[0]).toMatchObject({
        id,
        role: 'STATION_OPERATOR',
        stationId,
        statut: 'ACTIF',
      });
    });

    it('suspend un chauffeur sans toucher à ses bons', async () => {
      const depot = new PgDirectoryRepository(db);
      const bonId = await bon({ montant: 20_000, statut: 'EMIS' });

      expect(await depot.changerStatutChauffeur(driverId, 'SUSPENDU')).toBe(true);

      const chauffeurs = await depot.listerChauffeurs();
      expect(chauffeurs[0]?.statut).toBe('SUSPENDU');

      const r = await pool.query('SELECT statut FROM fuel_vouchers WHERE id = $1', [bonId]);
      expect(r.rows[0].statut).toBe('EMIS');
    });

    it('signale l’absence plutôt que de prétendre avoir modifié', async () => {
      const depot = new PgDirectoryRepository(db);

      expect(await depot.changerStatutChauffeur(uuid(), 'SUSPENDU')).toBe(false);
      expect(await depot.changerStatutOperateur(uuid(), 'SUSPENDU')).toBe(false);
    });

    it('trouve une station par son identifiant, et rien pour un inconnu', async () => {
      const depot = new PgDirectoryRepository(db);

      expect(await depot.trouverStation(stationId)).toMatchObject({ code: 'ST-3' });
      expect(await depot.trouverStation(uuid())).toBeNull();
    });
  });

  /** Une intention de règlement se rattache toujours à une facture (ADR-001). */
  async function facturePourIntention(): Promise<string> {
    const id = uuid();
    await pool.query(
      `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                             date_emission, date_echeance)
       VALUES ($1, $2, $3, '2026-08-01', '2026-08-31', 500000, '2026-09-01', '2026-09-30')`,
      [id, contractId, `F-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function mouvementWave(): Promise<string> {
    const id = uuid();
    await pool.query(
      `INSERT INTO wave_transactions (id, wave_tx_id, date_tx, sens, montant_xof, raw_json)
       VALUES ($1, $2, now(), 'OUT', 20000, '{}'::jsonb)`,
      [id, `pw-${id}`],
    );
    return id;
  }
});
