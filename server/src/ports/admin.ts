/**
 * Ports du référentiel et du pilotage, côté administration.
 */

import type { ApiRole } from '../infra/auth/api-tokens.ts';
import type { XOF } from '../domain/money.ts';

export type StatutFiche = 'ACTIF' | 'SUSPENDU';

export interface FicheChauffeur {
  readonly id: string;
  readonly nom: string;
  readonly msisdn: string;
  readonly statut: StatutFiche;
}

export interface FicheStation {
  readonly id: string;
  readonly code: string;
  readonly nom: string;
  readonly ville: string | null;
  readonly statut: 'ACTIVE' | 'INACTIVE';
}

export interface FicheOperateur {
  readonly id: string;
  readonly nom: string;
  readonly msisdn: string;
  readonly role: ApiRole;
  readonly stationId: string | null;
  readonly statut: StatutFiche;
}

export interface FicheEntite {
  readonly id: string;
  readonly raisonSociale: string;
  readonly ninea: string | null;
  readonly rccm: string | null;
}

export interface DirectoryRepository {
  creerEntite(fiche: FicheEntite): Promise<void>;
  listerChauffeurs(): Promise<readonly FicheChauffeur[]>;
  listerStations(): Promise<readonly FicheStation[]>;
  listerOperateurs(): Promise<readonly FicheOperateur[]>;
  /** Un numéro n'appartient qu'à une seule personne, chauffeurs et opérateurs confondus. */
  numeroLibre(msisdn: string): Promise<boolean>;
  trouverStation(id: string): Promise<FicheStation | null>;
  creerChauffeur(fiche: FicheChauffeur, entityId: string): Promise<void>;
  creerStation(fiche: FicheStation): Promise<void>;
  creerOperateur(fiche: FicheOperateur): Promise<void>;
  /** `false` si la fiche n'existe pas : l'appelant doit le signaler, pas l'ignorer. */
  changerStatutChauffeur(id: string, statut: StatutFiche): Promise<boolean>;
  changerStatutOperateur(id: string, statut: StatutFiche): Promise<boolean>;
}

/** Contrat TotalEnergies : ce qui alimente le moteur d'encours. */
export interface ContratTe {
  readonly id: string;
  readonly numeroCompte: string;
  readonly encoursAutorise: XOF;
  readonly delaiReglementJours: number;
  readonly seuilAlertePct: number;
  readonly seuilBlocagePct: number;
  readonly canalReglement: 'DRY_RUN' | 'B2B' | 'MOBILE';
  /**
   * Beneficiaire designe par TotalEnergies, selon le canal retenu. `null` tant que le parametre
   * n'a pas ete obtenu par ecrit (§14, parametre 1) — auquel cas seul DRY_RUN est possible.
   */
  readonly teB2bId: string | null;
  readonly teMsisdn: string | null;
  /**
   * Gabarit de la reference d'imputation attendue par le fournisseur, `{numero}` valant le
   * numero de facture. `null` tant que TE n'a pas fourni son format (§14, parametre 2).
   */
  readonly referenceImputation: string | null;
}

export interface ContratRepository {
  courant(entityId: string): Promise<ContratTe | null>;
}

export interface ActiviteDuJour {
  readonly bonsEmis: number;
  readonly montantEmis: XOF;
  readonly bonsConsommes: number;
  readonly montantConsomme: XOF;
}

export type GraviteIncident = 'CRITIQUE' | 'ATTENTION';

export interface Incident {
  readonly type: string;
  readonly gravite: GraviteIncident;
  readonly nombre: number;
  readonly libelle: string;
}

/** Chiffres du pilotage. Lecture seule. */
export interface PilotageRepository {
  /**
   * Carburant tiré et pas encore facturé par TotalEnergies. C'est une part de la dette.
   * Se cumule depuis la dernière facture, sans borne de temps.
   */
  consommationNonFacturee(contractId: string): Promise<XOF>;
  /**
   * Carburant tiré sur les N derniers jours. Sert uniquement à mesurer un rythme, pas une
   * dette : deux grandeurs différentes, qu'il serait faux de confondre — un mois sans facture
   * fait grossir la première sans changer la seconde.
   */
  consommationSurFenetre(contractId: string, depuis: string): Promise<XOF>;
  /** Bons émis non encore consommés : engagement pris, carburant pas encore servi. */
  bonsEnCirculation(): Promise<XOF>;
  /** Factures TotalEnergies échues et non réglées. */
  facturesEchuesImpayees(contractId: string): Promise<XOF>;
  activiteDuJour(depuis: string): Promise<ActiviteDuJour>;
  incidents(): Promise<readonly Incident[]>;
}
