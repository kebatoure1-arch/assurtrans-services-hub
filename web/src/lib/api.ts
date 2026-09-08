/**
 * Client de l'API Assur'Trans.
 *
 * Aucun secret ne vit ici. Le front ne detient qu'un jeton de session, obtenu par le chauffeur
 * ou le pompiste avec son propre numero, expirant de lui-meme. Les cles de signature, la cle
 * Wave et les secrets de webhook restent cote serveur.
 */

const BASE = (import.meta.env.ASSURTRANS_API ?? 'http://localhost:3001').replace(/\/$/, '');

export type Role = 'DRIVER' | 'STATION_OPERATOR' | 'ADMIN';

export interface Session {
  readonly token: string;
  readonly role: Role;
  readonly subject: string;
  readonly stationId: string | null;
  readonly expireA: string;
}

export interface Bon {
  readonly id: string;
  readonly montantXof: number;
  readonly statut: 'EMIS' | 'CONSOMME' | 'ANNULE';
  readonly emisA: string;
  readonly expireA: string;
  readonly consommeA: string | null;
  readonly jeton: string | null;
}

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
    /** Code stable du refus, quand le serveur en fournit un. */
    readonly code: string | null = null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ErreurApi';
  }
}

/** Panne reseau : distincte d'un refus du serveur, et formulee autrement a l'ecran. */
export class ErreurReseau extends Error {
  constructor() {
    super('connexion impossible');
    this.name = 'ErreurReseau';
  }
}

async function appeler<T>(
  chemin: string,
  options: { methode?: 'GET' | 'POST'; corps?: unknown; jeton?: string } = {},
): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      method: options.methode ?? 'GET',
      headers: {
        ...(options.corps === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.jeton === undefined ? {} : { authorization: `Bearer ${options.jeton}` }),
      },
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    });
  } catch {
    throw new ErreurReseau();
  }

  const texte = await reponse.text();
  let corps: unknown = null;
  if (texte.length > 0) {
    try {
      corps = JSON.parse(texte);
    } catch {
      corps = null;
    }
  }

  if (!reponse.ok) {
    const objet = corps !== null && typeof corps === 'object' ? (corps as Record<string, unknown>) : {};
    const message = 'erreur' in objet ? String(objet.erreur) : 'la demande n a pas abouti';
    const code = typeof objet.code === 'string' ? objet.code : null;
    throw new ErreurApi(reponse.status, message, code, objet);
  }

  return corps as T;
}

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
  readonly role: Role;
  readonly stationId: string | null;
  readonly statut: StatutFiche;
}

export interface EtatPilotage {
  readonly contrat: {
    readonly numeroCompte: string;
    readonly encoursAutorise: number;
    readonly seuilAlertePct: number;
    readonly seuilBlocagePct: number;
    readonly canalReglement: string;
  } | null;
  readonly encours: {
    readonly encoursAutorise: number;
    readonly encoursCourant: number;
    readonly disponible: number;
    readonly utilisationPct: number;
    readonly depassement: number;
    readonly seuilAlerteXof: number;
    readonly seuilBlocageXof: number;
    readonly niveau: 'NORMAL' | 'ALERTE' | 'BLOCAGE';
  } | null;
  readonly projection: {
    readonly joursRestants: number | null;
    readonly date: string | null;
    readonly raison: 'PROJETE' | 'DEJA_ATTEINT' | 'CONSOMMATION_NULLE';
  } | null;
  readonly bonsEnCirculation: number;
  readonly activite: {
    readonly bonsEmis: number;
    readonly montantEmis: number;
    readonly bonsConsommes: number;
    readonly montantConsomme: number;
  };
  readonly incidents: readonly {
    readonly type: string;
    readonly gravite: 'CRITIQUE' | 'ATTENTION';
    readonly nombre: number;
    readonly libelle: string;
  }[];
  readonly avertissements: readonly string[];
  readonly arreteA: string;
}

export const api = {
  demanderCode: (telephone: string) =>
    appeler<{ valideSecondes: number; code?: string }>('/api/auth/code', {
      methode: 'POST',
      corps: { telephone },
    }),

  ouvrirSession: (telephone: string, code: string) =>
    appeler<Session>('/api/auth/session', { methode: 'POST', corps: { telephone, code } }),

  mesBons: (jeton: string) => appeler<Bon[]>('/api/bons', { jeton }),

  ouvrirPaiement: (jeton: string, montantXof: number) =>
    appeler<{
      reference: string;
      urlPaiement: string;
      montantXof: number;
      /** `DRY_RUN` : aucun encaissement reel, l'URL rendue ne mene nulle part. */
      canal: 'DRY_RUN' | 'WAVE_CHECKOUT';
    }>('/api/paiements/session', { methode: 'POST', corps: { montantXof }, jeton }),

  tableauDeBord: (jeton: string) =>
    appeler<EtatPilotage>('/api/admin/tableau-de-bord', { jeton }),

  chauffeurs: (jeton: string) => appeler<FicheChauffeur[]>('/api/admin/drivers', { jeton }),
  stations: (jeton: string) => appeler<FicheStation[]>('/api/admin/stations', { jeton }),
  operateurs: (jeton: string) => appeler<FicheOperateur[]>('/api/admin/operators', { jeton }),

  creerChauffeur: (jeton: string, corps: { nom: string; telephone: string }) =>
    appeler<FicheChauffeur>('/api/admin/drivers', { methode: 'POST', corps, jeton }),

  creerStation: (jeton: string, corps: { code: string; nom: string; ville?: string }) =>
    appeler<FicheStation>('/api/admin/stations', { methode: 'POST', corps, jeton }),

  creerOperateur: (
    jeton: string,
    corps: { nom: string; telephone: string; role: Role; stationId: string | null },
  ) => appeler<FicheOperateur>('/api/admin/operators', { methode: 'POST', corps, jeton }),

  changerStatutChauffeur: (jeton: string, id: string, statut: StatutFiche, motif: string) =>
    appeler<{ id: string; statut: StatutFiche }>(`/api/admin/drivers/${id}/statut`, {
      methode: 'POST',
      corps: { statut, motif },
      jeton,
    }),

  changerStatutOperateur: (jeton: string, id: string, statut: StatutFiche, motif: string) =>
    appeler<{ id: string; statut: StatutFiche }>(`/api/admin/operators/${id}/statut`, {
      methode: 'POST',
      corps: { statut, motif },
      jeton,
    }),

  consommer: (jeton: string, token: string, redemptionId: string) =>
    appeler<{ servir: boolean; montantXof: number; bon: string; dejaServi: boolean }>(
      '/api/station/consommation',
      { methode: 'POST', corps: { token, redemptionId }, jeton },
    ),
};
