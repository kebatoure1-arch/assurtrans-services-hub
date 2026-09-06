import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { xof } from '../src/domain/money.ts';
import type { FuelVoucher, VoucherStatut } from '../src/domain/fuel-voucher.ts';
import { Secret } from '../src/infra/secrets/secrets.ts';
import { VoucherSigner } from '../src/infra/security/voucher-signature.ts';
import {
  InMemoryProcessedEventStore,
  WebhookDeduplicator,
  WebhookVerifier,
} from '../src/infra/webhooks/webhook.ts';
import type { AccessTokenVerifier, Principal } from '../src/infra/auth/api-tokens.ts';
import { EmitVoucherOnPayment } from '../src/application/emit-voucher-on-payment.ts';
import { RedeemVoucherAtStation } from '../src/application/redeem-voucher-at-station.ts';
import { CheckoutCompletedMapper } from '../src/http/checkout-mapper.ts';
import { AuthenticateByPhone } from '../src/application/authenticate-by-phone.ts';
import type { OtpChallenge } from '../src/domain/otp.ts';
import type {
  AnnuaireComptes,
  ApiTokenIssuer,
  OtpChallengeRepository,
  OtpSender,
} from '../src/ports/authentication.ts';
import { buildServer } from '../src/http/server.ts';
import { DryRunCollectionChannel } from '../src/infra/wave/dry-run-collection-channel.ts';
import type {
  CheckoutSession,
  CheckoutSessionRepository,
  DeliveryRequest,
  Driver,
  DriverPayment,
  DriverPaymentRepository,
  DriverRepository,
  VoucherDeliveryQueue,
  VoucherRepository,
} from '../src/ports/repositories.ts';

// --------------------------------------------------------------- doublures

class Paiements implements DriverPaymentRepository {
  readonly lignes = new Map<string, DriverPayment>();
  async findByReference(c: string, r: string) {
    return this.lignes.get(`${c}|${r}`) ?? null;
  }
  async saveIfNew(p: DriverPayment) {
    const k = `${p.canal}|${p.reference}`;
    if (this.lignes.has(k)) return false;
    this.lignes.set(k, p);
    return true;
  }
}

class Bons implements VoucherRepository {
  readonly lignes = new Map<string, FuelVoucher>();
  readonly parPaiement = new Map<string, string>();
  async findById(id: string) {
    return this.lignes.get(id) ?? null;
  }
  async findByPaymentId(p: string) {
    const id = this.parPaiement.get(p);
    return id ? (this.lignes.get(id) ?? null) : null;
  }
  async saveIfNew(bon: FuelVoucher, paymentId: string) {
    if (this.parPaiement.has(paymentId)) return false;
    this.parPaiement.set(paymentId, bon.id);
    this.lignes.set(bon.id, bon);
    return true;
  }
  async saveIfStatut(bon: FuelVoucher, attendu: VoucherStatut) {
    const actuel = this.lignes.get(bon.id);
    if (!actuel || actuel.statut !== attendu) return false;
    this.lignes.set(bon.id, bon);
    return true;
  }
  async listerParChauffeur(driverId: string, limite: number) {
    return [...this.lignes.values()]
      .filter((b) => b.driverId === driverId)
      .sort((a, b) => b.emisA.localeCompare(a.emisA))
      .slice(0, limite);
  }
}

class Sessions implements CheckoutSessionRepository {
  readonly lignes = new Map<string, CheckoutSession>();
  async findByReference(r: string) {
    return this.lignes.get(r) ?? null;
  }
  async save(s: CheckoutSession) {
    this.lignes.set(s.reference, s);
  }
  async attacherSessionId(r: string, sessionId: string) {
    const s = this.lignes.get(r);
    if (s) this.lignes.set(r, { ...s, sessionId });
  }
}

class Chauffeurs implements DriverRepository {
  constructor(private readonly liste: Driver[]) {}
  async findById(id: string) {
    return this.liste.find((d) => d.id === id) ?? null;
  }
}

class File implements VoucherDeliveryQueue {
  readonly envois: DeliveryRequest[] = [];
  async enqueue(d: DeliveryRequest) {
    this.envois.push(d);
    return 'envoi-1';
  }
}

class Jetons implements AccessTokenVerifier {
  constructor(private readonly table: Record<string, Principal>) {}
  async verify(token: string) {
    return this.table[token] ?? null;
  }
}

