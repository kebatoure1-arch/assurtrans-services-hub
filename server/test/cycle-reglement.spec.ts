/**
 * Le cycle de règlement TotalEnergies, du côté applicatif.
 *
 * Le domaine sait déjà refuser qu'un préparateur approuve sa propre intention, exiger une
 * seconde authentification avant l'envoi, et classer toute ambiguïté en revue. Ce qu'il ne sait
 * pas, parce que c'est de l'orchestration : dans quel ordre écrire, quoi persister avant
 * l'appel sortant, et que faire d'une écriture conditionnelle refusée.
 *
 * C'est cette couche qui décide qu'un versement part. Les tests sont écrits avant elle.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import {
  type PaymentIntent,
  type PaymentIntentStatut,
  SecondFactorRequiredError,
  SegregationOfDutiesError,
  LimitExceededError,
} from '../src/domain/payment-intent.ts';
import type {
  Invoice,
  InvoiceRepository,
  PaymentIntentRepository,
} from '../src/ports/settlement.ts';
import type {
  SettlementChannel,
  SettlementOrder,
  SettlementResult,
} from '../src/ports/settlement-channel.ts';
import {
  CycleReglement,
  ConcurrenceError,
  FactureIntrouvableError,
  IntentionIntrouvableError,
} from '../src/application/settlement/cycle-reglement.ts';

const CONTRAT = 'contrat-1';
const FACTURE = 'facture-1';

function facture(surcharge: Partial<Invoice> = {}): Invoice {
  return {
    id: FACTURE,
    contractId: CONTRAT,
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

/** Dépôts en mémoire. Les écritures conditionnelles y sont vraies, pas simulées par un drapeau. */
class FauxFactures implements InvoiceRepository {
  readonly lignes = new Map<string, Invoice>();

  async findById(id: string) {
    return this.lignes.get(id) ?? null;
  }
  async saveIfNew(f: Invoice) {
    const doublon = [...this.lignes.values()].some(
      (x) => x.contractId === f.contractId && x.numero === f.numero,
    );
    if (doublon) return false;
    this.lignes.set(f.id, f);
    return true;
  }
  async lister(contractId: string, limite: number) {
    return [...this.lignes.values()].filter((f) => f.contractId === contractId).slice(0, limite);
  }
  async changerStatut(id: string, statut: Invoice['statut']) {
    const f = this.lignes.get(id);
    if (f === undefined) return false;
    this.lignes.set(id, { ...f, statut });
    return true;
  }
}

class FauxIntentions implements PaymentIntentRepository {
  readonly lignes = new Map<string, PaymentIntent>();
  /** Ce que le prochain `saveIfStatut` doit refuser, pour jouer une course. */
  refuserProchaineEcriture = false;

  async findById(id: string) {
    return this.lignes.get(id) ?? null;
  }
  async saveIfNew(i: PaymentIntent) {
    const vivante = [...this.lignes.values()].some(
      (x) => x.invoiceId === i.invoiceId && !['FAILED', 'CANCELLED'].includes(x.statut),
    );
    const cleDejaPrise =
      i.idempotencyKey !== null &&
      [...this.lignes.values()].some((x) => x.idempotencyKey === i.idempotencyKey);
    if (vivante || cleDejaPrise) return false;
    this.lignes.set(i.id, i);
    return true;
  }
  async saveIfStatut(i: PaymentIntent, statutAttendu: PaymentIntentStatut) {
    if (this.refuserProchaineEcriture) {
      this.refuserProchaineEcriture = false;
      return false;
    }
    const actuel = this.lignes.get(i.id);
    if (actuel === undefined || actuel.statut !== statutAttendu) return false;
    this.lignes.set(i.id, i);
    return true;
  }
  async lister(contractId: string, limite: number) {
    void contractId;
    return [...this.lignes.values()].slice(0, limite);
  }
  async cumulDuJour(contractId: string, jourIso: string, saufIntentId: string | null) {
    void contractId;
    void jourIso;
    return xof(
      [...this.lignes.values()]
        .filter((i) => i.id !== saufIntentId)
        .filter((i) => ['DISPATCHING', 'SENT', 'SETTLED', 'RECONCILED'].includes(i.statut))
        .reduce((total, i) => total + i.montant, 0),
    );
  }
}

