import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money';
import {
  AlreadyRedeemedError,
  emitVoucher,
  type FuelVoucher,
  redeemVoucher,
  VoucherCancelledError,
  VoucherExpiredError,
  cancelVoucher,
  estExpire,
} from '../src/domain/fuel-voucher';

const EMISSION = '2026-09-06T10:00:00.000Z';
const EXPIRATION = '2026-09-07T10:00:00.000Z';

function bon(): FuelVoucher {
  return emitVoucher({
    id: 'BON-0001',
    driverId: 'chauffeur-7',
    montant: xof(20_000),
    emisA: EMISSION,
    validiteHeures: 24,
    paymentRef: 'wave-checkout-xyz',
  });
}

const CONSO = {
  redemptionId: 'scan-1',
  stationId: 'station-dakar-3',
  operateurId: 'pompiste-12',
  asOf: '2026-09-06T14:00:00.000Z',
};

describe('émission — le montant est figé au paiement', () => {
  it('émet un bon consommable, du montant payé', () => {
    const b = bon();
    expect(b.statut).toBe('EMIS');
    expect(b.montant).toBe(20_000);
    expect(b.expireA).toBe(EXPIRATION);
    expect(b.consommeA).toBeNull();
  });

  it('refuse un montant nul ou négatif — un bon sans contrepartie n’existe pas', () => {
    expect(() => emitVoucher({ ...bon(), montant: xof(0), validiteHeures: 24 })).toThrow(
      /strictement positif/i,
    );
  });

  it('refuse une validité nulle ou négative', () => {
    expect(() => emitVoucher({ ...bon(), validiteHeures: 0 })).toThrow(/validité/i);
    expect(() => emitVoucher({ ...bon(), validiteHeures: -1 })).toThrow(/validité/i);
  });
});

describe('consommation — usage unique, atomique', () => {
  it('EMIS → CONSOMME, avec la station et l’opérateur qui ont servi', () => {
    const { next, changed } = redeemVoucher(bon(), CONSO);
    expect(changed).toBe(true);
    expect(next.statut).toBe('CONSOMME');
    expect(next.montant).toBe(20_000);
    expect(next.consommeA).toBe(CONSO.asOf);
    expect(next.stationId).toBe('station-dakar-3');
    expect(next.operateurId).toBe('pompiste-12');
  });

  it('un second scan par un autre pompiste est refusé, avec le lieu et l’heure du premier', () => {
    const consomme = redeemVoucher(bon(), CONSO).next;
    let erreur: unknown;
    try {
      redeemVoucher(consomme, { ...CONSO, redemptionId: 'scan-2', operateurId: 'pompiste-99' });
    } catch (e) {
      erreur = e;
    }
    expect(erreur).toBeInstanceOf(AlreadyRedeemedError);
    expect((erreur as Error).message).toContain('station-dakar-3');
    expect((erreur as Error).message).toContain('2026-09-06T14:00:00.000Z');
  });

  it('le MÊME scan rejoué ne sert pas deux fois et ne fait pas échouer le pompiste', () => {
    // Réseau instable : le pompiste rescanne. Ce n'est pas une fraude, c'est un rejeu.
    let b = redeemVoucher(bon(), CONSO).next;
    const resultats: boolean[] = [];
    for (let n = 0; n < 5; n += 1) {
      const r = redeemVoucher(b, CONSO);
      resultats.push(r.changed);
      b = r.next;
    }
    expect(resultats).toEqual([false, false, false, false, false]);
    expect(b.statut).toBe('CONSOMME');
    expect(b.operateurId).toBe('pompiste-12');
  });

  it('refuse un bon expiré', () => {
    expect(() => redeemVoucher(bon(), { ...CONSO, asOf: '2026-09-07T10:00:01.000Z' })).toThrow(
      VoucherExpiredError,
    );
  });

  it('accepte à la seconde près avant expiration', () => {
    const r = redeemVoucher(bon(), { ...CONSO, asOf: '2026-09-07T09:59:59.000Z' });
    expect(r.next.statut).toBe('CONSOMME');
  });

  it('refuse un bon annulé', () => {
    const annule = cancelVoucher(bon(), { actor: 'admin', motif: 'paiement contesté' });
    expect(() => redeemVoucher(annule, CONSO)).toThrow(VoucherCancelledError);
  });
});

describe('annulation', () => {
  it('un bon consommé ne peut plus être annulé — le carburant est parti', () => {
    const consomme = redeemVoucher(bon(), CONSO).next;
    expect(() => cancelVoucher(consomme, { actor: 'admin', motif: 'erreur' })).toThrow(
      AlreadyRedeemedError,
    );
  });

  it('un bon émis peut être annulé, avec son motif', () => {
    const a = cancelVoucher(bon(), { actor: 'admin', motif: 'paiement contesté' });
    expect(a.statut).toBe('ANNULE');
    expect(a.motifAnnulation).toBe('paiement contesté');
  });
});

describe('expiration', () => {
  it('estExpire compare à la date fournie, jamais à l’horloge locale', () => {
    expect(estExpire(bon(), '2026-09-07T09:59:59.000Z')).toBe(false);
    expect(estExpire(bon(), '2026-09-07T10:00:01.000Z')).toBe(true);
  });

  it('un bon consommé n’est jamais considéré comme expiré', () => {
    const consomme = redeemVoucher(bon(), CONSO).next;
    expect(estExpire(consomme, '2027-01-01T00:00:00.000Z')).toBe(false);
  });
});
