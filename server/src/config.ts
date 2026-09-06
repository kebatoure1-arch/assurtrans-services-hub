/**
 * Chargement de la configuration au démarrage.
 *
 * Principe : **échouer au démarrage, pas au premier paiement.** Un secret manquant, un canal mal
 * configuré ou un plafond absent empêchent le serveur de démarrer. Aucune valeur de repli n'est
 * fournie pour une valeur sensible ou monétaire.
 */

import { xof, type XOF } from './domain/money';
import type { CanalReglement } from './domain/payment-intent';
import type { SecretProvider } from './infra/secrets/secrets';
import type { WaveConfig } from './infra/wave/wave-client';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface PlafondsServeur {
  /** Montant maximal d'un règlement unitaire. */
  readonly maxUnitaireXof: XOF;
  /** Cumul maximal réglé sur une journée civile. */
  readonly maxQuotidienXof: XOF;
}

export interface AppConfig {
  readonly wave: WaveConfig;
  readonly canalParDefaut: CanalReglement;
  readonly plafonds: PlafondsServeur;
}

function requis(env: Record<string, string | undefined>, nom: string): string {
  const v = env[nom];
  if (v === undefined || v.trim() === '') {
    throw new ConfigurationError(`variable d'environnement « ${nom} » absente ou vide`);
  }
  return v.trim();
}

function montantRequis(env: Record<string, string | undefined>, nom: string): XOF {
  const brut = requis(env, nom);
  if (!/^\d+$/.test(brut)) {
    throw new ConfigurationError(
      `« ${nom} » doit être un entier de francs CFA, sans séparateur ni décimale (reçu « ${brut} »)`,
    );
  }
  return xof(Number(brut));
}

function canalRequis(env: Record<string, string | undefined>): CanalReglement {
  const brut = requis(env, 'SETTLEMENT_CHANNEL');
  if (brut !== 'DRY_RUN' && brut !== 'B2B' && brut !== 'MOBILE') {
    throw new ConfigurationError(
      `« SETTLEMENT_CHANNEL » doit valoir DRY_RUN, B2B ou MOBILE (reçu « ${brut} »)`,
    );
  }
  return brut;
}

/**
 * Construit la configuration applicative.
 *
 * `SETTLEMENT_CHANNEL` autre que `DRY_RUN` exige que les paramètres §14 aient été obtenus :
 * le nom du champ de référence d'imputation devient alors obligatoire, faute de quoi un
 * versement partirait sans référence exploitable par TotalEnergies.
 */
export async function loadConfig(
  secrets: SecretProvider,
  env: Record<string, string | undefined> = process.env,
): Promise<AppConfig> {
  const canalParDefaut = canalRequis(env);
  const payoutReferenceField = env.WAVE_PAYOUT_REFERENCE_FIELD?.trim() ?? '';

  if (canalParDefaut !== 'DRY_RUN' && payoutReferenceField === '') {
    throw new ConfigurationError(
      `canal « ${canalParDefaut} » demandé sans WAVE_PAYOUT_REFERENCE_FIELD : le versement ` +
        'partirait sans référence d’imputation et serait irrattachable côté TotalEnergies ' +
        '(§14, paramètre 2).',
    );
  }

  return {
    canalParDefaut,
    wave: {
      baseUrl: env.WAVE_BASE_URL?.trim() || 'https://api.wave.com',
      apiKey: await secrets.get('WAVE_API_KEY'),
      payoutReferenceField,
    },
    plafonds: {
      maxUnitaireXof: montantRequis(env, 'PLAFOND_UNITAIRE_XOF'),
      maxQuotidienXof: montantRequis(env, 'PLAFOND_QUOTIDIEN_XOF'),
    },
  };
}
