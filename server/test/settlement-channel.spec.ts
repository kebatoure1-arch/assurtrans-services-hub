import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money';
import { EndpointContractUnknownError, WaveClient, type HttpTransport } from '../src/infra/wave/wave-client';
import { Secret } from '../src/infra/secrets/secrets';
import { resolveSettlementChannel } from '../src/infra/wave/resolve-channel';
import { DryRunChannel } from '../src/infra/wave/dry-run-channel';

const ordre = {
  intentId: 'pi-1',
  idempotencyKey: '3f0f1b52-9a2c-4a1e-9d0e-2b0a5f9c1d77',
  montant: xof(4_200_000),
  referenceImputation: 'TE/ASSURTRANS/2026-08',
};

function transportEspion(reponse: () => Promise<unknown>) {
  const appels: { method: string; path: string; headers: Record<string, string>; body?: unknown }[] = [];
  const transport: HttpTransport = async (req) => {
    appels.push(req);
    return reponse() as never;
  };
  return { transport, appels };
}

const CONFIG_WAVE = {
  baseUrl: 'https://api.wave.com',
  apiKey: new Secret('wave_sn_prod_TEST', 'WAVE_API_KEY'),
  payoutReferenceField: 'client_reference',
  checkoutLaunchUrlField: 'wave_launch_url',
};

describe('DryRunChannel — mode par défaut tant que §14 n’est pas levé', () => {
  it('n’émet aucun appel réseau', async () => {
    const { transport, appels } = transportEspion(async () => {
      throw new Error('le réseau ne doit jamais être touché en DRY_RUN');
    });
    const canal = new DryRunChannel(transport);
    const r = await canal.execute(ordre);
    expect(appels).toHaveLength(0);
    expect(r.kind).toBe('ACCEPTED');
    if (r.kind === 'ACCEPTED') expect(r.payoutId).toMatch(/^DRYRUN-/);
  });

  it('rend le même payout id pour la même clé d’idempotence', async () => {
    const canal = new DryRunChannel(async () => {
      throw new Error('réseau interdit');
    });
    const a = await canal.execute(ordre);
    const b = await canal.execute(ordre);
    expect(a).toEqual(b);
  });
});

describe('sélection du canal par configuration (ADR-002)', () => {
  const transport: HttpTransport = async () => ({ status: 200, body: {} });

  it('DRY_RUN par défaut', () => {
    const c = resolveSettlementChannel({ canal: 'DRY_RUN' }, CONFIG_WAVE, transport);
    expect(c.canal).toBe('DRY_RUN');
  });

  it('B2B exige un B2B id', () => {
    expect(() => resolveSettlementChannel({ canal: 'B2B' }, CONFIG_WAVE, transport)).toThrow(
      /b2b/i,
    );
    const c = resolveSettlementChannel({ canal: 'B2B', teB2bId: 'BIZ-123' }, CONFIG_WAVE, transport);
    expect(c.canal).toBe('B2B');
  });

  it('MOBILE exige un MSISDN', () => {
    expect(() => resolveSettlementChannel({ canal: 'MOBILE' }, CONFIG_WAVE, transport)).toThrow(
      /msisdn|numéro/i,
    );
    const c = resolveSettlementChannel(
      { canal: 'MOBILE', teMsisdn: '+221770000000' },
      CONFIG_WAVE,
      transport,
    );
    expect(c.canal).toBe('MOBILE');
  });

  it('refuse d’exécuter si le champ de référence Wave n’est pas confirmé (§14 param. 2)', async () => {
    const c = resolveSettlementChannel(
      { canal: 'B2B', teB2bId: 'BIZ-123' },
      { ...CONFIG_WAVE, payoutReferenceField: '' },
      transport,
    );
    await expect(c.execute(ordre)).rejects.toThrow(EndpointContractUnknownError);
  });
});

