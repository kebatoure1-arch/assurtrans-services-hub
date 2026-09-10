/**
 * Serveur factice pour les tests d'interface.
 *
 * Il remplace `fetch`, pas le client d'API : les tests traversent donc `lib/api.ts` en entier,
 * y compris la traduction des codes de refus en messages lisibles. C'est justement là que
 * vivent les décisions qu'on veut vérifier.
 *
 * Chaque appel est enregistré, ce qui permet de contrôler non seulement ce que l'écran affiche
 * mais aussi **ce qu'il envoie** — un écran qui laisserait passer un champ qu'il ne devrait pas
 * se verrait ici.
 */

import { vi } from 'vitest';
import type { Session } from '../src/lib/api.ts';

export interface AppelEnregistre {
  readonly methode: string;
  /** Chemin seul, sans la requête. */
  readonly chemin: string;
  /**
   * Paramètres de requête.
   *
   * Un écran de consultation met ses filtres et son curseur là, pas dans le corps : les
   * ignorer reviendrait à ne pas pouvoir vérifier ce qu'un écran demande vraiment.
   */
  readonly requete: Record<string, string>;
  readonly corps: Record<string, unknown> | null;
  readonly autorisation: string | null;
}

export interface Reponse {
  readonly statut?: number;
  readonly corps?: unknown;
}

type Routeur = (appel: AppelEnregistre) => Reponse | undefined;

export class FauxServeur {
  readonly appels: AppelEnregistre[] = [];
  private readonly routes = new Map<string, Reponse | ((a: AppelEnregistre) => Reponse)>();
  private routeurParDefaut: Routeur = () => undefined;
  /** Quand vrai, tout appel échoue comme une coupure réseau. */
  horsLigne = false;

  repond(cle: string, reponse: Reponse | ((a: AppelEnregistre) => Reponse)): this {
    this.routes.set(cle, reponse);
    return this;
  }

  parDefaut(routeur: Routeur): this {
    this.routeurParDefaut = routeur;
    return this;
  }

  appelsVers(chemin: string): AppelEnregistre[] {
    return this.appels.filter((a) => a.chemin === chemin);
  }

  installer(): this {
    vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
      const analysee = new URL(url);
      const chemin = analysee.pathname;
      const methode = options.method ?? 'GET';
      const entetes = (options.headers ?? {}) as Record<string, string>;

      const appel: AppelEnregistre = {
        methode,
        chemin,
        requete: Object.fromEntries(analysee.searchParams),
        corps: typeof options.body === 'string' ? JSON.parse(options.body) : null,
        autorisation: entetes.authorization ?? null,
      };
      this.appels.push(appel);

      if (this.horsLigne) throw new TypeError('Failed to fetch');

      const trouvee =
        this.routes.get(`${methode} ${chemin}`) ??
        this.routes.get(chemin) ??
        this.routeurParDefaut(appel);

      const reponse: Reponse =
        typeof trouvee === 'function' ? trouvee(appel) : (trouvee ?? { statut: 404, corps: {} });

      const statut = reponse.statut ?? 200;
      return {
        ok: statut >= 200 && statut < 300,
        status: statut,
        text: async () => JSON.stringify(reponse.corps ?? {}),
      } as Response;
    });
    return this;
  }
}

const DEMAIN = new Date(Date.now() + 12 * 3_600_000).toISOString();

export function sessionDe(role: Session['role'], stationId: string | null = null): Session {
  return {
    token: `jeton-${role.toLowerCase()}`,
    role,
    subject: `${role.toLowerCase()}-1`,
    stationId,
    expireA: DEMAIN,
  };
}

/** Ouvre une session déjà valide, comme si l'utilisateur s'était connecté. */
export function ouvrirSession(session: Session): void {
  localStorage.setItem('assurtrans.session', JSON.stringify(session));
}

export function bon(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'BON-1',
    montantXof: 20000,
    statut: 'EMIS',
    emisA: new Date().toISOString(),
    expireA: new Date(Date.now() + 20 * 3_600_000).toISOString(),
    consommeA: null,
    jeton: 'AT1.charge.signature',
    ...surcharges,
  };
}
