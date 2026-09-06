/**
 * Chargement de la configuration au démarrage.
 *
 * Principe : **échouer au démarrage, pas au premier paiement.** Un secret manquant, un canal mal
 * configuré ou un plafond absent empêchent le serveur de démarrer. Aucune valeur de repli n'est
 * fournie pour une valeur sensible ou monétaire.
 */

import { xof, type XOF } from './domain/money.ts';
import type { CanalReglement } from './domain/payment-intent.ts';
import type { CanalEncaissement } from './ports/collection-channel.ts';
import type { Secret, SecretProvider } from './infra/secrets/secrets.ts';
import type { WaveConfig } from './infra/wave/wave-client.ts';

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
  /** Canal de sortie de fonds — règlement de TotalEnergies. */
  readonly canalParDefaut: CanalReglement;
  /** Canal d'entrée de fonds — encaissement des chauffeurs. */
  readonly canalEncaissement: CanalEncaissement;
  readonly plafonds: PlafondsServeur;
  /** Durée de validité d'un bon carburant, en heures. */
  readonly validiteBonHeures: number;
  /** Bornes du montant d'un bon. Un chauffeur ne demande ni 1 franc ni 100 millions. */
  readonly montantBon: { readonly minXof: XOF; readonly maxXof: XOF };
  readonly webhook: { readonly signatureHeader: string; readonly toleranceSecondes: number };
  readonly checkout: {
    readonly eventType: string;
    readonly referencePath: string;
    readonly montantPath: string;
  };
  readonly port: number;
  readonly otp: {
    readonly dureeSecondes: number;
    readonly maxTentatives: number;
    readonly maxDemandesParHeure: number;
    readonly echoCode: boolean;
  };
  readonly sms: {
    readonly provider: 'AFRICAS_TALKING' | 'LOG';
    readonly apiKey: Secret | null;
    readonly username: string | null;
    readonly baseUrl: string;
    readonly senderId: string | null;
  };
  readonly sessionDureeHeures: number;
  /** Origines autorisees pour le front. Liste explicite, pas de joker. */
  readonly originesAutorisees: readonly string[];
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

function canalEncaissementRequis(env: Record<string, string | undefined>): CanalEncaissement {
  const brut = requis(env, 'COLLECTION_CHANNEL');
  if (brut !== 'DRY_RUN' && brut !== 'WAVE_CHECKOUT') {
    throw new ConfigurationError(
      `« COLLECTION_CHANNEL » doit valoir DRY_RUN ou WAVE_CHECKOUT (reçu « ${brut} »)`,
    );
  }
  return brut;
}

function entierRequis(env: Record<string, string | undefined>, nom: string): number {
  const brut = requis(env, nom);
  if (!/^\d+$/.test(brut) || Number(brut) <= 0) {
    throw new ConfigurationError(`« ${nom} » doit être un entier > 0 (reçu « ${brut} »)`);
  }
  return Number(brut);
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
  const canalEncaissement = canalEncaissementRequis(env);
  const payoutReferenceField = env.WAVE_PAYOUT_REFERENCE_FIELD?.trim() ?? '';
  const checkoutLaunchUrlField = env.WAVE_CHECKOUT_LAUNCH_URL_FIELD?.trim() ?? '';
  const smsProvider = env.OTP_SMS_PROVIDER?.trim() || 'LOG';
  if (smsProvider !== 'AFRICAS_TALKING' && smsProvider !== 'LOG') {
    throw new ConfigurationError(
      `« OTP_SMS_PROVIDER » doit valoir AFRICAS_TALKING ou LOG (reçu « ${smsProvider} »)`,
    );
  }

  if (canalParDefaut !== 'DRY_RUN' && payoutReferenceField === '') {
    throw new ConfigurationError(
      `canal « ${canalParDefaut} » demandé sans WAVE_PAYOUT_REFERENCE_FIELD : le versement ` +
        'partirait sans référence d’imputation et serait irrattachable côté TotalEnergies ' +
        '(§14, paramètre 2).',
    );
  }

  if (canalEncaissement === 'WAVE_CHECKOUT' && checkoutLaunchUrlField === '') {
    throw new ConfigurationError(
      'encaissement WAVE_CHECKOUT demandé sans WAVE_CHECKOUT_LAUNCH_URL_FIELD : la session ' +
        'serait ouverte sans savoir où renvoyer le chauffeur pour payer.',
    );
  }

  const montantBonMin = montantRequis(env, 'MONTANT_BON_MIN_XOF');
  const montantBonMax = montantRequis(env, 'MONTANT_BON_MAX_XOF');
  if (montantBonMin >= montantBonMax) {
    throw new ConfigurationError(
      `MONTANT_BON_MIN_XOF (${montantBonMin}) doit être strictement inférieur à ` +
        `MONTANT_BON_MAX_XOF (${montantBonMax})`,
    );
  }

  return {
    canalParDefaut,
    canalEncaissement,
    montantBon: { minXof: montantBonMin, maxXof: montantBonMax },
    webhook: {
      // Vide ⇒ la vérification refuse de s'exécuter. Voir infra/webhooks/webhook.ts.
      signatureHeader: env.WAVE_WEBHOOK_SIGNATURE_HEADER?.trim() ?? '',
      toleranceSecondes: entierRequis(env, 'WEBHOOK_TOLERANCE_SECONDES'),
    },
    checkout: {
      eventType: env.CHECKOUT_EVENT_TYPE?.trim() ?? '',
      referencePath: env.CHECKOUT_REFERENCE_PATH?.trim() ?? '',
      montantPath: env.CHECKOUT_AMOUNT_PATH?.trim() ?? '',
    },
    port: entierRequis(env, 'PORT'),
    otp: {
      dureeSecondes: entierRequis(env, 'OTP_DUREE_SECONDES'),
      maxTentatives: entierRequis(env, 'OTP_MAX_TENTATIVES'),
      maxDemandesParHeure: entierRequis(env, 'OTP_MAX_DEMANDES_PAR_HEURE'),
      // Renvoie le code dans la reponse HTTP. Vrai uniquement en demonstration.
      echoCode: env.OTP_ECHO === 'true',
    },
    sms: {
      provider: smsProvider,
      apiKey: smsProvider === 'AFRICAS_TALKING' ? await secrets.get('AFRICAS_TALKING_API_KEY') : null,
      username: smsProvider === 'AFRICAS_TALKING' ? requis(env, 'AFRICAS_TALKING_USERNAME') : null,
      baseUrl: env.AFRICAS_TALKING_BASE_URL?.trim() || 'https://api.africastalking.com',
      senderId: env.AFRICAS_TALKING_SENDER_ID?.trim() || null,
    },
    sessionDureeHeures: entierRequis(env, 'SESSION_DUREE_HEURES'),
    originesAutorisees: (env.ORIGINES_AUTORISEES ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0),
    validiteBonHeures: entierRequis(env, 'VALIDITE_BON_HEURES'),
    wave: {
      baseUrl: env.WAVE_BASE_URL?.trim() || 'https://api.wave.com',
      apiKey: await secrets.get('WAVE_API_KEY'),
      payoutReferenceField,
      checkoutLaunchUrlField,
    },
    plafonds: {
      maxUnitaireXof: montantRequis(env, 'PLAFOND_UNITAIRE_XOF'),
      maxQuotidienXof: montantRequis(env, 'PLAFOND_QUOTIDIEN_XOF'),
    },
  };
}
