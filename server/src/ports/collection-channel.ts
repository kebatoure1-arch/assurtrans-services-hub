/**
 * Port d'encaissement.
 *
 * Le chauffeur paie un montant précis ; ce paiement finance un bon carburant du même montant.
 *
 * Ce port ne sait rien de Wave. Il n'expose **aucune** opération de paiement vers un marchand :
 * l'API Checkout encaisse un payeur, elle ne règle personne. Le règlement de TotalEnergies passe
 * par `SettlementChannel`, jamais par ici.
 */

import type { XOF } from '../domain/money.ts';

export type CanalEncaissement = 'DRY_RUN' | 'WAVE_CHECKOUT';

export interface CollectionOrder {
  readonly driverId: string;
  readonly montant: XOF;
  /** UUID v4 persisté avant l'appel sortant, comme pour un règlement. */
  readonly idempotencyKey: string;
  /** Référence interne du paiement, reportée sur le bon émis. */
  readonly reference: string;
  /** Numéro du payeur, si l'on souhaite pré-remplir. Facultatif. */
  readonly msisdn?: string;
}

export type CollectionResult =
  | {
      readonly kind: 'CREATED';
      readonly sessionId: string;
      /** URL à présenter au chauffeur pour qu'il paie. */
      readonly launchUrl: string;
      readonly canal: CanalEncaissement;
    }
  | { readonly kind: 'REJECTED'; readonly motif: string; readonly canal: CanalEncaissement }
  /** Sort de la session indéterminé. Aucun bon ne doit être émis sur cette base. */
  | { readonly kind: 'AMBIGUOUS'; readonly motif: string; readonly canal: CanalEncaissement };

export interface CollectionChannel {
  readonly canal: CanalEncaissement;

  /**
   * Ouvre une session de paiement. Ne lève jamais d'exception pour une panne réseau : une panne
   * se traduit par `AMBIGUOUS`. Ne réessaie jamais.
   */
  createSession(order: CollectionOrder): Promise<CollectionResult>;
}
