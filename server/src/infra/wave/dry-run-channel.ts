/**
 * Canal de règlement à blanc.
 *
 * Mode par défaut, et seul mode autorisé tant que les paramètres 1, 2, 3 et 5 du §14 ne sont
 * pas obtenus. Il écrit l'intention complète (c'est l'appelant qui persiste) et n'émet aucun
 * appel réseau.
 *
 * Le transport est injecté uniquement pour que la signature soit identique aux canaux réels :
 * il n'est jamais appelé. Le test `settlement-channel.spec.ts` le vérifie avec un transport qui
 * lève une exception dès qu'on le touche.
 */

import type { CanalReglement } from '../../domain/payment-intent.ts';
import type {
  SettlementChannel,
  SettlementLookup,
  SettlementOrder,
  SettlementResult,
} from '../../ports/settlement-channel.ts';
import type { HttpTransport } from './wave-client.ts';

export const PREFIXE_DRY_RUN = 'DRYRUN-';

export class DryRunChannel implements SettlementChannel {
  readonly canal: CanalReglement = 'DRY_RUN';

  // Le transport est accepté pour aligner la signature sur les canaux réels, et délibérément
  // jamais conservé : il n'existe aucun chemin de code par lequel il pourrait être appelé.
  constructor(transport: HttpTransport) {
    void transport;
  }

  async execute(order: SettlementOrder): Promise<SettlementResult> {
    return {
      kind: 'ACCEPTED',
      payoutId: `${PREFIXE_DRY_RUN}${order.idempotencyKey}`,
      canal: this.canal,
    };
  }

  async lookup(order: SettlementOrder): Promise<SettlementLookup> {
    return {
      kind: 'FOUND',
      payoutId: `${PREFIXE_DRY_RUN}${order.idempotencyKey}`,
      statut: 'dry-run',
      montant: order.montant,
    };
  }
}

/** Un identifiant de payout produit à blanc ne doit jamais être pris pour un règlement réel. */
export function estPayoutDryRun(payoutId: string | null): boolean {
  return payoutId !== null && payoutId.startsWith(PREFIXE_DRY_RUN);
}
