/**
 * Sélection du canal de règlement par configuration (ADR-002).
 *
 * C'est le seul endroit du système qui connaît les trois implémentations. Le domaine métier
 * n'appelle jamais cette fonction : elle est invoquée au câblage, et le canal résolu lui est
 * passé sous la forme du port `SettlementChannel`.
 */

import type { CanalReglement } from '../../domain/payment-intent';
import type { SettlementChannel } from '../../ports/settlement-channel';
import { DryRunChannel } from './dry-run-channel';
import { B2BPayoutChannel, MobilePayoutChannel } from './payout-channels';
import { type HttpTransport, WaveClient, type WaveConfig } from './wave-client';

export interface ContratReglement {
  readonly canal: CanalReglement;
  readonly teB2bId?: string | null;
  readonly teMsisdn?: string | null;
}

export class ChannelConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelConfigurationError';
  }
}

export function resolveSettlementChannel(
  contrat: ContratReglement,
  config: WaveConfig,
  transport: HttpTransport,
): SettlementChannel {
  switch (contrat.canal) {
    case 'DRY_RUN':
      return new DryRunChannel(transport);

    case 'B2B': {
      if (!contrat.teB2bId) {
        throw new ChannelConfigurationError(
          'canal B2B sélectionné sans B2B ID du bénéficiaire (§14, paramètre 1)',
        );
      }
      return new B2BPayoutChannel(new WaveClient(config, transport), config, contrat.teB2bId);
    }

    case 'MOBILE': {
      if (!contrat.teMsisdn) {
        throw new ChannelConfigurationError(
          'canal MOBILE sélectionné sans numéro MSISDN du bénéficiaire (§14, paramètre 1)',
        );
      }
      return new MobilePayoutChannel(new WaveClient(config, transport), config, contrat.teMsisdn);
    }

    default: {
      const jamais: never = contrat.canal;
      throw new ChannelConfigurationError(`canal de règlement inconnu : ${String(jamais)}`);
    }
  }
}