class FauxCanal implements SettlementChannel {
  readonly canal = 'DRY_RUN' as const;
  readonly ordres: SettlementOrder[] = [];
  reponse: SettlementResult = { kind: 'ACCEPTED', payoutId: 'pw-1', canal: 'DRY_RUN' };

  async execute(order: SettlementOrder) {
    this.ordres.push(order);
    return this.reponse;
  }
  async lookup() {
    return { kind: 'UNKNOWN' as const, motif: 'non documenté' };
  }
}

let factures: FauxFactures;
let intentions: FauxIntentions;
let canal: FauxCanal;
let cycle: CycleReglement;
let clesTirees: string[];

function nouveauCycle(limites = { maxUnitaireXof: xof(5_000_000), maxQuotidienXof: xof(20_000_000) }) {
  clesTirees = [];
  let n = 0;
  return new CycleReglement({
    factures,
    intentions,
    canal,
    limites,
    referenceImputation: 'ATS/{numero}',
    horloge: () => '2026-09-08T10:00:00.000Z',
    nouvelId: () => `id-${(n += 1)}`,
    nouvelleCle: () => {
      const cle = `cle-${clesTirees.length + 1}`;
      clesTirees.push(cle);
      return cle;
    },
  });
}

/** Amène une intention jusqu'à APPROVED : trois personnes, trois gestes. */
async function jusquApprouve(montant = xof(2_000_000)) {
  await factures.saveIfNew(facture({ montant }));
  const intent = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });
  await cycle.soumettre({ intentId: intent.id, acteur: 'awa' });
  await cycle.approuver({ intentId: intent.id, acteur: 'omar' });
  return intent.id;
}

beforeEach(() => {
  factures = new FauxFactures();
  intentions = new FauxIntentions();
  canal = new FauxCanal();
  cycle = nouveauCycle();
});

describe('préparation', () => {
  it('reprend le montant de la facture, jamais un montant fourni', async () => {
    await factures.saveIfNew(facture({ montant: xof(2_000_000) }));

    const intent = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });

    expect(intent.montant).toBe(2_000_000);
    expect(intent.statut).toBe('DRAFT');
    expect(intent.preparePar).toBe('awa');
  });

  it('refuse une facture inconnue', async () => {
    await expect(cycle.preparer({ invoiceId: 'fantome', acteur: 'awa' })).rejects.toThrow(
      FactureIntrouvableError,
    );
  });

  it('ne crée pas deux intentions vivantes pour la même facture', async () => {
    // Deux administrateurs cliquent en même temps. Sans l'index unique partiel, la facture
    // partirait deux fois.
    await factures.saveIfNew(facture());
    await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });

    await expect(cycle.preparer({ invoiceId: FACTURE, acteur: 'omar' })).rejects.toThrow(
      ConcurrenceError,
    );
    expect(intentions.lignes.size).toBe(1);
  });

  it('accepte une nouvelle intention après annulation de la précédente', async () => {
    await factures.saveIfNew(facture());
    const premiere = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });
    await cycle.annuler({ intentId: premiere.id, acteur: 'awa' });

    const seconde = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });

    expect(seconde.id).not.toBe(premiere.id);
    expect(seconde.statut).toBe('DRAFT');
  });

  it('inscrit la référence d’imputation attendue par le fournisseur', async () => {
    await factures.saveIfNew(facture({ numero: 'TE-2026-08' }));

    const intent = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });

    expect(intent.referenceImputation).toBe('ATS/TE-2026-08');
  });
});

