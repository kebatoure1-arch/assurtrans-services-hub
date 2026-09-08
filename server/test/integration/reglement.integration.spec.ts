/**
 * Le cycle de règlement contre une vraie base.
 *
 * Les tests applicatifs prouvent l'orchestration contre des dépôts en mémoire. Ils ne peuvent
 * pas prouver ce qui compte le plus ici : que la base refuse réellement la deuxième intention,
 * la deuxième exécution, la deuxième facture. Ces garanties ne sont pas dans le code — elles
 * sont dans trois index et deux contraintes CHECK, et un index qui n'existerait pas laisserait
 * passer un second versement sans que rien ne le signale.
 *
 * Chaque test ci-dessous correspond à un franc qui partirait deux fois si la contrainte sautait.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { xof } from '../../src/domain/money.ts';
import { createDraft, type PaymentIntent } from '../../src/domain/payment-intent.ts';
import type { SqlExecutor } from '../../src/infra/db/sql-executor.ts';
import {
  PgInvoiceRepository,
  PgPaymentIntentRepository,
} from '../../src/infra/db/pg-settlement.ts';
import type { Invoice } from '../../src/ports/settlement.ts';

const URL_TEST = process.env.DATABASE_URL_TEST;
const decrire = URL_TEST ? describe : describe.skip;

let pool: pg.Pool;
let db: SqlExecutor;
let factures: PgInvoiceRepository;
let intentions: PgPaymentIntentRepository;

let entityId: string;
let contractId: string;

function uuid(): string {
  return crypto.randomUUID();
}

function facture(surcharge: Partial<Invoice> = {}): Invoice {
  return {
    id: uuid(),
    contractId,
    numero: 'TE-2026-08',
    periodeDebut: '2026-08-01',
    periodeFin: '2026-08-31',
    montant: xof(2_000_000),
    dateEmission: '2026-09-01',
    dateEcheance: '2026-09-30',
    statut: 'OUVERTE',
    ...surcharge,
  };
}

function brouillon(invoiceId: string, surcharge: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    ...createDraft({
      id: uuid(),
      invoiceId,
      montant: xof(2_000_000),
      canal: 'DRY_RUN',
      preparePar: 'awa',
      referenceImputation: 'ATS/TE-2026-08',
    }),
    ...surcharge,
  };
}

decrire('intégration PostgreSQL — cycle de règlement', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_TEST });
    db = {
      query: async (texte, params = []) => {
        const r = await pool.query(texte, params as unknown[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
    };
    factures = new PgInvoiceRepository(db);
    intentions = new PgPaymentIntentRepository(db);
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

  describe('factures', () => {
    it('écrit puis relit une facture sans altérer le montant', async () => {
      const f = facture();

      expect(await factures.saveIfNew(f)).toBe(true);

      const relue = await factures.findById(f.id);
      expect(relue).toEqual(f);
    });

    it('refuse deux fois le même numéro sur un contrat', async () => {
      await factures.saveIfNew(facture({ numero: 'TE-2026-08' }));

      expect(await factures.saveIfNew(facture({ numero: 'TE-2026-08' }))).toBe(false);
    });

    it('accepte le même numéro sur un autre contrat', async () => {
      // Deux entités peuvent recevoir des factures numérotées pareil par le fournisseur.
      const autre = uuid();
      await pool.query(
        `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                   delai_reglement_jours)
         VALUES ($1, $2, 'TE-2', 5000000, 30)`,
        [autre, entityId],
      );
      await factures.saveIfNew(facture());

      expect(await factures.saveIfNew(facture({ contractId: autre }))).toBe(true);
    });
  });

  describe('une seule intention vivante par facture', () => {
    it('refuse la seconde intention sur la même facture', async () => {
      // Deux administrateurs cliquent « préparer » au même instant. Sans l'index unique
      // partiel, la facture partirait deux fois.
      const f = facture();
      await factures.saveIfNew(f);

      expect(await intentions.saveIfNew(brouillon(f.id))).toBe(true);
      expect(await intentions.saveIfNew(brouillon(f.id))).toBe(false);
    });

    it('libère la place après annulation', async () => {
      const f = facture();
      await factures.saveIfNew(f);
      const premiere = brouillon(f.id);
      await intentions.saveIfNew(premiere);
      await intentions.saveIfStatut({ ...premiere, statut: 'CANCELLED' }, 'DRAFT');

      expect(await intentions.saveIfNew(brouillon(f.id))).toBe(true);
    });

    it('libère la place après échec', async () => {
      // On passe par DISPATCHING : le domaine n'atteint jamais FAILED depuis DRAFT, et la
      // contrainte `pi_cle_des_lenvoi` refuse une intention echouee sans cle d'idempotence.
      // Une fixture qui sauterait l'etape testerait une ligne que la production ne produit pas.
      const f = facture();
      await factures.saveIfNew(f);
      const premiere = brouillon(f.id);
      await intentions.saveIfNew(premiere);
      const partie = {
        ...premiere,
        statut: 'DISPATCHING' as const,
        idempotencyKey: uuid(),
        executePar: 'fatou',
      };
      await intentions.saveIfStatut(partie, 'DRAFT');
      await intentions.saveIfStatut(
        { ...partie, statut: 'FAILED', motifReview: 'bénéficiaire inconnu' },
        'DISPATCHING',
      );

      expect(await intentions.saveIfNew(brouillon(f.id))).toBe(true);
    });
  });

  describe('écriture conditionnelle sur le statut', () => {
    it('deux exécutions simultanées : une seule passe', async () => {
      // Le cœur du sujet. La seconde `UPDATE ... WHERE statut = 'APPROVED'` ne trouve plus rien
      // et ne touche aucune ligne — c'est cela, et rien d'autre, qui empêche un double
      // versement.
      const f = facture();
      await factures.saveIfNew(f);
      const i = brouillon(f.id);
      await intentions.saveIfNew(i);
      const approuvee = { ...i, statut: 'APPROVED' as const, approuvePar: 'omar' };
      await intentions.saveIfStatut(approuvee, 'DRAFT');

      const premier = await intentions.saveIfStatut(
        { ...approuvee, statut: 'DISPATCHING', idempotencyKey: uuid(), executePar: 'fatou' },
        'APPROVED',
      );
      const second = await intentions.saveIfStatut(
        { ...approuvee, statut: 'DISPATCHING', idempotencyKey: uuid(), executePar: 'ibrahima' },
        'APPROVED',
      );

      expect([premier, second]).toEqual([true, false]);
      const enBase = await intentions.findById(i.id);
      expect(enBase?.executePar).toBe('fatou');
    });

    it('la clé d’idempotence, une fois posée, ne s’efface pas', async () => {
      // Les transitions suivantes ne la portent pas ; un UPDATE naïf la remettrait à NULL et la
      // reprise après crash perdrait le seul moyen de retrouver l'ordre chez le fournisseur.
      const f = facture();
      await factures.saveIfNew(f);
      const i = brouillon(f.id);
      await intentions.saveIfNew(i);
      const cle = uuid();
      const envoyee = {
        ...i,
        statut: 'DISPATCHING' as const,
        idempotencyKey: cle,
        executePar: 'fatou',
      };
      await intentions.saveIfStatut(envoyee, 'DRAFT');

      await intentions.saveIfStatut(
        { ...envoyee, statut: 'SENT', idempotencyKey: null, wavePayoutId: 'pw-1' },
        'DISPATCHING',
      );

      expect((await intentions.findById(i.id))?.idempotencyKey).toBe(cle);
    });

    it('refuse deux intentions portant la même clé d’idempotence', async () => {
      // Cinq rejeux du job d'échéance ⇒ exactement une intention (§11).
      const cle = uuid();
      const f1 = facture({ numero: 'TE-A' });
      const f2 = facture({ numero: 'TE-B' });
      await factures.saveIfNew(f1);
      await factures.saveIfNew(f2);

      expect(await intentions.saveIfNew(brouillon(f1.id, { idempotencyKey: cle }))).toBe(true);
      expect(await intentions.saveIfNew(brouillon(f2.id, { idempotencyKey: cle }))).toBe(false);
    });
  });

  describe('montant réglé et écart', () => {
    async function envoyee(montant = xof(2_000_000)) {
      const f = facture({ montant });
      await factures.saveIfNew(f);
      const i = { ...brouillon(f.id), montant };
      await intentions.saveIfNew(i);
      const partie = {
        ...i,
        statut: 'SENT' as const,
        idempotencyKey: uuid(),
        executePar: 'fatou',
        wavePayoutId: 'pw-1',
      };
      await intentions.saveIfStatut(partie, 'DRAFT');
      return partie;
    }

    it('relit le montant réglé et l’écart sans perdre le signe', async () => {
      const i = await envoyee();

      await intentions.saveIfStatut(
        { ...i, statut: 'VARIANCE', montantRegle: xof(1_900_000), ecartXof: 100_000 as never },
        'SENT',
      );

      const enBase = await intentions.findById(i.id);
      expect(enBase?.montantRegle).toBe(1_900_000);
      expect(enBase?.ecartXof).toBe(100_000);
    });

    it('conserve un écart négatif, seul montant du schéma qui a le droit de l’être', async () => {
      const i = await envoyee();

      await intentions.saveIfStatut(
        { ...i, statut: 'VARIANCE', montantRegle: xof(2_100_000), ecartXof: -100_000 as never },
        'SENT',
      );

      expect((await intentions.findById(i.id))?.ecartXof).toBe(-100_000);
    });

    it('refuse en base un écart qui ne correspond pas au montant réglé', async () => {
      // Un chiffre faux au rapprochement se voit ici, pas devant un dirigeant.
      const i = await envoyee();

      await expect(
        intentions.saveIfStatut(
          { ...i, statut: 'VARIANCE', montantRegle: xof(1_900_000), ecartXof: 42 as never },
          'SENT',
        ),
      ).rejects.toThrow(/pi_ecart_coherent/);
    });

    it('refuse en base une intention envoyée sans clé d’idempotence', async () => {
      const f = facture();
      await factures.saveIfNew(f);
      const i = brouillon(f.id);
      await intentions.saveIfNew(i);

      await expect(
        intentions.saveIfStatut({ ...i, statut: 'DISPATCHING', executePar: 'fatou' }, 'DRAFT'),
      ).rejects.toThrow(/pi_cle_des_lenvoi/);
    });
  });

  describe('cumul du jour', () => {
    async function intentionEnvoyee(numero: string, montant: number, statut: string) {
      const f = facture({ numero, montant: xof(montant) });
      await factures.saveIfNew(f);
      const i = { ...brouillon(f.id), montant: xof(montant) };
      await intentions.saveIfNew(i);
      await pool.query(
        `UPDATE payment_intents
            SET statut = $2, idempotency_key = $3, execute_par = 'fatou', ts_dispatching = now()
          WHERE id = $1`,
        [i.id, statut, uuid()],
      );
      return i.id;
    }

    it('additionne ce qui est parti aujourd’hui', async () => {
      await intentionEnvoyee('TE-A', 1_000_000, 'SENT');
      await intentionEnvoyee('TE-B', 500_000, 'SETTLED');

      const total = await intentions.cumulDuJour(contractId, '2026-09-08', null);

      expect(total).toBe(1_500_000);
    });

    it('compte les intentions en revue : elles ont peut-être donné lieu à un versement', async () => {
      // Les ignorer permettrait de dépasser le plafond en enchaînant les ambiguïtés.
      await intentionEnvoyee('TE-A', 1_000_000, 'NEEDS_REVIEW');

      expect(await intentions.cumulDuJour(contractId, '2026-09-08', null)).toBe(1_000_000);
    });

    it('ignore ce qui n’est jamais parti', async () => {
      await intentionEnvoyee('TE-A', 1_000_000, 'CANCELLED');
      await intentionEnvoyee('TE-B', 700_000, 'FAILED');

      expect(await intentions.cumulDuJour(contractId, '2026-09-08', null)).toBe(0);
    });

    it('exclut l’intention courante, pour ne pas la compter deux fois', async () => {
      const id = await intentionEnvoyee('TE-A', 1_000_000, 'SENT');

      expect(await intentions.cumulDuJour(contractId, '2026-09-08', id)).toBe(0);
    });

    it('ne compte pas la veille', async () => {
      const id = await intentionEnvoyee('TE-A', 1_000_000, 'SENT');
      await pool.query(
        `UPDATE payment_intents SET ts_dispatching = now() - interval '2 days' WHERE id = $1`,
        [id],
      );

      expect(await intentions.cumulDuJour(contractId, '2026-09-08', null)).toBe(0);
    });

    it('ne compte pas le contrat du voisin', async () => {
      await intentionEnvoyee('TE-A', 1_000_000, 'SENT');
      const autre = uuid();
      await pool.query(
        `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                   delai_reglement_jours)
         VALUES ($1, $2, 'TE-9', 5000000, 30)`,
        [autre, entityId],
      );

      expect(await intentions.cumulDuJour(autre, '2026-09-08', null)).toBe(0);
    });
  });

  describe('listes', () => {
    it('rend les intentions du contrat, la plus récente d’abord', async () => {
      const f1 = facture({ numero: 'TE-A' });
      const f2 = facture({ numero: 'TE-B' });
      await factures.saveIfNew(f1);
      await factures.saveIfNew(f2);
      const i1 = brouillon(f1.id);
      await intentions.saveIfNew(i1);
      await pool.query(
        `UPDATE payment_intents SET ts_created = now() - interval '1 hour' WHERE id = $1`,
        [i1.id],
      );
      const i2 = brouillon(f2.id);
      await intentions.saveIfNew(i2);

      const liste = await intentions.lister(contractId, 10);

      expect(liste.map((i) => i.id)).toEqual([i2.id, i1.id]);
    });
  });
});