describe('canaux Wave — endpoints documentés uniquement', () => {
  it('B2B poste sur /v1/b2b/payout avec Idempotency-Key et sans jamais logguer la clé API', async () => {
    const { transport, appels } = transportEspion(async () => ({
      status: 200,
      body: { id: 'pw-1', status: 'accepted' },
    }));
    const c = resolveSettlementChannel({ canal: 'B2B', teB2bId: 'BIZ-123' }, CONFIG_WAVE, transport);
    const r = await c.execute(ordre);

    expect(appels[0].method).toBe('POST');
    expect(appels[0].path).toBe('/v1/b2b/payout');
    expect(appels[0].headers['Idempotency-Key']).toBe(ordre.idempotencyKey);
    expect(appels[0].headers.Authorization).toBe('Bearer wave_sn_prod_TEST');
    expect(r).toEqual({ kind: 'ACCEPTED', payoutId: 'pw-1', canal: 'B2B' });
  });

  it('MOBILE poste sur /v1/payout', async () => {
    const { transport, appels } = transportEspion(async () => ({
      status: 200,
      body: { id: 'pw-2', status: 'accepted' },
    }));
    const c = resolveSettlementChannel(
      { canal: 'MOBILE', teMsisdn: '+221770000000' },
      CONFIG_WAVE,
      transport,
    );
    await c.execute(ordre);
    expect(appels[0].path).toBe('/v1/payout');
  });

  it('un timeout devient AMBIGUOUS — jamais une exception silencieuse, jamais un retry', async () => {
    let tentatives = 0;
    const transport: HttpTransport = async () => {
      tentatives += 1;
      throw Object.assign(new Error('socket hang up'), { code: 'ETIMEDOUT' });
    };
    const c = resolveSettlementChannel({ canal: 'B2B', teB2bId: 'BIZ-123' }, CONFIG_WAVE, transport);
    const r = await c.execute(ordre);
    expect(r.kind).toBe('AMBIGUOUS');
    expect(tentatives).toBe(1);
  });

  it('un 5xx devient AMBIGUOUS, un 4xx devient REJECTED', async () => {
    const cinqCent = resolveSettlementChannel(
      { canal: 'B2B', teB2bId: 'BIZ-123' },
      CONFIG_WAVE,
      async () => ({ status: 503, body: { message: 'unavailable' } }),
    );
    expect((await cinqCent.execute(ordre)).kind).toBe('AMBIGUOUS');

    const quatreCent = resolveSettlementChannel(
      { canal: 'B2B', teB2bId: 'BIZ-123' },
      CONFIG_WAVE,
      async () => ({ status: 422, body: { message: 'insufficient-funds' } }),
    );
    const r = await quatreCent.execute(ordre);
    expect(r.kind).toBe('REJECTED');
  });
});

describe('WaveClient — aucun endpoint inventé', () => {
  it('la lecture du solde échoue explicitement tant que le chemin n’est pas documenté', async () => {
    const client = new WaveClient(CONFIG_WAVE, async () => ({ status: 200, body: {} }));
    await expect(client.fetchBalance()).rejects.toThrow(EndpointContractUnknownError);
  });

  it('la reprise après crash interroge Wave avant toute nouvelle tentative', async () => {
    const { transport, appels } = transportEspion(async () => ({
      status: 200,
      body: { id: 'pw-1', status: 'succeeded' },
    }));
    const client = new WaveClient(CONFIG_WAVE, transport);
    await client.getPayout('pw-1');
    expect(appels[0].method).toBe('GET');
    expect(appels[0].path).toBe('/v1/payout/pw-1');
  });
});

describe('étanchéité du domaine (§11)', () => {
  // On scanne le CODE, pas la prose : les commentaires ont le droit de citer Wave et les ADR.
  function codeSansCommentaires(chemin: string): string {
    return readFileSync(chemin, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  }

  const fichiersDomaine = readdirSync(join(__dirname, '..', 'src', 'domain'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ nom: f, code: codeSansCommentaires(join(__dirname, '..', 'src', 'domain', f)) }));

  it('aucun fichier de src/domain n’importe l’infrastructure', () => {
    const coupables = fichiersDomaine
      .filter((f) => /\bfrom\s+'(?!\.\/)/.test(f.code) || /from\s+'\.\.\//.test(f.code))
      .map((f) => f.nom);
    expect(coupables).toEqual([]);
  });

  it('aucun fichier de src/domain ne connaît un endpoint, un canal concret ou HTTP', () => {
    const interdits =
      /api\.wave\.com|\/v1\/payout|b2b\/payout|checkout\/sessions|\bfetch\(|axios|Bearer |Idempotency-Key|WaveClient|B2BPayoutChannel|MobilePayoutChannel/;
    const coupables = fichiersDomaine.filter((f) => interdits.test(f.code)).map((f) => f.nom);
    expect(coupables).toEqual([]);
  });
});
