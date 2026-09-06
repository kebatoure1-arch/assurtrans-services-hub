/**
 * Encaissement du chauffeur via l'API Checkout de Wave.
 *
 * `POST /v1/checkout/sessions` ouvre une session de paiement : le chauffeur est renvoyé vers une
 * page Wave, il paie, un webhook confirme. **Cet endpoint n'est pas un moyen de payer
 * TotalEnergies** — il encaisse, il ne règle personne.
 */

import type {
  CanalEncaissement,
  CollectionChannel,
  CollectionOrder,
  CollectionResult,
} from '../../ports/collection-channel.ts';
import { EndpointContractUnknownError, type WaveClient, type WaveConfig } from './wave-client.ts';

function extraitUrl(body: unknown, champ: string): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const v = (body as Record<string, unknown>)[champ];
  return typeof v === 'string' && v.startsWith('https://') ? v : null;
}

export class WaveCheckoutChannel implements CollectionChannel {
  readonly canal: CanalEncaissement = 'WAVE_CHECKOUT';

  constructor(
    private readonly client: WaveClient,
    private readonly config: WaveConfig,
  ) {}

  async createSession(order: CollectionOrder): Promise<CollectionResult> {
    if (!this.config.checkoutLaunchUrlField) {
      // Sans l'URL de paiement, le chauffeur ne peut pas payer. On refuse d'ouvrir une session
      // plutôt que de deviner le nom du champ dans la réponse.
      throw new EndpointContractUnknownError(
        'nom du champ portant l’URL de paiement dans la réponse de session Checkout',
      );
    }

    const outcome = await this.client.postCheckoutSession({
      idempotencyKey: order.idempotencyKey,
      // ⚠️ Forme du payload à confirmer sur la documentation Wave en vigueur. Le chemin de
      // l'endpoint, lui, est celui du contrat d'intégration.
      payload: {
        amount: String(order.montant),
        currency: 'XOF',
        client_reference: order.reference,
        ...(order.msisdn ? { payer_mobile: order.msisdn } : {}),
      },
    });

    if (outcome.kind === 'REJECTED') {
      return { kind: 'REJECTED', motif: outcome.motif, canal: this.canal };
    }
    if (outcome.kind === 'AMBIGUOUS') {
      return { kind: 'AMBIGUOUS', motif: outcome.motif, canal: this.canal };
    }

    const launchUrl = extraitUrl(outcome.body, this.config.checkoutLaunchUrlField);
    if (launchUrl === null) {
      // Session ouverte côté Wave, mais inutilisable de notre côté. Ni un succès, ni un néant :
      // une session peut exister sans que nous sachions y renvoyer le chauffeur.
      return {
        kind: 'AMBIGUOUS',
        motif: `session ${outcome.sessionId} créée sans URL de paiement exploitable dans le champ « ${this.config.checkoutLaunchUrlField} »`,
        canal: this.canal,
      };
    }

    return { kind: 'CREATED', sessionId: outcome.sessionId, launchUrl, canal: this.canal };
  }
}