describe('approbation à quatre yeux', () => {
  it('refuse que le préparateur approuve sa propre intention', async () => {
    await factures.saveIfNew(facture());
    const intent = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });
    await cycle.soumettre({ intentId: intent.id, acteur: 'awa' });

    await expect(cycle.approuver({ intentId: intent.id, acteur: 'awa' })).rejects.toThrow(
      SegregationOfDutiesError,
    );

    expect((await intentions.findById(intent.id))?.statut).toBe('PENDING_APPROVAL');
  });

  it('enregistre qui a approuvé', async () => {
    const id = await jusquApprouve();

    const enregistre = await intentions.findById(id);
    expect(enregistre?.statut).toBe('APPROVED');
    expect(enregistre?.approuvePar).toBe('omar');
  });

  it('refuse une approbation si quelqu’un est passé avant', async () => {
    await factures.saveIfNew(facture());
    const intent = await cycle.preparer({ invoiceId: FACTURE, acteur: 'awa' });
    await cycle.soumettre({ intentId: intent.id, acteur: 'awa' });
    intentions.refuserProchaineEcriture = true;

    await expect(cycle.approuver({ intentId: intent.id, acteur: 'omar' })).rejects.toThrow(
      ConcurrenceError,
    );
  });
});

describe('exécution', () => {
  it('exige la seconde authentification, et n’appelle pas le canal sans elle', async () => {
    const id = await jusquApprouve();

    await expect(
      cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: false }),
    ).rejects.toThrow(SecondFactorRequiredError);

    expect(canal.ordres).toHaveLength(0);
  });

  it('écrit DISPATCHING et la clé d’idempotence AVANT l’appel sortant', async () => {
    // L'invariant central : si le processus meurt pendant l'appel, la trace existe déjà et la
    // reprise sait qu'un ordre a peut-etre ete emis. L'ordre inverse perdrait de l'argent.
    const id = await jusquApprouve();
    const vus: (PaymentIntentStatut | 'APPEL')[] = [];

    canal.execute = async (order) => {
      vus.push('APPEL');
      const enBase = await intentions.findById(id);
      expect(enBase?.statut).toBe('DISPATCHING');
      expect(enBase?.idempotencyKey).toBe(order.idempotencyKey);
      return { kind: 'ACCEPTED', payoutId: 'pw-1', canal: 'DRY_RUN' };
    };

    await cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true });

    expect(vus).toEqual(['APPEL']);
    expect((await intentions.findById(id))?.statut).toBe('SENT');
  });

  it('transmet au canal le montant de la base et la référence d’imputation', async () => {
    const id = await jusquApprouve(xof(2_000_000));

    await cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true });

    expect(canal.ordres).toHaveLength(1);
    expect(canal.ordres[0]).toMatchObject({
      intentId: id,
      montant: 2_000_000,
      referenceImputation: 'ATS/TE-2026-08',
    });
  });

  it('classe en revue une réponse ambiguë, sans réessayer', async () => {
    const id = await jusquApprouve();
    canal.reponse = { kind: 'AMBIGUOUS', motif: 'délai dépassé', canal: 'DRY_RUN' };

    const r = await cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true });

    expect(r.statut).toBe('NEEDS_REVIEW');
    expect(canal.ordres).toHaveLength(1);
    const enBase = await intentions.findById(id);
    expect(enBase?.statut).toBe('NEEDS_REVIEW');
    expect(enBase?.motifReview).toContain('délai dépassé');
  });

  it('marque FAILED un refus franc du fournisseur', async () => {
    const id = await jusquApprouve();
    canal.reponse = { kind: 'REJECTED', motif: 'bénéficiaire inconnu', canal: 'DRY_RUN' };

    const r = await cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true });

    expect(r.statut).toBe('FAILED');
  });

  it('refuse au-delà du plafond unitaire, sans appeler le canal', async () => {
    cycle = nouveauCycle({ maxUnitaireXof: xof(1_000_000), maxQuotidienXof: xof(20_000_000) });
    const id = await jusquApprouve(xof(2_000_000));

    await expect(
      cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true }),
    ).rejects.toThrow(LimitExceededError);

    expect(canal.ordres).toHaveLength(0);
  });

  it('refuse au-delà du plafond quotidien, cumul des envois du jour compris', async () => {
    cycle = nouveauCycle({ maxUnitaireXof: xof(5_000_000), maxQuotidienXof: xof(3_000_000) });
    await factures.saveIfNew(facture({ id: 'f-hier', numero: 'TE-2026-07', montant: xof(2_000_000) }));
    const deja = await cycle.preparer({ invoiceId: 'f-hier', acteur: 'awa' });
    await cycle.soumettre({ intentId: deja.id, acteur: 'awa' });
    await cycle.approuver({ intentId: deja.id, acteur: 'omar' });
    await cycle.executer({ intentId: deja.id, acteur: 'fatou', secondFactorVerifie: true });

    const id = await jusquApprouve(xof(2_000_000));

    await expect(
      cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true }),
    ).rejects.toThrow(LimitExceededError);
    expect(canal.ordres).toHaveLength(1);
  });

  it('n’appelle pas le canal une seconde fois si quelqu’un a exécuté entre-temps', async () => {
    const id = await jusquApprouve();
    intentions.refuserProchaineEcriture = true;

    await expect(
      cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true }),
    ).rejects.toThrow(ConcurrenceError);

    expect(canal.ordres).toHaveLength(0);
  });

  it('refuse d’exécuter une intention inconnue', async () => {
    await expect(
      cycle.executer({ intentId: 'fantome', acteur: 'fatou', secondFactorVerifie: true }),
    ).rejects.toThrow(IntentionIntrouvableError);
  });
});

