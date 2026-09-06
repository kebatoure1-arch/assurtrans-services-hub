import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import { Secret } from '../src/infra/secrets/secrets.ts';
import { EndpointContractUnknownError, type HttpTransport } from '../src/infra/wave/wave-client.ts';
import { resolveCollectionChannel } from '../src/infra/wave/resolve-collection.ts';
import { DryRunCollectionChannel } from '../src/infra/wave/dry-run-collection-channel.ts';

const CONFIG = {
  baseUrl: 'https://api.wave.com',
  apiKey: new Secret('wave_sn_prod_TEST', 'WAVE_API_KEY'),
  payoutReferenceField: 'client_reference',
  checkoutLaunchUrlField: 'wave_launch_url',
};

const ordre = {
  driverId: 'chauffeur-7',
  montant: xof(20_000),
  idempotencyKey: '8b1f0c2e-4d5a-4b7c-9e1f-0a2b3c4d5e6f',
  reference: 'PAY-0001',
};

function transportEspion(reponse: () => Promise<unknown>) {
  const appels: { method: string; path: string; headers: Record<string, string>; body?: unknown }[] =
    [];
  const transport: HttpTransport = async (req) => {
    appels.push(req);
    return reponse() as never;
  };
  return { transport, appels };
}

describe('DryRunCollectionChannel', () => {
  it('n’émet aucun appel réseau et rend une session déterministe', async () => {
    const canal = new DryRunCollectionChannel(async () => {
      throw new Error('le réseau ne doit jamais être touché en DRY_RUN');
    });
    const a = await canal.createSession(ordre);
    const b = await canal.createSession(ordre);
    expect(a).toEqual(b);
    expect(a.kind).toBe('CREATED');
    if (a.kind === 'CREATED') expect(a.sessionId).toMatch(/^DRYRUN-/);
  });
});

describe('WaveCheckoutChannel — encaissement du chauffeur', () => {
  it('poste sur /v1/checkout/sessions avec une clé d’idempotence', async () => {
    const { transport, appels } = transportEspion(async () => ({
      status: 201,
      body: { id: 'cos-1', wave_launch_url: 'https://pay.wave.com/c/cos-1' },
    }));
    const canal = resolveCollectionChannel({ canal: 'WAVE_CHECKOUT' }, CONFIG, transport);

    const r = await canal.createSession(ordre);

    expect(appels[0].method).toBe('POST');
    expect(appels[0].path).toBe('/v1/checkout/sessions');
    expect(appels[0].headers['Idempotency-Key']).toBe(ordre.idempotencyKey);
    expect(r).toEqual({
      kind: 'CREATED',
      sessionId: 'cos-1',
      launchUrl: 'https://pay.wave.com/c/cos-1',
      canal: 'WAVE_CHECKOUT',
    });
  });

  it('transporte le montant en entier de francs, jamais en décimal', async () => {
    const { transport, appels } = transportEspion(async () => ({
      status: 201,
      body: { id: 'cos-1', wave_launch_url: 'https://pay.wave.com/c/cos-1' },
    }));
    const canal = resolveCollectionChannel({ canal: 'WAVE_CHECKOUT' }, CONFIG, transport);
    await canal.createSession(ordre);

    const corps = appels[0].body as Record<string, unknown>;
    expect(corps.amount).toBe('20000');
    expect(corps.currency).toBe('XOF');
    expect(String(corps.amount)).not.toContain('.');
  });

  it('refuse d’encaisser si le champ d’URL de paiement n’est pas confirmé', async () => {
    const canal = resolveCollectionChannel(
      { canal: 'WAVE_CHECKOUT' },
      { ...CONFIG, checkoutLaunchUrlField: '' },
      async () => ({ status: 201, body: {} }),
    );
    await expect(canal.createSession(ordre)).rejects.toThrow(EndpointContractUnknownError);
  });

  it('une session créée sans URL de paiement exploitable est AMBIGUOUS, pas un succès', async () => {
    // Le chauffeur ne pourrait pas payer : ce n'est pas un succès, et ce n'est pas rien non plus.
    const canal = resolveCollectionChannel(
      { canal: 'WAVE_CHECKOUT' },
      CONFIG,
      async () => ({ status: 201, body: { id: 'cos-1' } }),
    );
    const r = await canal.createSession(ordre);
    expect(r.kind).toBe('AMBIGUOUS');
  });

  it('un 4xx est REJECTED, un 5xx et un timeout sont AMBIGUOUS', async () => {
    const quatreCent = resolveCollectionChannel({ canal: 'WAVE_CHECKOUT' }, CONFIG, async () => ({
      status: 422,
      body: { message: 'amount-too-small' },
    }));
    expect((await quatreCent.createSession(ordre)).kind).toBe('REJECTED');

    const cinqCent = resolveCollectionChannel({ canal: 'WAVE_CHECKOUT' }, CONFIG, async () => ({
      status: 502,
      body: {},
    }));
    expect((await cinqCent.createSession(ordre)).kind).toBe('AMBIGUOUS');

    let tentatives = 0;
    const timeout = resolveCollectionChannel({ canal: 'WAVE_CHECKOUT' }, CONFIG, async () => {
      tentatives += 1;
      throw new Error('socket hang up');
    });
    expect((await timeout.createSession(ordre)).kind).toBe('AMBIGUOUS');
    expect(tentatives).toBe(1);
  });

  it('l’encaissement ne connaît aucun endpoint de paiement marchand', () => {
    // Checkout encaisse. Il ne règle personne. Aucune méthode ne doit le laisser croire.
    const canal = resolveCollectionChannel({ canal: 'WAVE_CHECKOUT' }, CONFIG, async () => ({
      status: 200,
      body: {},
    }));
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(canal))).not.toContain('pay');
    expect('payMerchant' in canal).toBe(false);
  });
});
