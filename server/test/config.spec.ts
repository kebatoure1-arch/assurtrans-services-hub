import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadConfig } from '../src/config';
import { EnvSecretProvider, MissingSecretError } from '../src/infra/secrets/secrets';

const secrets = new EnvSecretProvider({ WAVE_API_KEY: 'wave_sn_prod_XYZ123456' });

const ENV_MINIMAL = {
  SETTLEMENT_CHANNEL: 'DRY_RUN',
  COLLECTION_CHANNEL: 'DRY_RUN',
  VALIDITE_BON_HEURES: '24',
  PLAFOND_UNITAIRE_XOF: '10000000',
  PLAFOND_QUOTIDIEN_XOF: '20000000',
};

describe('loadConfig — échouer au démarrage, pas au premier paiement', () => {
  it('charge une configuration DRY_RUN complète', async () => {
    const c = await loadConfig(secrets, ENV_MINIMAL);
    expect(c.canalParDefaut).toBe('DRY_RUN');
    expect(c.wave.baseUrl).toBe('https://api.wave.com');
    expect(c.plafonds.maxUnitaireXof).toBe(10_000_000);
  });

  it('la configuration chargée ne révèle jamais la clé, même sérialisée', async () => {
    const c = await loadConfig(secrets, ENV_MINIMAL);
    expect(JSON.stringify(c)).not.toContain('wave_sn_prod');
    expect(`${c.wave.apiKey}`).toBe('[REDACTED:WAVE_API_KEY]');
  });

  it('refuse de démarrer sans clé Wave', async () => {
    await expect(loadConfig(new EnvSecretProvider({}), ENV_MINIMAL)).rejects.toThrow(
      MissingSecretError,
    );
  });

  it('refuse un canal inconnu', async () => {
    await expect(
      loadConfig(secrets, { ...ENV_MINIMAL, SETTLEMENT_CHANNEL: 'CHECKOUT' }),
    ).rejects.toThrow(ConfigurationError);
  });

  it('refuse B2B sans champ de référence d’imputation (§14, paramètre 2)', async () => {
    await expect(
      loadConfig(secrets, { ...ENV_MINIMAL, SETTLEMENT_CHANNEL: 'B2B' }),
    ).rejects.toThrow(/référence d’imputation/);
  });

  it('accepte B2B dès que le champ de référence est renseigné', async () => {
    const c = await loadConfig(secrets, {
      ...ENV_MINIMAL,
      SETTLEMENT_CHANNEL: 'B2B',
      WAVE_PAYOUT_REFERENCE_FIELD: 'client_reference',
    });
    expect(c.canalParDefaut).toBe('B2B');
  });

  it('refuse un encaissement WAVE_CHECKOUT sans champ d’URL de paiement', async () => {
    await expect(
      loadConfig(secrets, { ...ENV_MINIMAL, COLLECTION_CHANNEL: 'WAVE_CHECKOUT' }),
    ).rejects.toThrow(/où renvoyer le chauffeur/);
  });

  it('accepte WAVE_CHECKOUT dès que le champ d’URL est renseigné', async () => {
    const c = await loadConfig(secrets, {
      ...ENV_MINIMAL,
      COLLECTION_CHANNEL: 'WAVE_CHECKOUT',
      WAVE_CHECKOUT_LAUNCH_URL_FIELD: 'wave_launch_url',
    });
    expect(c.canalEncaissement).toBe('WAVE_CHECKOUT');
  });

  it('refuse une validité de bon absente ou nulle', async () => {
    await expect(
      loadConfig(secrets, { ...ENV_MINIMAL, VALIDITE_BON_HEURES: '0' }),
    ).rejects.toThrow(/VALIDITE_BON_HEURES/);
  });

  it('refuse un plafond absent — pas de valeur de repli sur un montant', async () => {
    const { PLAFOND_UNITAIRE_XOF, ...sansPlafond } = ENV_MINIMAL;
    void PLAFOND_UNITAIRE_XOF;
    await expect(loadConfig(secrets, sansPlafond)).rejects.toThrow(/PLAFOND_UNITAIRE_XOF/);
  });

  it('refuse un plafond décimal ou formaté', async () => {
    await expect(
      loadConfig(secrets, { ...ENV_MINIMAL, PLAFOND_UNITAIRE_XOF: '10 000 000' }),
    ).rejects.toThrow(ConfigurationError);
    await expect(
      loadConfig(secrets, { ...ENV_MINIMAL, PLAFOND_QUOTIDIEN_XOF: '20000000.50' }),
    ).rejects.toThrow(ConfigurationError);
  });
});
