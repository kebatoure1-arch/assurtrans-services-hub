/**
 * Client HTTP Wave.
 *
 * Seuls les endpoints décrits par le contrat d'intégration Wave sont implémentés :
 *   - POST /v1/payout        (payout B2C, bénéficiaire = MSISDN)
 *   - POST /v1/b2b/payout    (payout B2B, bénéficiaire = B2B ID)
 *   - GET  /v1/payout/:id    (consultation d'un payout — reprise après crash)
 *
 * Tout le reste lève `EndpointContractUnknownError`. On n'invente pas d'endpoint : si la
 * documentation ne le décrit pas, il n'existe pas.
 *
 * La clé API ne transite que par l'en-tête `Authorization`. Elle n'est jamais journalisée,
 * jamais recopiée dans un message d'erreur, jamais renvoyée à l'appelant.
 */

import type { Secret } from '../secrets/secrets';

export interface HttpRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export type HttpTransport = (req: HttpRequest) => Promise<HttpResponse>;

export interface WaveConfig {
  readonly baseUrl: string;
  /**
   * Injectée au démarrage depuis KMS/Vault. Jamais lue depuis le repo ni depuis un bundle.
   * Portée par `Secret` : elle ne peut ni être interpolée, ni sérialisée, ni journalisée par
   * accident. Sa seule sortie est `expose()`, appelé à un unique endroit — `headers()`.
   */
  readonly apiKey: Secret;
  /**
   * Nom du champ libre du payload de payout qui porte la référence d'imputation.
   * À renseigner d'après la documentation Wave en vigueur (§14, paramètre 2).
   * Vide ⇒ le canal refuse d'exécuter plutôt que de deviner.
   */
  readonly payoutReferenceField: string;
  /**
   * Nom du champ de la réponse de session Checkout qui porte l'URL de paiement à présenter au
   * chauffeur. À renseigner d'après la documentation Wave en vigueur.
   * Vide ⇒ le canal d'encaissement refuse d'ouvrir une session plutôt que de deviner.
   */
  readonly checkoutLaunchUrlField: string;
}

export class EndpointContractUnknownError extends Error {
  constructor(quoi: string) {
    super(
      `contrat d'intégration non établi : ${quoi}. Aucun endpoint n'est inventé — obtenir la ` +
        'documentation Wave correspondante avant d’aller plus loin.',
    );
    this.name = 'EndpointContractUnknownError';
  }
}

export class WaveTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaveTransportError';
  }
}

export interface CheckoutSessionRequest {
  readonly idempotencyKey: string;
  readonly payload: Record<string, unknown>;
}

export type CheckoutOutcome =
  | { readonly kind: 'CREATED'; readonly sessionId: string; readonly body: unknown }
  | { readonly kind: 'REJECTED'; readonly motif: string }
  | { readonly kind: 'AMBIGUOUS'; readonly motif: string };

export interface PayoutRequest {
  readonly path: '/v1/payout' | '/v1/b2b/payout';
  readonly idempotencyKey: string;
  readonly payload: Record<string, unknown>;
}

export type PayoutOutcome =
  | { readonly kind: 'ACCEPTED'; readonly payoutId: string }
  | { readonly kind: 'REJECTED'; readonly motif: string }
  | { readonly kind: 'AMBIGUOUS'; readonly motif: string };

function extraitId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function messageErreur(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'réponse non exploitable';
  const record = body as Record<string, unknown>;
  const brut = record.message ?? record.error ?? record.code;
  return typeof brut === 'string' ? brut : 'réponse non exploitable';
}

