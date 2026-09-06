/**
 * Implémentations concrètes du port `SettlementChannel` au-dessus de l'API Wave.
 *
 * Deux sorties de fonds programmables existent, et deux seulement :
 *   - `POST /v1/b2b/payout` vers un B2B ID  → `B2BPayoutChannel`
 *   - `POST /v1/payout`     vers un MSISDN  → `MobilePayoutChannel`
 *
 * L'API Checkout encaisse ; elle ne règle personne. Aucun code ici ne l'utilise.
 */

import type { CanalReglement } from '../../domain/payment-intent';
import { xof } from '../../domain/money';
import type {
  SettlementChannel,
  SettlementLookup,
  SettlementOrder,
  SettlementResult,
} from '../../ports/settlement-channel';
import {
  EndpointContractUnknownError,
  type PayoutRequest,
  WaveClient,
  type WaveConfig,
  type HttpTransport,
} from './wave-client';

abstract class WavePayoutChannel implements SettlementChannel {
  abstract readonly canal: CanalReglement;
  protected abstract readonly path: PayoutRequest['path'];

  protected constructor(
    protected readonly client: WaveClient,
    protected readonly config: WaveConfig,
  ) {}

  /** Champs identifiant le bénéficiaire, propres à chaque canal. */
  protected abstract beneficiaire(): Record<string, unknown>;

  async execute(order: SettlementOrder): Promise<SettlementResult> {
    if (!this.config.payoutReferenceField) {
      // Un versement sans référence d'imputation correcte est un versement perdu côté
      // fournisseur. On refuse d'envoyer plutôt que de deviner le nom du champ.
      throw new EndpointContractUnknownError(
        'nom du champ de référence d’imputation du payload de payout (§14, paramètre 2)',
      );
    }

    const outcome = await this.client.postPayout({
      path: this.path,
      idempotencyKey: order.idempotencyKey,
      // ⚠️ Forme du payload (noms `amount` / `currency`) à confirmer sur la documentation Wave
      // en vigueur. Les chemins d'endpoint, eux, sont ceux du contrat d'intégration.
      payload: {
        amount: String(order.montant),
        currency: 'XOF',
        ...this.beneficiaire(),
        [this.config.payoutReferenceField]: order.referenceImputation,
      },
    });

    switch (outcome.kind) {
      case 'ACCEPTED':
        return { kind: 'ACCEPTED', payoutId: outcome.payoutId, canal: this.canal };
      case 'REJECTED':
        return { kind: 'REJECTED', motif: outcome.motif, canal: this.canal };
      default:
        return { kind: 'AMBIGUOUS', motif: outcome.motif, canal: this.canal };
    }
  }

  async lookup(_order: SettlementOrder, payoutId?: string | null): Promise<SettlementLookup> {
    if (!payoutId) {
      // Aucun endpoint documenté ne cherche un payout par clé d'idempotence.
      return {
        kind: 'UNKNOWN',
        motif:
          'aucun identifiant de payout conservé et aucune recherche par Idempotency-Key documentée',
      };
    }

    try {
      const reponse = await this.client.getPayout(payoutId);
      if (reponse.status === 404) return { kind: 'NOT_FOUND' };
      if (reponse.status < 200 || reponse.status >= 300) {
        return { kind: 'UNKNOWN', motif: `réponse ${reponse.status} à la consultation du payout` };
      }

      const body = (reponse.body ?? {}) as Record<string, unknown>;
      const statut = typeof body.status === 'string' ? body.status : 'inconnu';
      const brut = body.amount;
      const montant =
        typeof brut === 'string' && /^\d+$/.test(brut)
          ? xof(Number(brut))
          : typeof brut === 'number'
            ? xof(brut)
            : null;

      return { kind: 'FOUND', payoutId, statut, montant };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'erreur de transport';
      return { kind: 'UNKNOWN', motif: `consultation impossible : ${detail}` };
    }
  }
}

export class B2BPayoutChannel extends WavePayoutChannel {
  readonly canal = 'B2B' as const;
  protected readonly path = '/v1/b2b/payout' as const;

  constructor(
    client: WaveClient,
    config: WaveConfig,
    private readonly teB2bId: string,
  ) {
    super(client, config);
  }

  // ⚠️ Nom de champ à confirmer sur la documentation Wave en vigueur avant tout appel réel.
  protected beneficiaire(): Record<string, unknown> {
    return { receive_business_id: this.teB2bId };
  }
}

export class MobilePayoutChannel extends WavePayoutChannel {
  readonly canal = 'MOBILE' as const;
  protected readonly path = '/v1/payout' as const;

  constructor(
    client: WaveClient,
    config: WaveConfig,
    private readonly teMsisdn: string,
  ) {
    super(client, config);
  }

  // ⚠️ Nom de champ à confirmer sur la documentation Wave en vigueur avant tout appel réel.
  protected beneficiaire(): Record<string, unknown> {
    return { mobile: this.teMsisdn };
  }
}

export type { HttpTransport };
