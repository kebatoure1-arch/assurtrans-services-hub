/**
 * Sélection du canal d'encaissement par configuration.
 *
 * Seul endroit du système qui connaît les implémentations concrètes. Les cas d'usage ne
 * manipulent que le port `CollectionChannel`.
 */

import type { CanalEncaissement, CollectionChannel } from '../../ports/collection-channel.ts';
import { DryRunCollectionChannel } from './dry-run-collection-channel.ts';
import { WaveCheckoutChannel } from './checkout-channel.ts';
import { type HttpTransport, WaveClient, type WaveConfig } from './wave-client.ts';

export class CollectionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionConfigurationError';
  }
}

export function resolveCollectionChannel(
  contrat: { readonly canal: CanalEncaissement },
  config: WaveConfig,
  transport: HttpTransport,
): CollectionChannel {
  switch (contrat.canal) {
    case 'DRY_RUN':
      return new DryRunCollectionChannel(transport);
    case 'WAVE_CHECKOUT':
      return new WaveCheckoutChannel(new WaveClient(config, transport), config);
    default: {
      const jamais: never = contrat.canal;
      throw new CollectionConfigurationError(`canal d'encaissement inconnu : ${String(jamais)}`);
    }
  }
}
