/**
 * Worker d'envoi des bons.
 *
 * Le chauffeur a payé. Tant qu'il n'a pas son QR, il a payé pour rien — c'est la seule marche
 * du parcours que le système ne franchissait pas. Ce fichier décrit ce que le worker doit
 * faire, et surtout ce qu'il ne doit pas faire.
 *
 * Trois exigences dominent :
 *
 *  1. **Le jeton se reconstruit, il ne se relit pas.** La file ne le conserve pas : un jeton
 *     vaut du carburant, et une table de journalisation d'envois n'est pas l'endroit où
 *     l'entreposer. Le worker le refabrique à partir du bon, au moment d'expédier.
 *  2. **On n'expédie que ce qui sert encore.** Envoyer le QR d'un bon déjà consommé ou annulé
 *     n'apporte rien au chauffeur et lui fait présenter un code qui sera refusé.
 *  3. **Le jeton ne fuit nulle part.** Ni dans un message d'erreur, ni dans la file, ni dans
 *     un journal. Il ne vit que le temps de l'appel à l'expéditeur.
 *
 * Réessayer est ici légitime, contrairement au règlement : un bon est à usage unique et son
 * jeton est déterministe. Deux envois donnent deux fois le même code, dont un seul servira.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import { emitVoucher, type FuelVoucher } from '../src/domain/fuel-voucher.ts';
import type { EnvoiAFaire, VoucherDeliveryQueue } from '../src/ports/repositories.ts';
import type { BonAExpedier, ExpediteurDeBon, ResultatEnvoi } from '../src/ports/envoi.ts';
import type { VerrouTravaux } from '../src/ports/verrou.ts';
import { EnvoyerLesBons } from '../src/application/envoyer-les-bons.ts';

const MAINTENANT = '2026-09-10T10:00:00.000Z';
const CHAUFFEUR = '+221770000011';

function bon(surcharge: Partial<FuelVoucher> = {}): FuelVoucher {
  return {
    ...emitVoucher({
      id: 'BON-1',
      driverId: 'chauffeur-1',
      montant: xof(20_000),
      emisA: '2026-09-10T08:00:00.000Z',
      validiteHeures: 24,
      paymentRef: 'WAVE_CHECKOUT/cos-1',
    }),
    ...surcharge,
  };
}

class FauxFile implements VoucherDeliveryQueue {
  readonly lignes = new Map<string, EnvoiAFaire & { statut: string; motif?: string }>();
  readonly envoyes: { id: string; reference: string | null }[] = [];
  readonly echecs: { id: string; motif: string }[] = [];
  maxTentativesRecu: number | null = null;

  async enqueue() {
    return 'e-1';
  }
  async reclamer(limite: number, maxTentatives: number) {
    this.maxTentativesRecu = maxTentatives;
    return [...this.lignes.values()]
      .filter((l) => l.statut === 'EN_ATTENTE' && l.tentatives < maxTentatives)
      .slice(0, limite)
      .map(({ id, voucherId, destinataire, tentatives }) => ({
        id,
        voucherId,
        destinataire,
        tentatives,
      }));
  }
  async marquerEnvoye(id: string, reference: string | null) {
    this.envoyes.push({ id, reference });
    const l = this.lignes.get(id);
    if (l !== undefined) this.lignes.set(id, { ...l, statut: 'ENVOYE' });
  }
  async marquerEchec(id: string, motif: string) {
    this.echecs.push({ id, motif });
    const l = this.lignes.get(id);
    if (l !== undefined) this.lignes.set(id, { ...l, statut: 'ECHEC', motif });
  }

  poser(id: string, voucherId: string, tentatives = 0) {
    this.lignes.set(id, {
      id,
      voucherId,
      destinataire: CHAUFFEUR,
      tentatives,
      statut: 'EN_ATTENTE',
    });
  }
}

class FauxExpediteur implements ExpediteurDeBon {
  readonly canal = 'LOG';
  readonly expedies: BonAExpedier[] = [];
  reponse: ResultatEnvoi = { kind: 'ENVOYE', reference: 'msg-1' };
  leve = false;

  async envoyer(b: BonAExpedier) {
    this.expedies.push(b);
    if (this.leve) throw new Error('passerelle injoignable');
    return this.reponse;
  }
}

class FauxVerrou implements VerrouTravaux {
  accorde = true;
  readonly rendus: string[] = [];
  async prendre() {
    return this.accorde;
  }
  async rendre(nom: string) {
    this.rendus.push(nom);
  }
}

let file: FauxFile;
let expediteur: FauxExpediteur;
let verrou: FauxVerrou;
let bons: Map<string, FuelVoucher>;
let worker: EnvoyerLesBons;
let jetonsSignes: string[];

beforeEach(() => {
  file = new FauxFile();
  expediteur = new FauxExpediteur();
  verrou = new FauxVerrou();
  bons = new Map([['BON-1', bon()]]);
  jetonsSignes = [];

  worker = new EnvoyerLesBons({
    file,
    expediteur,
    verrou,
    bons: {
      async findById(id: string) {
        return bons.get(id) ?? null;
      },
    },
    signer: {
      sign(charge) {
        const jeton = `AT1.${charge.id}.signature`;
        jetonsSignes.push(jeton);
        return jeton;
      },
    },
    horloge: () => MAINTENANT,
    maxTentatives: 3,
  });
});

describe('le jeton', () => {
  it('se reconstruit à partir du bon, pas de la file', async () => {
    // La file ne le conserve pas : un jeton vaut du carburant.
    file.poser('e-1', 'BON-1');

    await worker.executer();

    expect(jetonsSignes).toHaveLength(1);
    expect(expediteur.expedies[0].token).toBe('AT1.BON-1.signature');
  });

  it('porte le montant et la péremption du bon en base', async () => {
    file.poser('e-1', 'BON-1');

    await worker.executer();

    expect(expediteur.expedies[0]).toMatchObject({
      voucherId: 'BON-1',
      destinataire: CHAUFFEUR,
      montant: 20_000,
      expireA: '2026-09-11T08:00:00.000Z',
    });
  });

  it('ne fuit jamais dans un motif d’échec', async () => {
    // Un motif d'echec finit dans une colonne, dans un journal, parfois dans un ticket. Le
    // jeton n'a rien a y faire.
    file.poser('e-1', 'BON-1');
    expediteur.reponse = { kind: 'ECHEC', motif: 'destinataire injoignable' };

    await worker.executer();

    expect(file.echecs[0].motif).not.toContain('AT1.');
    expect(file.echecs[0].motif).not.toContain('signature');
  });
});

describe('ce qu’on n’expédie pas', () => {
  it('renonce à un bon déjà consommé', async () => {
    // Lui envoyer son QR lui ferait presenter un code qui sera refuse a la pompe.
    bons.set('BON-1', {
      ...bon(),
      statut: 'CONSOMME',
      consommeA: MAINTENANT,
      stationId: 's-1',
      operateurId: 'p-1',
      redemptionId: 'r-1',
    });
    file.poser('e-1', 'BON-1');

    await worker.executer();

    expect(expediteur.expedies).toHaveLength(0);
    expect(file.echecs[0].motif).toMatch(/consomm/i);
  });

  it('renonce à un bon annulé', async () => {
    bons.set('BON-1', { ...bon(), statut: 'ANNULE', motifAnnulation: 'paiement contesté' });
    file.poser('e-1', 'BON-1');

    await worker.executer();

    expect(expediteur.expedies).toHaveLength(0);
  });

  it('renonce à un bon périmé', async () => {
    // Un QR perime ne sert a rien, et l'envoyer donne au chauffeur l'illusion du contraire.
    bons.set('BON-1', { ...bon(), expireA: '2026-09-10T09:00:00.000Z' });
    file.poser('e-1', 'BON-1');

    await worker.executer();

    expect(expediteur.expedies).toHaveLength(0);
    expect(file.echecs[0].motif).toMatch(/périmé|expir/i);
  });

  it('renonce à un bon introuvable sans faire tomber le passage', async () => {
    file.poser('e-1', 'BON-FANTOME');
    file.poser('e-2', 'BON-1');

    const bilan = await worker.executer();

    expect(expediteur.expedies.map((b) => b.voucherId)).toEqual(['BON-1']);
    expect(bilan).toMatchObject({ envoyes: 1, echoues: 1 });
  });
});

describe('le sort de chaque envoi', () => {
  it('marque envoyé, avec la référence du fournisseur', async () => {
    file.poser('e-1', 'BON-1');
    expediteur.reponse = { kind: 'ENVOYE', reference: 'wamid.42' };

    const bilan = await worker.executer();

    expect(file.envoyes).toEqual([{ id: 'e-1', reference: 'wamid.42' }]);
    expect(bilan).toMatchObject({ reclames: 1, envoyes: 1, echoues: 0 });
  });

  it('accepte un fournisseur qui ne rend aucune référence', async () => {
    file.poser('e-1', 'BON-1');
    expediteur.reponse = { kind: 'ENVOYE', reference: null };

    await worker.executer();

    expect(file.envoyes).toEqual([{ id: 'e-1', reference: null }]);
  });

  it('marque échec avec le motif du fournisseur', async () => {
    file.poser('e-1', 'BON-1');
    expediteur.reponse = { kind: 'ECHEC', motif: 'numéro non inscrit sur WhatsApp' };

    await worker.executer();

    expect(file.echecs[0].motif).toContain('numéro non inscrit');
  });

  it('traite une exception de l’expéditeur comme un échec, pas comme une panne', async () => {
    // Une exception qui remonte ferait tomber le passage et bloquerait les envois suivants.
    file.poser('e-1', 'BON-1');
    expediteur.leve = true;

    const bilan = await worker.executer();

    expect(bilan).toMatchObject({ echoues: 1 });
    expect(file.echecs[0].motif).toContain('passerelle injoignable');
  });

  it('poursuit après un échec : les suivants ne sont pas pris en otage', async () => {
    bons.set('BON-2', { ...bon(), id: 'BON-2' });
    file.poser('e-1', 'BON-1');
    file.poser('e-2', 'BON-2');
    let premier = true;
    expediteur.envoyer = async (b) => {
      expediteur.expedies.push(b);
      if (premier) {
        premier = false;
        return { kind: 'ECHEC', motif: 'coupure' };
      }
      return { kind: 'ENVOYE', reference: 'msg-2' };
    };

    const bilan = await worker.executer();

    expect(bilan).toMatchObject({ reclames: 2, envoyes: 1, echoues: 1 });
  });
});

describe('bornes et concurrence', () => {
  it('transmet le plafond de tentatives à la file', async () => {
    // On ne réessaie pas indéfiniment un numéro qui ne répond pas : la ligne reste visible en
    // incident, et un humain reprend la main.
    file.poser('e-1', 'BON-1');

    await worker.executer();

    expect(file.maxTentativesRecu).toBe(3);
  });

  it('ne fait rien quand un autre exemplaire tient le verrou', async () => {
    verrou.accorde = false;
    file.poser('e-1', 'BON-1');

    const bilan = await worker.executer();

    expect(bilan).toEqual({ reclames: 0, envoyes: 0, echoues: 0, ignore: 'verrou' });
    expect(expediteur.expedies).toHaveLength(0);
  });

  it('rend le verrou même si tout échoue', async () => {
    file.poser('e-1', 'BON-1');
    expediteur.leve = true;

    await worker.executer();

    expect(verrou.rendus).toEqual(['envoi-des-bons']);
  });

  it('ne réclame rien quand la file est vide', async () => {
    const bilan = await worker.executer();

    expect(bilan).toMatchObject({ reclames: 0, envoyes: 0, echoues: 0 });
    expect(expediteur.expedies).toHaveLength(0);
  });
});
