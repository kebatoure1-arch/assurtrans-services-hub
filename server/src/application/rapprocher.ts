/**
 * Cas d'usage : rapprocher une période.
 *
 * Le rapprochement à trois voies était écrit et testé depuis le premier jour, et n'avait jamais
 * rapproché quoi que ce soit : rien ne l'appelait. Ce fichier lui apporte les trois voies et
 * range ce qu'il en conclut.
 *
 * Deux décisions valent d'être expliquées.
 *
 * **Un relevé vide n'est pas un rapprochement réussi.** Sans lui, chaque règlement envoyé
 * ressort en « payout introuvable » : techniquement exact, pratiquement trompeur. L'utilisateur
 * verrait douze anomalies là où il a simplement oublié de saisir le relevé. On refuse donc de
 * rapprocher, sauf s'il n'y avait rien non plus à rapprocher — un mois sans facture et sans
 * mouvement est un mois rapproché, pas un mois bloqué.
 *
 * **Rejouer remplace, mais ne piétine pas.** Un rapprochement se recalcule autant qu'on veut et
 * doit donner le même état. En revanche, une ligne qu'un humain a enquêtée et tranchée ne se
 * rejoue pas : effacer sa décision parce qu'on a recalculé serait la pire façon de perdre du
 * travail.
 */

import type { XOF } from '../domain/money.ts';
import { reconcile, type ReconResult } from '../domain/reconciliation.ts';
import type { AuditLogger } from '../ports/audit.ts';
import type {
  LigneRangee,
  RapprochementRepository,
  SourcesDuRapprochement,
} from '../ports/rapprochement.ts';

/**
 * Aucun mouvement au relevé, alors qu'il y a quelque chose à rapprocher.
 *
 * Distinct d'une erreur technique : c'est une étape manquante, et le message doit dire laquelle.
 */
export class ReleveVideError extends Error {
  constructor() {
    super(
      'aucun mouvement au relevé pour cette période : saisissez le relevé du portefeuille ' +
        'avant de rapprocher, sinon tout règlement envoyé ressortira en écart',
    );
    this.name = 'ReleveVideError';
  }
}

export class LigneIntrouvableError extends Error {
  constructor(id: string) {
    super(`ligne de rapprochement ${id} introuvable, ou déjà résolue`);
    this.name = 'LigneIntrouvableError';
  }
}

export class NoteRequiseError extends Error {
  constructor() {
    super('une note est requise : un écart se résout avec une raison, pas d’un clic');
    this.name = 'NoteRequiseError';
  }
}

export interface RapprochementDeps {
  readonly sources: SourcesDuRapprochement;
  readonly rangement: RapprochementRepository;
  readonly contractId: string;
  readonly horloge: () => string;
  readonly audit?: AuditLogger;
}

export class RapprocherLaPeriode {
  constructor(private readonly deps: RapprochementDeps) {}

  async executer(input: {
    /** Dernier jour de la période, `YYYY-MM-DD`. */
    periode: string;
    toleranceXof: XOF;
    acteur: string;
  }): Promise<ReconResult> {
    const { debut, fin } = bornesDuMois(input.periode);

    const factures = await this.deps.sources.facturesEchuesAu(this.deps.contractId, fin);
    const intentions = await this.deps.sources.intentionsDesFactures(factures.map((f) => f.id));
    const releve = await this.deps.sources.releve(debut, fin);

    // Rien au relevé alors qu'il y a des factures ou des intentions à confronter : c'est une
    // étape oubliée, pas un résultat.
    if (releve.length === 0 && (factures.length > 0 || intentions.length > 0)) {
      throw new ReleveVideError();
    }

    const resultat = reconcile({
      periode: input.periode,
      toleranceXof: input.toleranceXof,
      invoices: factures,
      intents: intentions,
      waveTransactions: releve,
    });

    await this.deps.rangement.remplacerPourPeriode(input.periode, resultat.lignes);

    await this.deps.audit?.enregistrer({
      actor: input.acteur,
      action: 'RAPPROCHEMENT_EXECUTE',
      targetType: 'reconciliation',
      targetId: input.periode,
      payload: {
        ...resultat.resume,
        bloqueCycleSuivant: resultat.bloqueCycleSuivant,
        toleranceXof: input.toleranceXof,
      },
    });

    return resultat;
  }

  async lignes(periode: string): Promise<readonly LigneRangee[]> {
    return this.deps.rangement.listerPourPeriode(periode);
  }

  /**
   * Clôt une ligne à la main.
   *
   * La note n'est pas une formalité : c'est ce qui rend le journal relisible six mois plus tard,
   * quand personne ne se souvient pourquoi cet écart de 1 200 francs était acceptable.
   */
  async resoudre(input: { id: string; acteur: string; note: string }): Promise<void> {
    const note = input.note.trim();
    if (note === '') throw new NoteRequiseError();

    const fait = await this.deps.rangement.resoudre(input.id, input.acteur, note);
    if (!fait) throw new LigneIntrouvableError(input.id);

    await this.deps.audit?.enregistrer({
      actor: input.acteur,
      action: 'ECART_RESOLU',
      targetType: 'reconciliation',
      targetId: input.id,
      payload: { note },
    });
  }

  /**
   * Le cycle suivant peut-il s'ordonnancer ?
   *
   * §11 : un écart ou un orphelin non résolu le bloque. Sans cette lecture, l'indicateur du
   * domaine ne serait qu'un booléen d'affichage.
   */
  async cycleBloque(): Promise<boolean> {
    return this.deps.rangement.resteDesLignesBloquantes();
  }
}

/**
 * Un mois civil, du premier au dernier jour.
 *
 * La période est désignée par son dernier jour — c'est ainsi qu'on parle d'un arrêté. On en
 * déduit le premier plutôt que de demander deux dates qui pourraient se contredire.
 */
function bornesDuMois(fin: string): { debut: string; fin: string } {
  return { debut: `${fin.slice(0, 7)}-01`, fin };
}