class ChallengesTest implements OtpChallengeRepository {
  readonly tous: OtpChallenge[] = [];
  async trouverVivant(msisdn: string) {
    return this.tous.find((c) => c.msisdn === msisdn && !c.consomme) ?? null;
  }
  async remplacer(c: OtpChallenge) {
    this.tous.forEach((x, i) => {
      if (x.msisdn === c.msisdn && !x.consomme) this.tous[i] = { ...x, consomme: true };
    });
    this.tous.push(c);
  }
  async majTentative(c: OtpChallenge) {
    const i = this.tous.findIndex((x) => x.id === c.id);
    if (i >= 0) this.tous[i] = c;
  }
  async compterDepuis(msisdn: string, depuis: string) {
    return this.tous.filter((c) => c.msisdn === msisdn && c.emisA >= depuis).length;
  }
}

class SenderTest implements OtpSender {
  readonly envoyes: { msisdn: string; code: string }[] = [];
  async envoyer(msisdn: string, code: string) {
    this.envoyes.push({ msisdn, code });
    return true;
  }
}

const ANNUAIRE_TEST: AnnuaireComptes = {
  async resoudre(msisdn) {
    if (msisdn === '+221770000001') {
      return { subject: 'chauffeur-7', role: 'DRIVER', stationId: null };
    }
    return null;
  },
};

class EmetteurTest implements ApiTokenIssuer {
  async emettre() {
    return 'jeton-de-session';
  }
}

function compteur(prefixe: string) {
  let n = 0;
  return { next: () => `${prefixe}-${(n += 1)}` };
}

// --------------------------------------------------------------- montage

const CLE_QR = new Secret('a'.repeat(64), 'QR_SIGNATURE_SECRET');
const CLE_WEBHOOK = new Secret('b'.repeat(48), 'WAVE_WEBHOOK_SECRET');
const ENTETE = 'wave-signature';
const MAINTENANT = '2026-09-06T12:00:00.000Z';

const signer = new VoucherSigner(CLE_QR);

const CHAUFFEUR: Driver = {
  id: 'chauffeur-7',
  nom: 'Moussa Ndiaye',
  msisdn: '+221770000001',
  statut: 'ACTIF',
};

const JETONS = {
  'jeton-chauffeur': { subject: 'chauffeur-7', role: 'DRIVER', stationId: null } as Principal,
  'jeton-autre-chauffeur': { subject: 'chauffeur-9', role: 'DRIVER', stationId: null } as Principal,
  'jeton-pompiste': {
    subject: 'pompiste-12',
    role: 'STATION_OPERATOR',
    stationId: 'station-3',
  } as Principal,
  'jeton-pompiste-sans-station': {
    subject: 'pompiste-99',
    role: 'STATION_OPERATOR',
    stationId: null,
  } as Principal,
  'jeton-admin': { subject: 'admin-1', role: 'ADMIN', stationId: null } as Principal,
};

let paiements: Paiements;
let bons: Bons;
let sessions: Sessions;
let file: File;
let challenges: ChallengesTest;
let sender: SenderTest;
let app: FastifyInstance;

function signerWebhook(corps: string, unix = Math.floor(Date.parse(MAINTENANT) / 1000)): string {
  const mac = createHmac('sha256', CLE_WEBHOOK.expose()).update(`${unix}.${corps}`).digest('hex');
  return `t=${unix},v1=${mac}`;
}

beforeEach(() => {
  paiements = new Paiements();
  bons = new Bons();
  sessions = new Sessions();
  file = new File();
  challenges = new ChallengesTest();
  sender = new SenderTest();

  app = buildServer({
    encaissement: new DryRunCollectionChannel(async () => {
      throw new Error('réseau interdit');
    }),
    sessions,
    emission: new EmitVoucherOnPayment({
      paiements,
      bons,
      chauffeurs: new Chauffeurs([CHAUFFEUR]),
      file,
      signer,
      idsPaiement: compteur('PAY'),
      idsBon: compteur('BON'),
      validiteHeures: 24,
    }),
    consommation: new RedeemVoucherAtStation({ bons, signer }),
    bons,
    jetons: new Jetons(JETONS),
    webhook: new WebhookVerifier(CLE_WEBHOOK, {
      signatureHeader: ENTETE,
      toleranceSecondes: 300,
    }),
    dedup: new WebhookDeduplicator(new InMemoryProcessedEventStore()),
    mappeur: new CheckoutCompletedMapper({
      eventType: 'checkout.session.completed',
      referencePath: 'data.client_reference',
      montantPath: 'data.amount',
    }),
    ids: compteur('REF'),
    cles: compteur('KEY'),
    horloge: () => MAINTENANT,
    montantBon: { minXof: xof(1_000), maxXof: xof(200_000) },
    signer,
    originesAutorisees: [],
    auth: new AuthenticateByPhone({
      challenges,
      sender,
      annuaire: ANNUAIRE_TEST,
      jetons: new EmetteurTest(),
      ids: compteur('CHAL'),
      otp: { dureeSecondes: 300, maxTentatives: 5, maxDemandesParHeure: 3, echoCode: false },
      sessionDureeHeures: 12,
    }),
  });
});

