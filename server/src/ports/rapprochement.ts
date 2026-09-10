/**
 * Ports du rapprochement à trois voies.
 *
 * Le domaine sait rapprocher depuis longtemps ; il n'avait jamais rien à rapprocher. Ces ports
 * lui apportent les trois voies et rangent ce qu'il en conclut.
 *
 * **La troisième voie n'a pas de source automatique.** Aucun endpoint Wave documenté ne rend le
 * relevé du portefeuille — `WaveClient.fetchStatement` lève, et c'est voulu : deviner une URL
 * ferait rapprocher des chiffres inventés. Le relevé s'alimente donc à la main, ligne par
 * ligne, depuis le portail Wave Business. Le jour où l'endpoint sera documenté, un importateur
 * remplacera la saisie sans que le domaine bouge.
 *
 * Conséquence à ne pas masquer : un relevé vide n'est pas un rapprochement réussi. Sans lui,
 * chaque règlement envoyé ressort en écart — ce qui est la bonne réponse, mais l'interface doit
 * dire pourquoi.
 */

import type { XOF } from '../domain/money.ts';
import type {
  ReconInvoice,
  ReconIntent,
  ReconLine,
  ReconWaveTx,
} from '../domain/reconciliation.ts';

/** Une ligne du relevé du portefeuille, telle qu'elle est saisie ou importée. */
export interface MouvementReleve {
  readonly id: string;
  readonly waveTxId: string;
  readonly dateTx: string;
  readonly sens: 'IN' | 'OUT';
  readonly montant: XOF;
  readonly contrepartie: string | null;
}

export interface ReleveRepository {
  /** `false` si ce `waveTxId` figure déjà : saisir deux fois la même ligne ne la double pas. */
  ajouterSiNouveau(mouvement: MouvementReleve): Promise<boolean>;
  listerSurPeriode(debut: string, fin: string): Promise<readonly MouvementReleve[]>;
  supprimer(id: string): Promise<boolean>;
}

/** Les trois voies, telles que le domaine les attend. */
export interface SourcesDuRapprochement {
  facturesEchuesAu(contractId: string, fin: string): Promise<readonly ReconInvoice[]>;
  intentionsDesFactures(idsFactures: readonly string[]): Promise<readonly ReconIntent[]>;
  releve(debut: string, fin: string): Promise<readonly ReconWaveTx[]>;
}

/** Une ligne rangée, avec ce que le domaine ignore : qui l'a résolue, et quand. */
export interface LigneRangee extends ReconLine {
  readonly id: string;
  readonly periode: string;
  readonly resoluPar: string | null;
  readonly resoluA: string | null;
  readonly note: string | null;
}

export interface RapprochementRepository {
  /**
   * Remplace le rapprochement d'une période.
   *
   * Rejouer un rapprochement doit donner le même état, pas une accumulation de lignes. Les
   * lignes déjà résolues à la main sont conservées : effacer la décision d'un humain parce
   * qu'on a recalculé serait la pire des façons de perdre du travail.
   */
  remplacerPourPeriode(periode: string, lignes: readonly ReconLine[]): Promise<void>;

  listerPourPeriode(periode: string): Promise<readonly LigneRangee[]>;

  /** Marque une ligne traitée. `false` si elle n'existe pas ou est déjà résolue. */
  resoudre(id: string, acteur: string, note: string): Promise<boolean>;

  /**
   * Y a-t-il un écart ou un orphelin non résolu ?
   *
   * C'est la question du §11 : tant que la réponse est oui, le cycle suivant ne s'ordonnance
   * pas. Sans cette lecture, `bloqueCycleSuivant` ne serait qu'un booléen d'affichage.
   */
  resteDesLignesBloquantes(): Promise<boolean>;
}
