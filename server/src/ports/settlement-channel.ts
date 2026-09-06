/**
 * Port de sortie de fonds.
 *
 * Le domaine ne connaît que cette interface. Il ignore Wave, HTTP, les B2B ID et les numéros
 * de mobile. Basculer `B2B` ↔ `MOBILE` ne touche aucun fichier de `src/domain/`.
 */

import type { CanalReglement } from '../domain/payment-intent';
import type { XOF } from '../domain/money';

export interface SettlementOrder {
  readonly intentId: string;
  /** UUID v4 persisté en base AVANT l'appel sortant. */
  readonly idempotencyKey: string;
  readonly montant: XOF;
  /** Référence d'imputation exigée par le fournisseur pour rattacher le versement. */
  readonly referenceImputation: string;
}

export type SettlementResult =
  | { readonly kind: 'ACCEPTED'; readonly payoutId: string; readonly canal: CanalReglement }
  | { readonly kind: 'REJECTED'; readonly motif: string; readonly canal: CanalReglement }
  /** Ni confirmé, ni infirmé. L'appelant DOIT passer l'intention en NEEDS_REVIEW. */
  | { readonly kind: 'AMBIGUOUS'; readonly motif: string; readonly canal: CanalReglement };

export type SettlementLookup =
  | { readonly kind: 'FOUND'; readonly payoutId: string; readonly statut: string; readonly montant: XOF | null }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNKNOWN'; readonly motif: string };

export interface SettlementChannel {
  readonly canal: CanalReglement;

  /**
   * Émet l'ordre. Ne lève jamais d'exception pour une panne réseau : une panne se traduit par
   * `AMBIGUOUS`. Ne réessaie jamais.
   */
  execute(order: SettlementOrder): Promise<SettlementResult>;

  /**
   * Interroge le fournisseur sur le sort d'un ordre. Utilisé par la reprise après crash, avant
   * toute nouvelle tentative.
   */
  lookup(order: SettlementOrder, payoutId?: string | null): Promise<SettlementLookup>;
}