afterEach(async () => {
  await app.close();
});

// --------------------------------------------------------------- accès

describe('contrôle d’accès', () => {
  it('refuse une requête sans jeton', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/paiements/session',
      payload: { montantXof: 20_000 },
    });
    expect(r.statusCode).toBe(401);
  });

  it('refuse un jeton inconnu', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/paiements/session',
      headers: { authorization: 'Bearer inexistant' },
      payload: { montantXof: 20_000 },
    });
    expect(r.statusCode).toBe(401);
  });

  it('un chauffeur ne peut pas consommer un bon en station', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/station/consommation',
      headers: { authorization: 'Bearer jeton-chauffeur' },
      payload: { token: 'peu-importe', redemptionId: 'scan-1' },
    });
    expect(r.statusCode).toBe(403);
  });

  it('un pompiste sans station de rattachement ne peut rien servir', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/station/consommation',
      headers: { authorization: 'Bearer jeton-pompiste-sans-station' },
      payload: { token: 'x', redemptionId: 'scan-1' },
    });
    expect(r.statusCode).toBe(403);
  });
});

// --------------------------------------------------------------- encaissement

describe('ouverture d’une session de paiement', () => {
  it('crée la session et rend l’URL de paiement', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/paiements/session',
      headers: { authorization: 'Bearer jeton-chauffeur' },
      payload: { montantXof: 20_000 },
    });

    expect(r.statusCode).toBe(201);
    const corps = r.json();
    expect(corps.montantXof).toBe(20_000);
    expect(corps.urlPaiement).toContain('http');
    expect(sessions.lignes.get(corps.reference)?.driverId).toBe('chauffeur-7');
  });

  it('refuse un montant décimal, nul ou négatif', async () => {
    for (const montantXof of [0, -100, 20_000.5]) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/paiements/session',
        headers: { authorization: 'Bearer jeton-chauffeur' },
        payload: { montantXof },
      });
      expect(r.statusCode).toBe(400);
    }
  });

  it('refuse un montant hors bornes', async () => {
    for (const montantXof of [999, 200_001]) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/paiements/session',
        headers: { authorization: 'Bearer jeton-chauffeur' },
        payload: { montantXof },
      });
      expect(r.statusCode).toBe(400);
    }
  });

  it('la session est enregistrée au nom du porteur du jeton, pas d’un champ du corps', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/paiements/session',
      headers: { authorization: 'Bearer jeton-chauffeur' },
      payload: { montantXof: 20_000, driverId: 'chauffeur-9' },
    });
    expect(sessions.lignes.get(r.json().reference)?.driverId).toBe('chauffeur-7');
  });
});

// --------------------------------------------------------------- webhook

describe('webhook de confirmation', () => {
  async function ouvrirSession(montantXof = 20_000): Promise<string> {
    const r = await app.inject({
      method: 'POST',
      url: '/api/paiements/session',
      headers: { authorization: 'Bearer jeton-chauffeur' },
      payload: { montantXof },
    });
    return r.json().reference;
  }

  function evenement(reference: string, montant: string, id = 'evt-1'): string {
    return JSON.stringify({
      id,
      type: 'checkout.session.completed',
      data: { client_reference: reference, amount: montant },
    });
  }

  async function poster(corps: string, signature?: string) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/wave',
      headers: { [ENTETE]: signature ?? signerWebhook(corps), 'content-type': 'application/json' },
      payload: corps,
    });
  }

  it('émet un bon pour un paiement confirmé', async () => {
    const reference = await ouvrirSession();
    const r = await poster(evenement(reference, '20000'));

    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ traite: true, emis: true });
    expect(bons.lignes.size).toBe(1);
    expect([...bons.lignes.values()][0].montant).toBe(20_000);
    expect(file.envois[0].destinataire).toBe('+221770000001');
  });

  it('rejette une signature invalide et n’émet rien', async () => {
    const reference = await ouvrirSession();
    const r = await poster(evenement(reference, '20000'), 't=1,v1=' + 'f'.repeat(64));

    expect(r.statusCode).toBe(400);
    expect(bons.lignes.size).toBe(0);
  });

  it('rejette un corps modifié après signature', async () => {
    const reference = await ouvrirSession();
    const signature = signerWebhook(evenement(reference, '20000'));
    const r = await poster(evenement(reference, '500000'), signature);

    expect(r.statusCode).toBe(400);
    expect(bons.lignes.size).toBe(0);
  });

  it('refuse un montant payé différent du montant demandé', async () => {
    const reference = await ouvrirSession(20_000);
    const r = await poster(evenement(reference, '15000'));

    expect(r.statusCode).toBe(422);
    expect(bons.lignes.size).toBe(0);
  });

  it('cinq livraisons du même événement n’émettent qu’un bon', async () => {
    const reference = await ouvrirSession();
    const corps = evenement(reference, '20000');

    const reponses = [];
    for (let n = 0; n < 5; n += 1) reponses.push(await poster(corps));

    expect(reponses.map((r) => r.json().traite)).toEqual([true, false, false, false, false]);
    expect(bons.lignes.size).toBe(1);
    expect(file.envois).toHaveLength(1);
  });

  it('accuse réception sans traiter un type d’événement qui ne nous concerne pas', async () => {
    const corps = JSON.stringify({ id: 'evt-x', type: 'payout.completed', data: {} });
    const r = await poster(corps);
    expect(r.statusCode).toBe(202);
    expect(bons.lignes.size).toBe(0);
  });

  it('accuse réception sans traiter une référence inconnue', async () => {
    const r = await poster(evenement('REF-inexistante', '20000'));
    expect(r.statusCode).toBe(202);
    expect(bons.lignes.size).toBe(0);
  });
});