export class WaveClient {
  constructor(
    private readonly config: WaveConfig,
    private readonly transport: HttpTransport,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      // Unique point d'exposition de la clé dans tout le système.
      Authorization: `Bearer ${this.config.apiKey.expose()}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  /**
   * Émet un payout. Une seule tentative — jamais de retry sur une écriture monétaire.
   * Toute incertitude devient `AMBIGUOUS`, à charge de l'appelant de basculer en NEEDS_REVIEW.
   */
  async postPayout(req: PayoutRequest): Promise<PayoutOutcome> {
    let reponse: HttpResponse;
    try {
      reponse = await this.transport({
        method: 'POST',
        path: req.path,
        headers: this.headers({ 'Idempotency-Key': req.idempotencyKey }),
        body: req.payload,
      });
    } catch (cause) {
      // Panne réseau : impossible de savoir si l'ordre est parti. Aucun retry.
      const detail = cause instanceof Error ? cause.message : 'erreur de transport';
      return { kind: 'AMBIGUOUS', motif: `appel sortant sans réponse exploitable : ${detail}` };
    }

    if (reponse.status >= 200 && reponse.status < 300) {
      const payoutId = extraitId(reponse.body);
      if (payoutId === null) {
        return {
          kind: 'AMBIGUOUS',
          motif: `réponse ${reponse.status} acceptée mais sans identifiant de payout exploitable`,
        };
      }
      return { kind: 'ACCEPTED', payoutId };
    }

    if (reponse.status >= 500) {
      return {
        kind: 'AMBIGUOUS',
        motif: `réponse ${reponse.status} du fournisseur : sort de l'ordre indéterminé`,
      };
    }

    return { kind: 'REJECTED', motif: `réponse ${reponse.status} : ${messageErreur(reponse.body)}` };
  }

  /**
   * Ouvre une session Checkout — encaissement d'un payeur vers le portefeuille.
   *
   * Cet endpoint **ne paye personne**. Il ne peut pas régler TotalEnergies ni aucun code
   * marchand. Le règlement passe exclusivement par `postPayout`.
   *
   * Une seule tentative, comme pour un payout : ouvrir deux sessions pour un même paiement
   * exposerait le chauffeur à payer deux fois.
   */
  async postCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutOutcome> {
    let reponse: HttpResponse;
    try {
      reponse = await this.transport({
        method: 'POST',
        path: '/v1/checkout/sessions',
        headers: this.headers({ 'Idempotency-Key': req.idempotencyKey }),
        body: req.payload,
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'erreur de transport';
      return { kind: 'AMBIGUOUS', motif: `appel sortant sans réponse exploitable : ${detail}` };
    }

    if (reponse.status >= 200 && reponse.status < 300) {
      const sessionId = extraitId(reponse.body);
      if (sessionId === null) {
        return {
          kind: 'AMBIGUOUS',
          motif: `réponse ${reponse.status} sans identifiant de session exploitable`,
        };
      }
      return { kind: 'CREATED', sessionId, body: reponse.body };
    }

    if (reponse.status >= 500) {
      return {
        kind: 'AMBIGUOUS',
        motif: `réponse ${reponse.status} du fournisseur : sort de la session indéterminé`,
      };
    }

    return { kind: 'REJECTED', motif: `réponse ${reponse.status} : ${messageErreur(reponse.body)}` };
  }

  /**
   * Consulte un payout. Lecture idempotente : c'est le seul appel que l'on s'autorise à
   * réessayer, et c'est le premier appel d'une reprise après crash.
   */
  async getPayout(payoutId: string): Promise<HttpResponse> {
    return this.transport({
      method: 'GET',
      path: `/v1/payout/${payoutId}`,
      headers: this.headers(),
    });
  }

  /**
   * Solde du portefeuille — API « Balance & Reconciliation ».
   *
   * Le chemin exact n'est pas établi par le contrat d'intégration dont nous disposons. Tant
   * qu'il ne l'est pas, cette méthode échoue explicitement plutôt que de deviner une URL.
   */
  async fetchBalance(): Promise<never> {
    throw new EndpointContractUnknownError(
      'chemin de l’API Balance & Reconciliation (solde du portefeuille)',
    );
  }

  /**
   * Relevé des transactions — API « Balance & Reconciliation ».
   * Même raison que `fetchBalance` : chemin non documenté ici.
   */
  async fetchStatement(): Promise<never> {
    throw new EndpointContractUnknownError(
      'chemin de l’API Balance & Reconciliation (historique des transactions)',
    );
  }

  /**
   * Recherche d'un payout par clé d'idempotence.
   *
   * Aucun endpoint documenté ne permet cette recherche. La reprise après crash doit donc
   * s'appuyer sur `getPayout` avec l'identifiant conservé, ou sur le relevé une fois le chemin
   * de l'API Balance documenté.
   */
  async findPayoutByIdempotencyKey(): Promise<never> {
    throw new EndpointContractUnknownError(
      'recherche de payout par Idempotency-Key (aucun endpoint documenté)',
    );
  }
}
