import { describe, expect, it, beforeEach } from 'vitest';
import { xof } from '../src/domain/money.ts';
import type { FuelVoucher, VoucherStatut } from '../src/domain/fuel-voucher.ts';
import { Secret } from '../src/infra/secrets/secrets.ts';
import { VoucherSigner } from '../src/infra/security/voucher-signature.ts';
import { EmitVoucherOnPayment } from '../src/application/emit-voucher-on-payment.ts';
import {
  MontantIncoherentError,
  RedeemVoucherAtStation,
  VoucherIntrouvableError,
} from '../src/application/redeem-voucher-at-station.ts';
import { AlreadyRedeemedError, VoucherExpiredError } from '../src/domain/fuel-voucher.ts';
import type {
  Driver,
  DriverPayment,
  DriverPaymentRepository,
  DriverRepository,
  DeliveryRequest,
  VoucherDeliveryQueue,
  VoucherRepository,
} from '../src/ports/repositories.ts';

// --------------------------------------------------------------- doublures

class PaiementsEnMemoire implements DriverPaymentRepository {
  readonly lignes = new Map<string, DriverPayment>();
  private cle = (c: string, r: string) => `${c}|${r}`;

  async findByReference(canal: string, reference: string) {
    return this.lignes.get(this.cle(canal, reference)) ?? null;
  }
  async saveIfNew(p: DriverPayment) {
    const k = this.cle(p.canal, p.reference);
    if (this.lignes.has(k)) return false;
    this.lignes.set(k, p);
    return true;
  }
}

class BonsEnMemoire implements VoucherRepository {
  readonly lignes = new Map<string, FuelVoucher>();
  readonly parPaiement = new Map<string, string>();

  async findById(id: string) {
    return this.lignes.get(id) ?? null;
  }
  async findByPaymentId(paymentId: string) {
    const id = this.parPaiement.get(paymentId);
    return id ? (this.lignes.get(id) ?? null) : null;
  }
  async saveIfNew(bon: FuelVoucher, paymentId: string) {
    if (this.parPaiement.has(paymentId)) return false;
    this.parPaiement.set(paymentId, bon.id);
    this.lignes.set(bon.id, bon);
    return true;
  }
  async saveIfStatut(bon: FuelVoucher, statutAttendu: VoucherStatut) {
    const actuel = this.lignes.get(bon.id);
    if (!actuel || actuel.statut !== statutAttendu) return false;
    this.lignes.set(bon.id, bon);
    return true;
  }
  async listerParChauffeur(driverId: string, limite: number) {
    return [...this.lignes.values()].filter((b) => b.driverId === driverId).slice(0, limite);
  }
}

class ChauffeursEnMemoire implements DriverRepository {
  constructor(private readonly liste: Driver[]) {}
  async findById(id: string) {
    return this.liste.find((d) => d.id === id) ?? null;
  }
}

class FileEnMemoire implements VoucherDeliveryQueue {
  readonly envois: DeliveryRequest[] = [];
  echoue = false;
  async enqueue(d: DeliveryRequest) {
    if (this.echoue) throw new Error('file indisponible');
    this.envois.push(d);
    return `envoi-${this.envois.length}`;
  }

  // Ces doublures ne servent qu'à l'émission : la dépile est éprouvée dans
  // `envoi-des-bons.spec.ts` et contre une vraie base.
  async reclamer() {
    return [];
  }
  async marquerEnvoye() {
    /* sans objet ici */
  }
  async marquerEchec() {
    /* sans objet ici */
  }
}

function compteur(prefixe: string) {
  let n = 0;
  return {
    next: () => {
      n += 1;
      return `${prefixe}-${n}`;
    },
  };
}

// --------------------------------------------------------------- montage

const CLE = new Secret('e'.repeat(64), 'QR_SIGNATURE_SECRET');
const signer = new VoucherSigner(CLE);

