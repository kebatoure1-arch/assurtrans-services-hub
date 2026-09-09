/**
 * Reprise des envois interrompus.
 *
 * Une intention laissée en `DISPATCHING` par un crash est le seul endroit du système où de
 * l'argent peut disparaître silencieusement : l'ordre est peut-être parti, personne ne le sait,
 * et rien ne le rappelle. L'invariant « clé d'idempotence écrite avant l'appel » existe
 * précisément pour rendre cette reprise possible ; encore faut-il quelqu'un pour s'en servir.
 *
 * La règle qui gouverne tout ce fichier : **on ne renvoie jamais**. La reprise interroge le
 * fournisseur et enregistre ce qu'il répond. Quand il ne répond pas clairement, un humain
 * prend le relais. Un réenvoi automatique sur une réponse ambiguë paierait deux fois.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import { createDraft, type PaymentIntent } from '../src/domain/payment-intent.ts';
import type { PaymentIntentRepository } from '../src/ports/settlement.ts';
import type {
  SettlementChannel,
  SettlementLookup,
  SettlementOrder,
} from '../src/ports/settlement-channel.ts';
import type { VerrouTravaux } from '../src/ports/verrou.ts';
import { ReprendreEnvoisInterrompus } from '../src/application/settlement/reprise.ts';

const MAINTENANT = '2026-09-09T12:00:00.000Z';
const CLE = 'cle-1';

function interrompue(surcharge: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    ...createDraft({
      id: 'i-1',
      invoiceId: 'f-1',
      montant: xof(2_000_000),
      canal: 'B2B',
      preparePar: 'awa',
      referenceImputation: 'ASSURTRANS/TE-2026-08',
    }),
    statut: 'DISPATCHING',
    idempotencyKey: CLE,
    executePar: 'fatou',
    ...surcharge,
  };
}

class FauxIntentions implements PaymentIntentRepository {
  readonly lignes = new Map<string, PaymentIntent>();
  /** Ce que `listerInterrompues` doit rendre, et l'âge minimal qu'on lui a demandé. */
  avantRecu: string | null = null;
  /** Force le refus de la prochaine écriture conditionnelle, pour jouer une course. */
  refuserProchaineEcriture = false;

  async findById(id: string) {
    return this.lignes.get(id) ?? null;
  }
  async saveIfNew(i: PaymentIntent) {
    this.lignes.set(i.id, i);
    return true;
  }
  async saveIfStatut(i: PaymentIntent, attendu: PaymentIntent['statut']) {
    if (this.refuserProchaineEcriture) {
      this.refuserProchaineEcriture = false;
      return false;
    }
    const actuel = this.lignes.get(i.id);
    if (actuel === undefined || actuel.statut !== attendu) return false;
    this.lignes.set(i.id, i);
    return true;
  }
  async lister() {
    return [...this.lignes.values()];
  }
  async cumulDuJour() {
    return xof(0);
  }
  async listerInterrompues(avant: string, limite: number) {
    this.avantRecu = avant;
    return [...this.lignes.values()].filter((i) => i.statut === 'DISPATCHING').slice(0, limite);
  }
}

class FauxCanal implements SettlementChannel {
  readonly canal = 'B2B' as const;
  readonly envois: SettlementOrder[] = [];
  readonly consultations: { order: SettlementOrder; payoutId?: string | null }[] = [];
  reponse: SettlementLookup = { kind: 'UNKNOWN', motif: 'non documenté' };

  async execute(order: SettlementOrder) {
    this.envois.push(order);
    return { kind: 'ACCEPTED' as const, payoutId: 'pw-jamais', canal: this.canal };
  }
  async lookup(order: SettlementOrder, payoutId?: string | null) {
    this.consultations.push({ order, payoutId });
    return this.reponse;
  }
}

class FauxVerrou implements VerrouTravaux {
  accorde = true;
  readonly pris: string[] = [];
  readonly rendus: string[] = [];