describe('confirmation et rapprochement', () => {
  async function jusquEnvoye() {
    const id = await jusquApprouve();
    await cycle.executer({ intentId: id, acteur: 'fatou', secondFactorVerifie: true });
    return id;
  }

  it('un règlement au montant exact passe en SETTLED', async () => {
    const id = await jusquEnvoye();

    await cycle.confirmer({ intentId: id, montantRegle: xof(2_000_000) });

    const enBase = await intentions.findById(id);
    expect(enBase?.statut).toBe('SETTLED');
    expect(enBase?.ecartXof).toBe(0);
  });

  it('un montant réglé différent laisse l’écart visible, signe compris', async () => {
    // Un écart ne se rattrape pas silencieusement : il se voit, et il bloque le cycle suivant.
    //
    // Le signe suit `delta(attendu, constate) = attendu - constate` : un écart POSITIF veut dire
    // qu'on a réglé MOINS que dû. La convention se lit à l'envers de l'intuition, d'où ce test.
    const id = await jusquEnvoye();

    await cycle.confirmer({ intentId: id, montantRegle: xof(1_900_000) });

    const manque = await intentions.findById(id);
    expect(manque?.statut).toBe('VARIANCE');
    expect(manque?.ecartXof).toBe(100_000);
  });

  it('un trop-versé porte l’écart de signe opposé', async () => {
    const id = await jusquEnvoye();

    await cycle.confirmer({ intentId: id, montantRegle: xof(2_100_000) });

    const trop = await intentions.findById(id);
    expect(trop?.statut).toBe('VARIANCE');
    expect(trop?.ecartXof).toBe(-100_000);
  });

  it('cinq rejeux de la même confirmation ne produisent qu’une transition', async () => {
    const id = await jusquEnvoye();

    for (let n = 0; n < 5; n += 1) {
      await cycle.confirmer({ intentId: id, montantRegle: xof(2_000_000) });
    }

    expect((await intentions.findById(id))?.statut).toBe('SETTLED');
  });

  it('marque la facture réglée une fois le rapprochement fait', async () => {
    const id = await jusquEnvoye();
    await cycle.confirmer({ intentId: id, montantRegle: xof(2_000_000) });

    await cycle.rapprocher({ intentId: id, acteur: 'omar' });

    expect((await intentions.findById(id))?.statut).toBe('RECONCILED');
    expect((await factures.findById(FACTURE))?.statut).toBe('REGLEE');
  });
});

describe('enregistrement d’une facture', () => {
  it('refuse deux fois le même numéro sur un contrat', async () => {
    await cycle.enregistrerFacture({ ...facture(), id: 'f-1' });

    await expect(cycle.enregistrerFacture({ ...facture(), id: 'f-2' })).rejects.toThrow(
      ConcurrenceError,
    );
    expect(factures.lignes.size).toBe(1);
  });
});