const CHAUFFEUR: Driver = {
  id: 'chauffeur-7',
  nom: 'Moussa Ndiaye',
  msisdn: '+221770000001',
  statut: 'ACTIF',
};

const PAIEMENT = {
  canal: 'WAVE_CHECKOUT',
  reference: 'cos-1',
  driverId: 'chauffeur-7',
  montant: xof(20_000),
  recuA: '2026-09-06T10:00:00.000Z',
};

let paiements: PaiementsEnMemoire;
let bons: BonsEnMemoire;
let file: FileEnMemoire;
let emission: EmitVoucherOnPayment;

beforeEach(() => {
  paiements = new PaiementsEnMemoire();
  bons = new BonsEnMemoire();
  file = new FileEnMemoire();
  emission = new EmitVoucherOnPayment({
    paiements,
    bons,
    chauffeurs: new ChauffeursEnMemoire([CHAUFFEUR]),
    file,
    signer,
    idsPaiement: compteur('PAY'),
    idsBon: compteur('BON'),
    validiteHeures: 24,
  });
});

// --------------------------------------------------------------- émission

describe('paiement confirmé → bon émis', () => {
  it('émet un bon du montant payé, ni plus ni moins', async () => {
    const r = await emission.execute(PAIEMENT);
    expect(r.deja).toBe(false);
    expect(r.bon.montant).toBe(20_000);
    expect(r.bon.statut).toBe('EMIS');
    expect(r.bon.driverId).toBe('chauffeur-7');
    expect(r.bon.expireA).toBe('2026-09-07T10:00:00.000Z');
  });

  it('produit un QR signé, vérifiable, portant le bon montant', async () => {
    const r = await emission.execute(PAIEMENT);
    expect(signer.verify(r.token)).toEqual({
      id: r.bon.id,
      montant: 20_000,
      expireA: r.bon.expireA,
    });
  });

  it('met l’envoi en file vers le numéro du chauffeur', async () => {
    const r = await emission.execute(PAIEMENT);
    expect(file.envois).toHaveLength(1);
    expect(file.envois[0]).toMatchObject({
      voucherId: r.bon.id,
      destinataire: '+221770000001',
      montant: 20_000,
    });
  });

  it('rejouer le même paiement n’émet pas un second bon', async () => {
    const resultats = [];
    for (let n = 0; n < 5; n += 1) {
      resultats.push(await emission.execute(PAIEMENT));
    }
    expect(resultats.map((r) => r.deja)).toEqual([false, true, true, true, true]);
    expect(new Set(resultats.map((r) => r.bon.id)).size).toBe(1);
    expect(bons.lignes.size).toBe(1);
    expect(file.envois).toHaveLength(1);
  });

  it('refuse un paiement pour un chauffeur inconnu', async () => {
    await expect(emission.execute({ ...PAIEMENT, driverId: 'inconnu' })).rejects.toThrow(
      /chauffeur/i,
    );
    expect(bons.lignes.size).toBe(0);
  });

  it('refuse un paiement pour un chauffeur suspendu', async () => {
    const avecSuspendu = new EmitVoucherOnPayment({
      paiements,
      bons,
      chauffeurs: new ChauffeursEnMemoire([{ ...CHAUFFEUR, statut: 'SUSPENDU' }]),
      file,
      signer,
      idsPaiement: compteur('PAY'),
      idsBon: compteur('BON'),
      validiteHeures: 24,
    });
    await expect(avecSuspendu.execute(PAIEMENT)).rejects.toThrow(/suspendu/i);
  });

  it('le chauffeur garde son bon même si la file d’envoi est indisponible', async () => {
    // Il a payé. Un WhatsApp en panne ne doit pas lui faire perdre son carburant.
    file.echoue = true;
    const r = await emission.execute(PAIEMENT);
    expect(r.bon.statut).toBe('EMIS');
    expect(r.envoiEnEchec).toBe(true);
    expect(await bons.findById(r.bon.id)).not.toBeNull();
  });
});