  async prendre(nom: string) {
    this.pris.push(nom);
    return this.accorde;
  }
  async rendre(nom: string) {
    this.rendus.push(nom);
  }
}

let intentions: FauxIntentions;
let canal: FauxCanal;
let verrou: FauxVerrou;
let reprise: ReprendreEnvoisInterrompus;

beforeEach(() => {
  intentions = new FauxIntentions();
  canal = new FauxCanal();
  verrou = new FauxVerrou();
  reprise = new ReprendreEnvoisInterrompus({
    intentions,
    canal,
    verrou,
    horloge: () => MAINTENANT,
    delaiAvantRepriseSecondes: 120,
  });
});

describe('ce qu’on ne fait jamais', () => {
  it('ne réémet aucun ordre, quelle que soit la réponse', async () => {
    // La règle qui gouverne tout le reste. Un réenvoi sur une reprise paierait deux fois.
    for (const reponse of [
      { kind: 'FOUND', payoutId: 'pw-1', statut: 'succeeded', montant: xof(2_000_000) },
      { kind: 'NOT_FOUND' },
      { kind: 'UNKNOWN', motif: 'réseau' },
    ] as SettlementLookup[]) {
      intentions.lignes.clear();
      await intentions.saveIfNew(interrompue());
      canal.reponse = reponse;

      await reprise.executer();
    }

    expect(canal.envois).toHaveLength(0);
  });

  it('ne touche pas une intention trop récente : un envoi est peut-être en cours', async () => {
    // Sans ce délai, la reprise volerait l'intention d'un appel encore en vol et le ferait
    // échouer sur une écriture conditionnelle refusée.
    await intentions.saveIfNew(interrompue());

    await reprise.executer();

    expect(intentions.avantRecu).toBe('2026-09-09T11:58:00.000Z');
  });

  it('ne fait rien quand un autre exemplaire tient le verrou', async () => {
    verrou.accorde = false;
    await intentions.saveIfNew(interrompue());

    const bilan = await reprise.executer();

    expect(bilan).toEqual({ examinees: 0, retrouvees: 0, enRevue: 0, ignoree: 'verrou' });
    expect(canal.consultations).toHaveLength(0);
  });

  it('rend le verrou même si la consultation échoue', async () => {
    await intentions.saveIfNew(interrompue());
    canal.lookup = async () => {
      throw new Error('transport mort');
    };

    await reprise.executer();

    expect(verrou.rendus).toEqual(['reprise-envois']);
  });
});

describe('le fournisseur connaît l’ordre', () => {
  it('enregistre le paiement et passe en SENT', async () => {
    await intentions.saveIfNew(interrompue());
    canal.reponse = {
      kind: 'FOUND',
      payoutId: 'pw-1',
      statut: 'succeeded',
      montant: xof(2_000_000),
    };

    const bilan = await reprise.executer();

    expect(bilan).toMatchObject({ examinees: 1, retrouvees: 1, enRevue: 0 });
    const apres = await intentions.findById('i-1');
    expect(apres?.statut).toBe('SENT');
    expect(apres?.wavePayoutId).toBe('pw-1');
  });

  it('transmet la clé d’idempotence à la consultation', async () => {
    // C'est tout ce qui relie notre trace à l'ordre chez le fournisseur.
    await intentions.saveIfNew(interrompue());
    canal.reponse = { kind: 'FOUND', payoutId: 'pw-1', statut: 'succeeded', montant: null };

    await reprise.executer();

    expect(canal.consultations[0].order).toMatchObject({
      intentId: 'i-1',
      idempotencyKey: CLE,
      montant: 2_000_000,
    });
  });

  it('met en revue un montant différent de celui qu’on avait ordonné', async () => {
    // De l'argent est parti pour une somme que nous n'avons pas décidée. Aucune reprise
    // automatique ne peut rattraper cela.
    await intentions.saveIfNew(interrompue());
    canal.reponse = {
      kind: 'FOUND',
      payoutId: 'pw-1',
      statut: 'succeeded',
      montant: xof(1_800_000),
    };

    const bilan = await reprise.executer();

    expect(bilan).toMatchObject({ retrouvees: 0, enRevue: 1 });
    const apres = await intentions.findById('i-1');
    expect(apres?.statut).toBe('NEEDS_REVIEW');
    expect(apres?.motifReview).toMatch(/1 ?800 ?000|1800000/);
  });

  it('accepte un montant que le fournisseur ne donne pas', async () => {
    // Tous les fournisseurs ne rendent pas le montant. L'absence n'est pas un écart.
    await intentions.saveIfNew(interrompue());
    canal.reponse = { kind: 'FOUND', payoutId: 'pw-1', statut: 'succeeded', montant: null };

    const bilan = await reprise.executer();

    expect(bilan).toMatchObject({ retrouvees: 1, enRevue: 0 });
    expect((await intentions.findById('i-1'))?.statut).toBe('SENT');
  });
});

