import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import type { SqlExecutor, SqlResult } from '../src/infra/db/sql-executor.ts';
import {
  PgDriverPaymentRepository,
  PgDriverRepository,
  PgProcessedEventStore,
  PgVoucherDeliveryQueue,
  PgVoucherRepository,
} from '../src/infra/db/pg-repositories.ts';

class ExecuteurFactice implements SqlExecutor {
  readonly appels: { texte: string; params: readonly unknown[] }[] = [];
  constructor(private readonly reponses: SqlResult[] = []) {}

  async query(texte: string, params: readonly unknown[] = []): Promise<SqlResult> {
    this.appels.push({ texte, params });
    return this.reponses.shift() ?? { rows: [], rowCount: 0 };
  }
}

const LIGNE_BON = {
  id: 'BON-1',
  driver_id: 'chauffeur-7',
  // node-postgres rend un BIGINT sous forme de chaîne. C'est le piège classique.
  montant_xof: '20000',
  statut: 'EMIS',
  emis_a: new Date('2026-09-06T10:00:00.000Z'),
  expire_a: new Date('2026-09-07T10:00:00.000Z'),
  payment_ref: 'WAVE_CHECKOUT/cos-1',
  consomme_a: null,
  station_id: null,
  operateur_id: null,
  redemption_id: null,
  motif_annulation: null,
};

describe('lecture des montants — un BIGINT arrive en chaîne', () => {
  it('convertit « 20000 » en entier XOF', async () => {
    const db = new ExecuteurFactice([{ rows: [LIGNE_BON], rowCount: 1 }]);
    const bon = await new PgVoucherRepository(db).findById('BON-1');
    expect(bon?.montant).toBe(20_000);
    expect(typeof bon?.montant).toBe('number');
  });

  it('refuse un montant décimal remonté par la base plutôt que de l’arrondir', async () => {
    const db = new ExecuteurFactice([
      { rows: [{ ...LIGNE_BON, montant_xof: '20000.5' }], rowCount: 1 },
    ]);
    await expect(new PgVoucherRepository(db).findById('BON-1')).rejects.toThrow(/entier/i);
  });

  it('refuse un montant non numérique', async () => {
    const db = new ExecuteurFactice([
      { rows: [{ ...LIGNE_BON, montant_xof: 'beaucoup' }], rowCount: 1 },
    ]);
    await expect(new PgVoucherRepository(db).findById('BON-1')).rejects.toThrow();
  });

  it('rend null pour un bon absent', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 0 }]);
    expect(await new PgVoucherRepository(db).findById('BON-1')).toBeNull();
  });
});

describe('écritures conditionnelles — l’atomicité est en base, pas dans le code', () => {
  const bon = {
    id: 'BON-1',
    driverId: 'chauffeur-7',
    montant: xof(20_000),
    statut: 'CONSOMME' as const,
    emisA: '2026-09-06T10:00:00.000Z',
    expireA: '2026-09-07T10:00:00.000Z',
    paymentRef: 'WAVE_CHECKOUT/cos-1',
    consommeA: '2026-09-06T14:00:00.000Z',
    stationId: 'station-3',
    operateurId: 'pompiste-12',
    redemptionId: 'scan-1',
    motifAnnulation: null,
  };

  it('saveIfStatut passe par UPDATE ... WHERE statut = $attendu', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 1 }]);
    const ok = await new PgVoucherRepository(db).saveIfStatut(bon, 'EMIS');

    expect(ok).toBe(true);
    expect(db.appels[0].texte).toMatch(/UPDATE\s+fuel_vouchers/i);
    expect(db.appels[0].texte).toMatch(/WHERE\s+id\s*=\s*\$\d+\s+AND\s+statut\s*=\s*\$\d+/i);
    expect(db.appels[0].params).toContain('EMIS');
  });

  it('zéro ligne affectée ⇒ false : quelqu’un est passé avant', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 0 }]);
    expect(await new PgVoucherRepository(db).saveIfStatut(bon, 'EMIS')).toBe(false);
  });

  it('saveIfNew d’un bon passe par ON CONFLICT DO NOTHING sur le paiement', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 1 }]);
    const ok = await new PgVoucherRepository(db).saveIfNew({ ...bon, statut: 'EMIS' }, 'PAY-1');

    expect(ok).toBe(true);
    expect(db.appels[0].texte).toMatch(/INSERT\s+INTO\s+fuel_vouchers/i);
    expect(db.appels[0].texte).toMatch(/ON\s+CONFLICT.*DO\s+NOTHING/is);
  });

  it('saveIfNew d’un paiement rend false sur conflit (canal, reference)', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 0 }]);
    const ok = await new PgDriverPaymentRepository(db).saveIfNew({
      id: 'PAY-1',
      driverId: 'chauffeur-7',
      montant: xof(20_000),
      canal: 'WAVE_CHECKOUT',
      reference: 'cos-1',
      recuA: '2026-09-06T10:00:00.000Z',
    });
    expect(ok).toBe(false);
    expect(db.appels[0].texte).toMatch(/ON\s+CONFLICT/i);
  });
});

describe('déduplication des webhooks en base', () => {
  it('markIfNew insère et rend true pour un événement neuf', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 1 }]);
    const ok = await new PgProcessedEventStore(db).markIfNew('evt-1', {
      eventType: 'checkout.session.completed',
      payloadHash: 'a'.repeat(64),
    });
    expect(ok).toBe(true);
    expect(db.appels[0].texte).toMatch(/INSERT\s+INTO\s+webhook_events/i);
    expect(db.appels[0].texte).toMatch(/ON\s+CONFLICT.*DO\s+NOTHING/is);
    expect(db.appels[0].params).toContain('checkout.session.completed');
  });

  it('rend false quand l’événement est déjà présent', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 0 }]);
    expect(
      await new PgProcessedEventStore(db).markIfNew('evt-1', { eventType: 't', payloadHash: 'h' }),
    ).toBe(false);
  });

  it('forget efface la marque pour qu’un rejeu puisse aboutir', async () => {
    const db = new ExecuteurFactice([{ rows: [], rowCount: 1 }]);
    await new PgProcessedEventStore(db).forget('evt-1');
    expect(db.appels[0].texte).toMatch(/DELETE\s+FROM\s+webhook_events/i);
  });
});

describe('chauffeurs et file d’envoi', () => {
  it('lit un chauffeur avec son numéro', async () => {
    const db = new ExecuteurFactice([
      {
        rows: [{ id: 'chauffeur-7', nom: 'Moussa Ndiaye', msisdn: '+221770000001', statut: 'ACTIF' }],
        rowCount: 1,
      },
    ]);
    const d = await new PgDriverRepository(db).findById('chauffeur-7');
    expect(d).toEqual({
      id: 'chauffeur-7',
      nom: 'Moussa Ndiaye',
      msisdn: '+221770000001',
      statut: 'ACTIF',
    });
  });

  it('la file d’envoi ne stocke jamais le jeton signé du QR', async () => {
    // Le jeton vaut du carburant. Il n'a rien à faire dans une table de journalisation d'envois.
    const db = new ExecuteurFactice([{ rows: [{ id: 'envoi-1' }], rowCount: 1 }]);
    await new PgVoucherDeliveryQueue(db).enqueue({
      voucherId: 'BON-1',
      destinataire: '+221770000001',
      montant: xof(20_000),
      token: 'AT1.charge.signature',
      expireA: '2026-09-07T10:00:00.000Z',
    });

    const parametres = JSON.stringify(db.appels[0].params);
    expect(parametres).not.toContain('AT1.');
    expect(parametres).toContain('BON-1');
  });
});
