/**
 * Le rapprochement, du côté applicatif.
 *
 * Le domaine sait classer depuis le premier jour ; il n'avait jamais rien à classer. Ce que
 * cette couche ajoute, et que le domaine ne peut pas savoir :
 *
 *  - qu'un relevé vide n'est pas un rapprochement réussi, et qu'il faut le dire ;
 *  - qu'un rejeu remplace, mais ne piétine pas la décision d'un humain ;
 *  - qu'un écart non résolu bloque réellement l'ordonnancement du cycle suivant — sans quoi
 *    `bloqueCycleSuivant` ne serait qu'un booléen d'affichage.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import type { ReconInvoice, ReconIntent, ReconLine, ReconWaveTx } from '../src/domain/reconciliation.ts';
import type {
  LigneRangee,
  RapprochementRepository,
  SourcesDuRapprochement,
} from '../src/ports/rapprochement.ts';
import { RapprocherLaPeriode, ReleveVideError } from '../src/application/rapprocher.ts';

const CONTRAT = 'contrat-1';
const PERIODE = '2026-08-31';

function facture(surcharge: Partial<ReconInvoice> = {}): ReconInvoice {
  return {
    id: 'f-1',
    numero: 'TE-2026-08',
    montantXof: xof(2_000_000),
    dateEcheance: '2026-08-30',
    ...surcharge,
  };
}

function intention(surcharge: Partial<ReconIntent> = {}): ReconIntent {
  return {
    id: 'i-1',
    invoiceId: 'f-1',
    montantXof: xof(2_000_000),
    statut: 'SENT',
    wavePayoutId: 'pw-1',
    ...surcharge,
  };
}

function mouvement(surcharge: Partial<ReconWaveTx> = {}): ReconWaveTx {
  return {
    id: 'w-1',
    waveTxId: 'pw-1',
    sens: 'OUT',
    montantXof: xof(2_000_000),
    contrepartie: 'TotalEnergies',
    ...surcharge,
  };
}

class FauxSources implements SourcesDuRapprochement {
  factures: ReconInvoice[] = [];
  intentions: ReconIntent[] = [];
  mouvements: ReconWaveTx[] = [];
  bornesRecues: { debut: string; fin: string } | null = null;

  async facturesEchuesAu() {
    return this.factures;
  }
  async intentionsDesFactures(ids: readonly string[]) {
    return this.intentions.filter((i) => ids.includes(i.invoiceId));
  }
  async releve(debut: string, fin: string) {
    this.bornesRecues = { debut, fin };
    return this.mouvements;
  }
}

class FauxRangement implements RapprochementRepository {
  lignes: LigneRangee[] = [];
  readonly remplacements: { periode: string; nombre: number }[] = [];
  bloquantes = false;

  async remplacerPourPeriode(periode: string, lignes: readonly ReconLine[]) {
    this.remplacements.push({ periode, nombre: lignes.length });
    // Les lignes déjà résolues survivent : c'est la règle qu'on veut vérifier.
    const resolues = this.lignes.filter((l) => l.periode === periode && l.resoluPar !== null);
    this.lignes = [
      ...this.lignes.filter((l) => l.periode !== periode),
      ...resolues,
      ...lignes.map((l, n) => ({
        ...l,
        id: `r-${n}`,
        periode,
        resoluPar: null,
        resoluA: null,
        note: null,
      })),
    ];
  }
  async listerPourPeriode(periode: string) {
    return this.lignes.filter((l) => l.periode === periode);
  }
  async resoudre(id: string, acteur: string, note: string) {
    const l = this.lignes.find((x) => x.id === id);
    if (l === undefined || l.resoluPar !== null) return false;
    Object.assign(l, { resoluPar: acteur, resoluA: '2026-09-10T12:00:00.000Z', note });
    return true;
  }
  async resteDesLignesBloquantes() {
    return this.bloquantes;
  }
}

let sources: FauxSources;
let rangement: FauxRangement;
let traces: string[];
let rapprocher: RapprocherLaPeriode;

beforeEach(() => {
  sources = new FauxSources();
  rangement = new FauxRangement();
  traces = [];
  rapprocher = new RapprocherLaPeriode({
    sources,
    rangement,
    contractId: CONTRAT,
    horloge: () => '2026-09-10T12:00:00.000Z',
    audit: {
      async enregistrer(e) {
        traces.push(e.action);
      },
    },
  });
});

describe('un relevé vide', () => {
  it('refuse de rapprocher, plutôt que de tout classer en écart', async () => {
    // Sans relevé, chaque règlement envoyé ressort en « payout introuvable ». C'est
    // techniquement exact et pratiquement trompeur : l'administrateur croirait à douze
    // anomalies alors qu'il a simplement oublié de saisir le relevé.
    sources.factures = [facture()];
    sources.intentions = [intention()];
    sources.mouvements = [];

    await expect(
      rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' }),
    ).rejects.toThrow(ReleveVideError);

    expect(rangement.remplacements).toHaveLength(0);
  });

  it('accepte un relevé vide s’il n’y a rien non plus à rapprocher', async () => {
    // Un mois sans facture et sans mouvement est un mois rapproché, pas un mois bloqué.
    const r = await rapprocher.executer({
      periode: PERIODE,
      toleranceXof: xof(0),
      acteur: 'awa',
    });

    expect(r.resume).toMatchObject({ matched: 0, variance: 0, orphan: 0 });
    expect(r.bloqueCycleSuivant).toBe(false);
  });
});

describe('le rapprochement lui-même', () => {
  it('lettre une facture réglée au bon montant', async () => {
    sources.factures = [facture()];
    sources.intentions = [intention()];
    sources.mouvements = [mouvement()];

    const r = await rapprocher.executer({
      periode: PERIODE,
      toleranceXof: xof(0),
      acteur: 'awa',
    });

    expect(r.resume).toMatchObject({ matched: 1, variance: 0, orphan: 0 });
    expect(r.bloqueCycleSuivant).toBe(false);
  });

  it('signale une sortie de fonds sans intention', async () => {
    // De l'argent est parti du portefeuille sans que rien ne l'ait ordonné.
    sources.mouvements = [mouvement({ waveTxId: 'pw-inconnu' })];

    const r = await rapprocher.executer({
      periode: PERIODE,
      toleranceXof: xof(0),
      acteur: 'awa',
    });

    expect(r.resume.orphan).toBe(1);
    expect(r.bloqueCycleSuivant).toBe(true);
  });

  it('borne le relevé sur la période demandée', async () => {
    sources.mouvements = [mouvement()];

    await rapprocher.executer({ periode: '2026-08-31', toleranceXof: xof(0), acteur: 'awa' });

    // Le premier du mois au dernier : une période de rapprochement est un mois civil.
    expect(sources.bornesRecues).toEqual({ debut: '2026-08-01', fin: '2026-08-31' });
  });

  it('transmet la tolérance au domaine', async () => {
    sources.factures = [facture()];
    sources.intentions = [intention()];
    sources.mouvements = [mouvement({ montantXof: xof(1_999_500) })];

    const r = await rapprocher.executer({
      periode: PERIODE,
      toleranceXof: xof(1_000),
      acteur: 'awa',
    });

    expect(r.resume.matched).toBe(1);
    expect(r.lignes[0].toleranceXof).toBe(1_000);
  });

  it('classe en écart au-delà de la tolérance', async () => {
    sources.factures = [facture()];
    sources.intentions = [intention()];
    sources.mouvements = [mouvement({ montantXof: xof(1_900_000) })];

    const r = await rapprocher.executer({
      periode: PERIODE,
      toleranceXof: xof(1_000),
      acteur: 'awa',
    });

    expect(r.resume.variance).toBe(1);
    expect(r.bloqueCycleSuivant).toBe(true);
  });
});

describe('rejouer', () => {
  it('remplace au lieu d’accumuler', async () => {
    sources.factures = [facture()];
    sources.intentions = [intention()];
    sources.mouvements = [mouvement()];

    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });
    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });

    expect(await rangement.listerPourPeriode(PERIODE)).toHaveLength(1);
  });

  it('ne piétine pas une ligne déjà résolue par un humain', async () => {
    // Effacer la décision de quelqu'un parce qu'on a recalculé est la pire façon de perdre du
    // travail : la personne a enquêté, elle a tranché, cela ne se rejoue pas.
    sources.mouvements = [mouvement({ waveTxId: 'pw-inconnu' })];
    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });
    const ligne = (await rangement.listerPourPeriode(PERIODE))[0];
    await rangement.resoudre(ligne.id, 'omar', 'frais bancaires, vu avec Wave');

    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });

    const apres = await rangement.listerPourPeriode(PERIODE);
    expect(apres.some((l) => l.resoluPar === 'omar')).toBe(true);
  });

  it('laisse une trace de chaque rapprochement', async () => {
    sources.mouvements = [mouvement()];

    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });

    expect(traces).toContain('RAPPROCHEMENT_EXECUTE');
  });
});

describe('résoudre une ligne', () => {
  it('enregistre qui a tranché et pourquoi', async () => {
    sources.mouvements = [mouvement({ waveTxId: 'pw-inconnu' })];
    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });
    const ligne = (await rangement.listerPourPeriode(PERIODE))[0];

    await rapprocher.resoudre({ id: ligne.id, acteur: 'omar', note: 'frais bancaires' });

    const apres = (await rangement.listerPourPeriode(PERIODE))[0];
    expect(apres).toMatchObject({ resoluPar: 'omar', note: 'frais bancaires' });
    expect(traces).toContain('ECART_RESOLU');
  });

  it('refuse une note vide : un écart se résout avec une raison', async () => {
    sources.mouvements = [mouvement({ waveTxId: 'pw-inconnu' })];
    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });
    const ligne = (await rangement.listerPourPeriode(PERIODE))[0];

    await expect(
      rapprocher.resoudre({ id: ligne.id, acteur: 'omar', note: '   ' }),
    ).rejects.toThrow(/note/i);
  });

  it('signale une ligne déjà résolue plutôt que de la résoudre deux fois', async () => {
    sources.mouvements = [mouvement({ waveTxId: 'pw-inconnu' })];
    await rapprocher.executer({ periode: PERIODE, toleranceXof: xof(0), acteur: 'awa' });
    const ligne = (await rangement.listerPourPeriode(PERIODE))[0];
    await rapprocher.resoudre({ id: ligne.id, acteur: 'omar', note: 'vu' });

    await expect(
      rapprocher.resoudre({ id: ligne.id, acteur: 'fatou', note: 'vu aussi' }),
    ).rejects.toThrow(/déjà|introuvable/i);
  });
});
