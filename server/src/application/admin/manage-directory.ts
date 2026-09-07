/**
 * Cas d'usage : tenir le référentiel.
 *
 * Sans lui, personne ne peut entrer dans le système : jusqu'ici, créer un chauffeur supposait
 * d'écrire du SQL à la main.
 *
 * Deux règles méritent d'être dites, parce qu'elles ne vont pas de soi :
 *
 *  1. **Un numéro n'appartient qu'à une seule personne**, chauffeurs et opérateurs confondus.
 *     L'authentification se fait par téléphone : un numéro partagé rendrait le rôle ambigu au
 *     moment de la connexion.
 *  2. **Suspendre un chauffeur n'annule pas ses bons en cours.** Il les a payés. La suspension
 *     l'empêche d'en acheter de nouveaux ; elle ne lui reprend pas le carburant déjà réglé.
 */

import { normaliserMsisdn } from '../../domain/otp.ts';
import type { AuditLogger } from '../../ports/audit.ts';
import type {
  DirectoryRepository,
  FicheChauffeur,
  FicheOperateur,
  FicheStation,
  StatutFiche,
} from '../../ports/admin.ts';
import type { ApiRole } from '../../infra/auth/api-tokens.ts';
import type { IdGenerator } from '../../ports/repositories.ts';

export class ReferentielRefuseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferentielRefuseError';
  }
}

export class NumeroDejaUtiliseError extends Error {
  constructor(msisdn: string) {
    super(`le numéro ${msisdn} est déjà rattaché à une autre fiche`);
    this.name = 'NumeroDejaUtiliseError';
  }
}

export interface ManageDirectoryDeps {
  readonly annuaire: DirectoryRepository;
  readonly audit: AuditLogger;
  readonly ids: IdGenerator;
  readonly entityId: string;
}

function texteRequis(valeur: string, quoi: string): string {
  const propre = typeof valeur === 'string' ? valeur.trim() : '';
  if (propre === '') throw new ReferentielRefuseError(`${quoi} requis`);
  return propre;
}

export class ManageDirectory {
  constructor(private readonly deps: ManageDirectoryDeps) {}

  async listerChauffeurs() {
    return this.deps.annuaire.listerChauffeurs();
  }

  async listerStations() {
    return this.deps.annuaire.listerStations();
  }

  async listerOperateurs() {
    return this.deps.annuaire.listerOperateurs();
  }

  async creerChauffeur(
    saisie: { readonly nom: string; readonly telephone: string },
    acteur: string,
  ): Promise<FicheChauffeur> {
    const nom = texteRequis(saisie.nom, 'nom du chauffeur');
    const msisdn = normaliserMsisdn(saisie.telephone);

    if (!(await this.deps.annuaire.numeroLibre(msisdn))) {
      throw new NumeroDejaUtiliseError(msisdn);
    }

    const fiche: FicheChauffeur = { id: this.deps.ids.next(), nom, msisdn, statut: 'ACTIF' };
    await this.deps.annuaire.creerChauffeur(fiche);
    await this.deps.audit.enregistrer({
      actor: acteur,
      action: 'CHAUFFEUR_CREE',
      targetType: 'driver',
      targetId: fiche.id,
      payload: { nom, msisdn },
    });
    return fiche;
  }

  async changerStatutChauffeur(
    id: string,
    statut: StatutFiche,
    acteur: string,
    motif: string,
  ): Promise<void> {
    const raison = texteRequis(motif, 'motif du changement de statut');

    if (!(await this.deps.annuaire.changerStatutChauffeur(id, statut))) {
      throw new ReferentielRefuseError(`chauffeur ${id} introuvable`);
    }

    await this.deps.audit.enregistrer({
      actor: acteur,
      action: statut === 'SUSPENDU' ? 'CHAUFFEUR_SUSPENDU' : 'CHAUFFEUR_REACTIVE',
      targetType: 'driver',
      targetId: id,
      payload: { motif: raison },
    });
  }

  async creerStation(
    saisie: { readonly code: string; readonly nom: string; readonly ville?: string },
    acteur: string,
  ): Promise<FicheStation> {
    const code = texteRequis(saisie.code, 'code de la station');
    const nom = texteRequis(saisie.nom, 'nom de la station');

    const fiche: FicheStation = {
      id: this.deps.ids.next(),
      code,
      nom,
      ville: saisie.ville?.trim() || null,
      statut: 'ACTIVE',
    };
    await this.deps.annuaire.creerStation(fiche);
    await this.deps.audit.enregistrer({
      actor: acteur,
      action: 'STATION_CREEE',
      targetType: 'station',
      targetId: fiche.id,
      payload: { code, nom },
    });
    return fiche;
  }

  async creerOperateur(
    saisie: {
      readonly nom: string;
      readonly telephone: string;
      readonly role: ApiRole;
      readonly stationId: string | null;
    },
    acteur: string,
  ): Promise<FicheOperateur> {
    const nom = texteRequis(saisie.nom, "nom de l'opérateur");
    const msisdn = normaliserMsisdn(saisie.telephone);

    if (saisie.role === 'DRIVER') {
      throw new ReferentielRefuseError(
        'un chauffeur se crée dans la liste des chauffeurs, pas dans celle des opérateurs',
      );
    }

    // Un pompiste sert au nom d'une station : sans rattachement, il ne sert au nom de personne.
    if (saisie.role === 'STATION_OPERATOR') {
      if (saisie.stationId === null) {
        throw new ReferentielRefuseError('un pompiste doit être rattaché à une station');
      }
      if ((await this.deps.annuaire.trouverStation(saisie.stationId)) === null) {
        throw new ReferentielRefuseError(`station ${saisie.stationId} introuvable`);
      }
    }

    if (!(await this.deps.annuaire.numeroLibre(msisdn))) {
      throw new NumeroDejaUtiliseError(msisdn);
    }

    const fiche: FicheOperateur = {
      id: this.deps.ids.next(),
      nom,
      msisdn,
      role: saisie.role,
      stationId: saisie.role === 'STATION_OPERATOR' ? saisie.stationId : null,
      statut: 'ACTIF',
    };
    await this.deps.annuaire.creerOperateur(fiche);
    await this.deps.audit.enregistrer({
      actor: acteur,
      action: 'OPERATEUR_CREE',
      targetType: 'operateur',
      targetId: fiche.id,
      payload: { nom, msisdn, role: saisie.role, stationId: fiche.stationId },
    });
    return fiche;
  }

  async changerStatutOperateur(
    id: string,
    statut: StatutFiche,
    acteur: string,
    motif: string,
  ): Promise<void> {
    const raison = texteRequis(motif, 'motif du changement de statut');

    if (!(await this.deps.annuaire.changerStatutOperateur(id, statut))) {
      throw new ReferentielRefuseError(`opérateur ${id} introuvable`);
    }

    await this.deps.audit.enregistrer({
      actor: acteur,
      action: statut === 'SUSPENDU' ? 'OPERATEUR_SUSPENDU' : 'OPERATEUR_REACTIVE',
      targetType: 'operateur',
      targetId: id,
      payload: { motif: raison },
    });
  }
}
