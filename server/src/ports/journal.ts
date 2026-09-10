/**
 * Port de consultation du journal d'audit.
 *
 * La table est en ajout seul depuis la première migration : deux règles PostgreSQL y annulent
 * silencieusement tout UPDATE et tout DELETE. Ce port ne fait que lire — il n'existe aucune
 * route d'écriture depuis l'extérieur, et il n'en existera pas.
 *
 * **Le payload n'est pas conservé, seule son empreinte.** C'est une décision inscrite dans le
 * schéma : un journal qui accumule des numéros de téléphone devient lui-même un fichier à
 * protéger, et se conserve pourtant plus longtemps que le reste. L'empreinte prouve qu'une
 * action portait bien tel contenu si on le représente plus tard, sans le garder entre-temps.
 * L'écran doit donc le dire, et ne jamais laisser croire qu'on peut « ouvrir » un événement.
 */

export interface EvenementJournal {
  /** Identifiant séquentiel. Sert aussi de curseur : il est monotone par construction. */
  readonly id: string;
  readonly ts: string;
  /** Identifiant du compte, ou un nom de mécanisme : `reprise`, `envoi`, `amorcage`. */
  readonly acteur: string;
  /** Nom lisible du compte, quand il s'agit d'une personne connue. */
  readonly acteurNom: string | null;
  readonly action: string;
  readonly cibleType: string;
  readonly cibleId: string;
  /** SHA-256 du payload. Jamais le payload. */
  readonly empreinte: string;
}

export interface FiltreJournal {
  readonly action?: string;
  readonly acteur?: string;
  readonly cibleId?: string;
  /** Bornes incluses, au jour près. */
  readonly depuis?: string;
  readonly jusqua?: string;
}

export interface PageJournal {
  readonly evenements: readonly EvenementJournal[];
  /**
   * Curseur de la page suivante, ou `null` s'il n'y en a pas.
   *
   * Pagination par clé et non par décalage : un `OFFSET` sur une table qui grossit pendant la
   * lecture saute ou répète des lignes. Sur un journal d'audit, une ligne sautée est une ligne
   * qu'on ne verra jamais.
   */
  readonly curseurSuivant: string | null;
}

export interface JournalAudit {
  consulter(filtre: FiltreJournal, curseur: string | null, limite: number): Promise<PageJournal>;
  /** Actions présentes dans le journal, pour proposer un filtre qui ne rend pas le vide. */
  actionsConnues(): Promise<readonly string[]>;
}
