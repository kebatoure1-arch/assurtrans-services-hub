/**
 * Encaissement à blanc.
 *
 * Aucun appel réseau, aucun mouvement d'argent. La session rendue est déterministe : rejouer la
 * même clé d'idempotence rend la même session, comme le ferait un fournisseur idempotent.
 */

import type {
  CanalEncaissement,
  CollectionChannel,
  CollectionOrder,
  CollectionResult,
} from '../../ports/collection-channel.ts';
import type { HttpTransport } from './wave-client.ts';

export const PREFIXE_DRY_RUN = 'DRYRUN-';

export class DryRunCollectionChannel implements CollectionChannel {
  readonly canal: CanalEncaissement = 'DRY_RUN';

  // Transport accepté pour aligner la signature sur le canal réel, délibérément non conservé.
  constructor(transport: HttpTransport) {
    void transport;
  }

  async createSession(order: CollectionOrder): Promise<CollectionResult> {
    const sessionId = `${PREFIXE_DRY_RUN}${order.idempotencyKey}`;
    return {
      kind: 'CREATED',
      sessionId,
      launchUrl: `https://dry-run.invalid/checkout/${sessionId}`,
      canal: this.canal,
    };
  }
}