// --------------------------------------------------------------- consommation

describe('consommation en station', () => {
  const SCAN = {
    stationId: 'station-3',
    operateurId: 'pompiste-12',
    redemptionId: 'scan-1',
    asOf: '2026-09-06T14:00:00.000Z',
  };

  async function bonEmis() {
    const r = await emission.execute(PAIEMENT);
    return { token: r.token, id: r.bon.id };
  }

  function station() {
    return new RedeemVoucherAtStation({ bons, signer });
  }

  it('un jeton valide consomme le bon et rend le montant à servir', async () => {
    const { token, id } = await bonEmis();
    const r = await station().execute({ token, ...SCAN });

    expect(r.servi).toBe(true);
    expect(r.montant).toBe(20_000);
    expect((await bons.findById(id))?.statut).toBe('CONSOMME');
  });

  it('un jeton forgé est refusé sans jamais toucher la base', async () => {
    const autre = new VoucherSigner(new Secret('f'.repeat(64), 'QR_SIGNATURE_SECRET'));
    await bonEmis();
    const forge = autre.sign({ id: 'BON-1', montant: 500_000, expireA: '2027-01-01T00:00:00.000Z' });

    await expect(station().execute({ token: forge, ...SCAN })).rejects.toThrow(/signature/i);
    expect([...bons.lignes.values()].every((b) => b.statut === 'EMIS')).toBe(true);
  });

  it('un bon inconnu est refusé', async () => {
    const orphelin = signer.sign({
      id: 'BON-999',
      montant: 20_000,
      expireA: '2027-01-01T00:00:00.000Z',
    });
    await expect(station().execute({ token: orphelin, ...SCAN })).rejects.toThrow(
      VoucherIntrouvableError,
    );
  });

  it('un montant divergent entre le jeton et la base est refusé — la base fait foi', async () => {
    // Cas d'une clé de signature compromise : le jeton est « valide » mais ment.
    const { id } = await bonEmis();
    const menteur = signer.sign({ id, montant: 500_000, expireA: '2027-01-01T00:00:00.000Z' });

    await expect(station().execute({ token: menteur, ...SCAN })).rejects.toThrow(
      MontantIncoherentError,
    );
    expect((await bons.findById(id))?.statut).toBe('EMIS');
  });

  it('un second pompiste sur le même bon est refusé, avec la trace du premier', async () => {
    const { token } = await bonEmis();
    await station().execute({ token, ...SCAN });

    await expect(
      station().execute({ token, ...SCAN, redemptionId: 'scan-2', operateurId: 'pompiste-99' }),
    ).rejects.toThrow(AlreadyRedeemedError);
  });

  it('le même scan rejoué confirme sans servir deux fois', async () => {
    const { token } = await bonEmis();
    const premier = await station().execute({ token, ...SCAN });
    const rejeu = await station().execute({ token, ...SCAN });

    expect(premier.servi).toBe(true);
    expect(rejeu.servi).toBe(false);
    expect(rejeu.montant).toBe(20_000);
  });

  it('un bon expiré est refusé', async () => {
    const { token } = await bonEmis();
    await expect(
      station().execute({ token, ...SCAN, asOf: '2026-09-08T00:00:00.000Z' }),
    ).rejects.toThrow(VoucherExpiredError);
  });

  it('deux pompistes simultanés : un seul sert', async () => {
    const { token } = await bonEmis();
    const resultats = await Promise.allSettled([
      station().execute({ token, ...SCAN, redemptionId: 'scan-a', operateurId: 'p-1' }),
      station().execute({ token, ...SCAN, redemptionId: 'scan-b', operateurId: 'p-2' }),
    ]);

    const servis = resultats.filter((r) => r.status === 'fulfilled' && r.value.servi);
    expect(servis).toHaveLength(1);
  });
});
