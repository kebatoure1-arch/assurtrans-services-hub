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
    appeler<{ reference: string; urlPaiement: string; montantXof: number }>(
      '/api/paiements/session',
      { methode: 'POST', corps: { montantXof }, jeton },
    ),

  consommer: (jeton: string, token: string, redemptionId: string) =>
    appeler<{ servir: boolean; montantXof: number; bon: string; dejaServi: boolean }>(
      '/api/station/consommation',
      { methode: 'POST', corps: { token, redemptionId }, jeton },
    ),
};