describe('le fournisseur ne répond pas clairement', () => {
  it('met en revue une consultation impossible, en disant pourquoi', async () => {
    await intentions.saveIfNew(interrompue());
    canal.reponse = { kind: 'UNKNOWN', motif: 'aucune recherche par Idempotency-Key documentée' };

    const bilan = await reprise.executer();

    expect(bilan).toMatchObject({ retrouvees: 0, enRevue: 1 });
    const apres = await intentions.findById('i-1');
    expect(apres?.statut).toBe('NEEDS_REVIEW');
    expect(apres?.motifReview).toContain('Idempotency-Key');
  });

  it('met en revue une consultation qui lève, sans laisser l’intention bloquée', async () => {
    await intentions.saveIfNew(interrompue());
    canal.lookup = async () => {
      throw new Error('transport mort');
    };

    await reprise.executer();

    const apres = await intentions.findById('i-1');
    expect(apres?.statut).toBe('NEEDS_REVIEW');
    expect(apres?.motifReview).toContain('transport mort');
  });

  it('met en revue un ordre que le fournisseur dit ne pas connaître', async () => {
    // On ne conclut PAS « rien n'est parti ». Conclure l'absence demanderait de faire confiance
    // à un endpoint dont le contrat n'est pas documenté ; se tromper laisserait une facture
    // rejouable alors qu'elle a déjà été payée.
    await intentions.saveIfNew(interrompue({ wavePayoutId: 'pw-perdu' }));
    canal.reponse = { kind: 'NOT_FOUND' };

    const bilan = await reprise.executer();

    expect(bilan).toMatchObject({ enRevue: 1 });
    const apres = await intentions.findById('i-1');
    expect(apres?.statut).toBe('NEEDS_REVIEW');
    expect(apres?.motifReview).toMatch(/pw-perdu/);
  });
});

describe('plusieurs intentions', () => {
  it('traite chacune et compte le bilan', async () => {
    await intentions.saveIfNew(interrompue({ id: 'i-1' }));
    await intentions.saveIfNew(interrompue({ id: 'i-2' }));
    canal.reponse = { kind: 'FOUND', payoutId: 'pw-1', statut: 'succeeded', montant: null };

    const bilan = await reprise.executer();

    expect(bilan).toMatchObject({ examinees: 2, retrouvees: 2, enRevue: 0 });
  });

  it('poursuit après une intention qui échoue à s’écrire', async () => {
    // Une course perdue sur la première ne doit pas laisser les suivantes bloquées.
    await intentions.saveIfNew(interrompue({ id: 'i-1' }));
    await intentions.saveIfNew(interrompue({ id: 'i-2' }));
    canal.reponse = { kind: 'FOUND', payoutId: 'pw-1', statut: 'succeeded', montant: null };
    intentions.refuserProchaineEcriture = true;

    const bilan = await reprise.executer();

    expect(bilan.examinees).toBe(2);
    expect(bilan.retrouvees).toBe(1);
  });
});
