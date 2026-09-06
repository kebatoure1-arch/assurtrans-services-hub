import { describe, expect, it, vi } from 'vitest';
import {
  ClientBundleLeakError,
  MissingSecretError,
  redact,
  Secret,
  EnvSecretProvider,
  CachingSecretProvider,
} from '../src/infra/secrets/secrets.ts';

describe('Secret — une valeur qui refuse de se laisser journaliser', () => {
  const s = new Secret('wave_sn_prod_ABCDEF123456', 'WAVE_API_KEY');

  it('ne s’imprime jamais dans une interpolation', () => {
    expect(`clé = ${s}`).toBe('clé = [REDACTED:WAVE_API_KEY]');
    expect(String(s)).toBe('[REDACTED:WAVE_API_KEY]');
  });

  it('ne s’imprime jamais dans une sérialisation JSON', () => {
    const json = JSON.stringify({ config: { apiKey: s, baseUrl: 'https://api.wave.com' } });
    expect(json).not.toContain('wave_sn_prod');
    expect(json).toContain('[REDACTED:WAVE_API_KEY]');
  });

  it('n’apparaît pas dans les propriétés énumérables de l’objet', () => {
    expect(Object.values(s)).not.toContain('wave_sn_prod_ABCDEF123456');
    expect(JSON.stringify(Object.assign({}, s))).not.toContain('wave_sn_prod');
  });

  it('ne fuit pas via console.log', () => {
    const espion = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('%s', s);
    console.log(`${s}`);
    const imprime = espion.mock.calls.flat().map(String).join(' ');
    expect(imprime).not.toContain('wave_sn_prod');
    espion.mockRestore();
  });

  it('ne se révèle que par un appel explicite et nommé', () => {
    expect(s.expose()).toBe('wave_sn_prod_ABCDEF123456');
  });

  it('compare en temps constant, sans révéler la valeur', () => {
    expect(s.equals(new Secret('wave_sn_prod_ABCDEF123456', 'AUTRE'))).toBe(true);
    expect(s.equals(new Secret('wave_sn_prod_ABCDEF123457', 'AUTRE'))).toBe(false);
    expect(s.equals(new Secret('court', 'AUTRE'))).toBe(false);
  });

  it('refuse une valeur vide — un secret vide est une configuration cassée', () => {
    expect(() => new Secret('', 'X')).toThrow(MissingSecretError);
    expect(() => new Secret('   ', 'X')).toThrow(MissingSecretError);
  });
});

describe('redact — filet de sécurité sur les traces et les messages d’erreur', () => {
  const cle = new Secret('wave_sn_prod_ABCDEF123456', 'WAVE_API_KEY');

  it('masque la valeur partout où elle apparaît', () => {
    const trace = 'POST /v1/b2b/payout Authorization: Bearer wave_sn_prod_ABCDEF123456 -> 500';
    expect(redact(trace, [cle])).toBe(
      'POST /v1/b2b/payout Authorization: Bearer [REDACTED:WAVE_API_KEY] -> 500',
    );
  });

  it('masque toutes les occurrences, pas seulement la première', () => {
    const t = redact('wave_sn_prod_ABCDEF123456 et wave_sn_prod_ABCDEF123456', [cle]);
    expect(t).not.toContain('wave_sn_prod');
  });

  it('laisse le texte intact quand aucun secret n’y figure', () => {
    expect(redact('rien à cacher', [cle])).toBe('rien à cacher');
  });
});

describe('EnvSecretProvider — le serveur lit, le bundle client jamais', () => {
  it('lit une variable serveur', async () => {
    const p = new EnvSecretProvider({ WAVE_API_KEY: 'wave_sn_prod_XYZ' });
    expect((await p.get('WAVE_API_KEY')).expose()).toBe('wave_sn_prod_XYZ');
  });

  it('refuse tout nom préfixé VITE_ — Vite l’inline dans le bundle client', async () => {
    const p = new EnvSecretProvider({ VITE_WAVE_API_KEY: 'wave_sn_prod_XYZ' });
    await expect(p.get('VITE_WAVE_API_KEY')).rejects.toThrow(ClientBundleLeakError);
  });

  it('refuse même si la variable VITE_ est la seule disponible — pas de repli', async () => {
    const p = new EnvSecretProvider({ VITE_WAVE_API_KEY: 'wave_sn_prod_XYZ' });
    await expect(p.get('WAVE_API_KEY')).rejects.toThrow(MissingSecretError);
  });

  it('échoue vite sur un secret manquant, sans valeur de repli', async () => {
    const p = new EnvSecretProvider({});
    await expect(p.get('WAVE_API_KEY')).rejects.toThrow(MissingSecretError);
  });

  it('le message d’erreur nomme la variable mais ne contient aucune valeur', async () => {
    const p = new EnvSecretProvider({ AUTRE: 'wave_sn_prod_XYZ' });
    await expect(p.get('WAVE_API_KEY')).rejects.toThrow(/WAVE_API_KEY/);
    await expect(p.get('WAVE_API_KEY')).rejects.not.toThrow(/wave_sn_prod/);
  });
});

describe('CachingSecretProvider — une rotation reste possible', () => {
  it('ne relit la source qu’une fois par secret', async () => {
    let lectures = 0;
    const cache = new CachingSecretProvider({
      async get(nom) {
        lectures += 1;
        return new Secret(`valeur-${nom}`, nom);
      },
    });
    await cache.get('WAVE_API_KEY');
    await cache.get('WAVE_API_KEY');
    expect(lectures).toBe(1);
  });

  it('invalide le cache à la demande, pour une rotation sans redémarrage', async () => {
    let valeur = 'ancienne';
    const cache = new CachingSecretProvider({
      async get(nom) {
        return new Secret(valeur, nom);
      },
    });
    expect((await cache.get('WAVE_API_KEY')).expose()).toBe('ancienne');
    valeur = 'nouvelle';
    cache.invalidate('WAVE_API_KEY');
    expect((await cache.get('WAVE_API_KEY')).expose()).toBe('nouvelle');
  });
});