// --------------------------------------------------------------- station

describe('consommation en station', () => {
  async function bonEmis(): Promise<string> {
    const session = await app.inject({
      method: 'POST',
      url: '/api/paiements/session',
      headers: { authorization: 'Bearer jeton-chauffeur' },
      payload: { montantXof: 20_000 },
    });
    const reference = session.json().reference;
    const corps = JSON.stringify({
      id: 'evt-1',
      type: 'checkout.session.completed',
      data: { client_reference: reference, amount: '20000' },
    });
    await app.inject({
      method: 'POST',
      url: '/webhooks/wave',
      headers: { [ENTETE]: signerWebhook(corps), 'content-type': 'application/json' },
      payload: corps,
    });
    const bon = [...bons.lignes.values()][0];
    return signer.sign({ id: bon.id, montant: bon.montant, expireA: bon.expireA });
  }

  async function consommer(token: string, options: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/api/station/consommation',
      headers: { authorization: 'Bearer jeton-pompiste' },
      payload: { token, redemptionId: 'scan-1', ...options },
    });
  }

  it('sert le montant du bon', async () => {
    const r = await consommer(await bonEmis());
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ servir: true, montantXof: 20_000, dejaServi: false });
  });

  it('enregistre la station du jeton, pas celle du corps de la requête', async () => {
    await consommer(await bonEmis(), { stationId: 'station-999' });
    expect([...bons.lignes.values()][0].stationId).toBe('station-3');
  });

  it('un QR forgé est refusé', async () => {
    const autre = new VoucherSigner(new Secret('z'.repeat(64), 'QR_SIGNATURE_SECRET'));
    await bonEmis();
    const forge = autre.sign({ id: 'BON-1', montant: 500_000, expireA: '2027-01-01T00:00:00.000Z' });

    const r = await consommer(forge);
    expect(r.statusCode).toBe(400);
    expect([...bons.lignes.values()][0].statut).toBe('EMIS');
  });

  it('un second pompiste sur le même bon reçoit un conflit', async () => {
    const token = await bonEmis();
    await consommer(token);
    const r = await consommer(token, { redemptionId: 'scan-2' });
    expect(r.statusCode).toBe(409);
  });

  it('le même scan rejoué confirme sans servir deux fois', async () => {
    const token = await bonEmis();
    await consommer(token);
    const r = await consommer(token);
    expect(r.statusCode).toBe(200);
    expect(r.json().dejaServi).toBe(true);
  });
});

// --------------------------------------------------------------- consultation

describe('consultation d’un bon', () => {
  it('un chauffeur ne voit pas le bon d’un autre', async () => {
    const bon = {
      id: 'BON-42',
      driverId: 'chauffeur-7',
      montant: xof(20_000),
      statut: 'EMIS' as const,
      emisA: MAINTENANT,
      expireA: '2026-09-07T12:00:00.000Z',
      paymentRef: 'x',
      consommeA: null,
      stationId: null,
      operateurId: null,
      redemptionId: null,
      motifAnnulation: null,
    };
    bons.lignes.set(bon.id, bon);

    const sien = await app.inject({
      method: 'GET',
      url: '/api/bons/BON-42',
      headers: { authorization: 'Bearer jeton-chauffeur' },
    });
    expect(sien.statusCode).toBe(200);

    const autrui = await app.inject({
      method: 'GET',
      url: '/api/bons/BON-42',
      headers: { authorization: 'Bearer jeton-autre-chauffeur' },
    });
    // 404 et non 403 : on ne confirme pas l'existence d'un bon qui ne le regarde pas.
    expect(autrui.statusCode).toBe(404);
  });
});
