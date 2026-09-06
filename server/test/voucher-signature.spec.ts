import { describe, expect, it } from 'vitest';
import { Secret } from '../src/infra/secrets/secrets';
import {
  InvalidSignatureError,
  MalformedTokenError,
  VoucherSigner,
} from '../src/infra/security/voucher-signature';

const CLE = new Secret('a'.repeat(64), 'QR_SIGNATURE_SECRET');
const AUTRE_CLE = new Secret('b'.repeat(64), 'QR_SIGNATURE_SECRET');

const signer = new VoucherSigner(CLE);

const CHARGE = { id: 'BON-0001', montant: 20_000, expireA: '2026-09-07T10:00:00.000Z' };

describe('signature du bon — le QR ne doit pas être forgeable', () => {
  it('signe puis relit la charge à l’identique', () => {
    const jeton = signer.sign(CHARGE);
    expect(signer.verify(jeton)).toEqual(CHARGE);
  });

  it('produit un jeton compact, transportable dans un QR', () => {
    const jeton = signer.sign(CHARGE);
    expect(jeton.length).toBeLessThan(200);
    expect(jeton.startsWith('AT1.')).toBe(true);
  });

  it('rejette un montant modifié — le cas qui coûte de l’argent', () => {
    const jeton = signer.sign(CHARGE);
    const [prefixe, charge, signature] = jeton.split('.');
    const gonflee = Buffer.from(
      JSON.stringify({ v: 1, i: CHARGE.id, m: 200_000, e: CHARGE.expireA }),
    ).toString('base64url');
    void charge;
    expect(() => signer.verify(`${prefixe}.${gonflee}.${signature}`)).toThrow(
      InvalidSignatureError,
    );
  });

  it('rejette un identifiant modifié', () => {
    const jeton = signer.sign(CHARGE);
    const [prefixe, , signature] = jeton.split('.');
    const autre = Buffer.from(
      JSON.stringify({ v: 1, i: 'BON-9999', m: CHARGE.montant, e: CHARGE.expireA }),
    ).toString('base64url');
    expect(() => signer.verify(`${prefixe}.${autre}.${signature}`)).toThrow(InvalidSignatureError);
  });

  it('rejette une signature tronquée', () => {
    const jeton = signer.sign(CHARGE);
    expect(() => signer.verify(jeton.slice(0, -4))).toThrow(InvalidSignatureError);
  });

  it('rejette un jeton signé avec une autre clé', () => {
    const jeton = new VoucherSigner(AUTRE_CLE).sign(CHARGE);
    expect(() => signer.verify(jeton)).toThrow(InvalidSignatureError);
  });

  it('rejette un jeton mal formé sans exposer la raison exacte', () => {
    for (const mauvais of ['', 'nimportequoi', 'AT1.', 'AT1.abc', 'AT2.abc.def', 'a.b.c.d']) {
      expect(() => signer.verify(mauvais)).toThrow(MalformedTokenError);
    }
  });

  it('rejette une charge valide mais dont le JSON n’a pas la forme attendue', () => {
    const charge = Buffer.from(JSON.stringify({ v: 1, i: 'BON-1' })).toString('base64url');
    const jeton = signer.sign(CHARGE);
    const [prefixe, , signature] = jeton.split('.');
    expect(() => signer.verify(`${prefixe}.${charge}.${signature}`)).toThrow();
  });

  it('ne révèle jamais la clé dans un message d’erreur', () => {
    try {
      signer.verify('AT1.abc.def');
    } catch (e) {
      expect((e as Error).message).not.toContain('aaaa');
    }
    const jeton = new VoucherSigner(AUTRE_CLE).sign(CHARGE);
    try {
      signer.verify(jeton);
    } catch (e) {
      expect((e as Error).message).not.toContain('aaaa');
      expect((e as Error).message).not.toContain('bbbb');
    }
  });
});

describe('rotation de la clé de signature', () => {
  it('un bon signé avec l’ancienne clé reste vérifiable pendant la rotation', () => {
    // Les bons vivent 24 h : changer la clé ne doit pas invalider ceux déjà envoyés.
    const apresRotation = new VoucherSigner(AUTRE_CLE, [CLE]);
    const ancien = signer.sign(CHARGE);
    expect(apresRotation.verify(ancien)).toEqual(CHARGE);
  });

  it('les nouveaux bons sont signés avec la clé active uniquement', () => {
    const apresRotation = new VoucherSigner(AUTRE_CLE, [CLE]);
    const nouveau = apresRotation.sign(CHARGE);
    expect(() => signer.verify(nouveau)).toThrow(InvalidSignatureError);
  });

  it('une fois l’ancienne clé retirée, ses bons ne passent plus', () => {
    const ancien = signer.sign(CHARGE);
    expect(() => new VoucherSigner(AUTRE_CLE).verify(ancien)).toThrow(InvalidSignatureError);
  });
});
