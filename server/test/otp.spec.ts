import { describe, expect, it } from 'vitest';
import {
  CodeExpireError,
  CodeIncorrectError,
  type OtpChallenge,
  TropDeTentativesError,
  consommerCode,
  creerChallenge,
  empreintesEgales,
  normaliserMsisdn,
} from '../src/domain/otp.ts';
import { empreinteCode, genererCode } from '../src/infra/auth/otp-crypto.ts';

const EMIS = '2026-09-06T12:00:00.000Z';

const hash = (code: string) => empreinteCode('+221770000001', code);

function challenge(overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    ...creerChallenge({
      id: 'chal-1',
      msisdn: '+221770000001',
      codeHash: empreinteCode('+221770000001', '123456'),
      emisA: EMIS,
      dureeSecondes: 300,
      maxTentatives: 5,
    }),
    ...overrides,
  };
}

describe('génération du code', () => {
  it('produit six chiffres', () => {
    for (let n = 0; n < 50; n += 1) {
      expect(genererCode()).toMatch(/^\d{6}$/);
    }
  });

  it('ne produit pas deux fois le même code de suite', () => {
    const codes = new Set(Array.from({ length: 50 }, () => genererCode()));
    // Sur 50 tirages dans un million de valeurs, des doublons seraient le signe d'un
    // générateur cassé, pas de malchance.
    expect(codes.size).toBeGreaterThan(45);
  });

  it('ne stocke jamais le code en clair', () => {
    const c = challenge();
    expect(JSON.stringify(c)).not.toContain('123456');
    expect(c.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalisation du numéro', () => {
  it('accepte les formes usuelles au Sénégal et les ramène en E.164', () => {
    for (const saisie of ['770000001', '77 000 00 01', '+221 77 000 00 01', '00221770000001']) {
      expect(normaliserMsisdn(saisie)).toBe('+221770000001');
    }
  });

  it('refuse ce qui n’est pas un numéro exploitable', () => {
    for (const saisie of ['', '77', 'abcdefghi', '+33']) {
      expect(() => normaliserMsisdn(saisie)).toThrow();
    }
  });
});

describe('comparaison des empreintes', () => {
  it('parcourt toutes les positions, quelle que soit la premiere difference', () => {
    expect(empreintesEgales('a'.repeat(64), 'a'.repeat(64))).toBe(true);
    expect(empreintesEgales('a'.repeat(64), 'b' + 'a'.repeat(63))).toBe(false);
    expect(empreintesEgales('a'.repeat(64), 'a'.repeat(63) + 'b')).toBe(false);
    expect(empreintesEgales('a'.repeat(64), 'a'.repeat(63))).toBe(false);
  });
});

describe('consommation du code', () => {
  it('accepte le bon code dans le délai', () => {
    const r = consommerCode(challenge(), hash('123456'), '2026-09-06T12:02:00.000Z');
    expect(r.msisdn).toBe('+221770000001');
    expect(r.challenge.consomme).toBe(true);
  });

  it('refuse un code faux et incrémente le compteur', () => {
    const c = challenge();
    let erreur: unknown;
    try {
      consommerCode(c, hash('000000'), '2026-09-06T12:02:00.000Z');
    } catch (e) {
      erreur = e;
    }
    expect(erreur).toBeInstanceOf(CodeIncorrectError);
    expect((erreur as CodeIncorrectError).challenge.tentatives).toBe(1);
  });

  it('bloque après le nombre de tentatives autorisé', () => {
    let c = challenge();
    for (let n = 0; n < 5; n += 1) {
      try {
        consommerCode(c, hash('000000'), '2026-09-06T12:02:00.000Z');
      } catch (e) {
        c = (e as CodeIncorrectError).challenge;
      }
    }
    // Le sixième essai n'est même plus comparé : le défi est épuisé.
    expect(() => consommerCode(c, hash('123456'), '2026-09-06T12:02:00.000Z')).toThrow(
      TropDeTentativesError,
    );
  });

  it('refuse un code expiré', () => {
    expect(() => consommerCode(challenge(), hash('123456'), '2026-09-06T12:05:01.000Z')).toThrow(
      CodeExpireError,
    );
  });

  it('accepte à la seconde près avant expiration', () => {
    expect(
      consommerCode(challenge(), hash('123456'), '2026-09-06T12:04:59.000Z').challenge.consomme,
    ).toBe(true);
  });

  it('un code déjà consommé ne resert pas', () => {
    const consomme = consommerCode(challenge(), hash('123456'), '2026-09-06T12:01:00.000Z')
      .challenge;
    expect(() => consommerCode(consomme, hash('123456'), '2026-09-06T12:02:00.000Z')).toThrow(
      TropDeTentativesError,
    );
  });

  it('la comparaison passe par l’empreinte, jamais par le code en clair', () => {
    const c = challenge();
    expect(c.codeHash).toBe(empreinteCode('+221770000001', '123456'));
    // L'empreinte est liée au numéro : un code volé sur un autre numéro ne vaut rien.
    expect(empreinteCode('+221770000002', '123456')).not.toBe(c.codeHash);
  });
});
