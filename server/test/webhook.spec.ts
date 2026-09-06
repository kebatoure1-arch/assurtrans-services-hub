import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Secret } from '../src/infra/secrets/secrets';
import {
  InMemoryProcessedEventStore,
  InvalidWebhookSignatureError,
  MalformedWebhookError,
  TimestampOutOfWindowError,
  WebhookDeduplicator,
  WebhookVerifier,
} from '../src/infra/webhooks/webhook';
import { EndpointContractUnknownError } from '../src/infra/wave/wave-client';

const SECRET = new Secret('c'.repeat(48), 'WAVE_WEBHOOK_SECRET');
const HEADER = 'wave-signature';
const ASOF = '2026-09-06T12:00:00.000Z';
const UNIX = Math.floor(Date.parse(ASOF) / 1000);

const CORPS = JSON.stringify({ id: 'evt-1', type: 'checkout.session.completed', amount: '20000' });

function signer(corps: string, unix = UNIX, secret = SECRET): string {
  const mac = createHmac('sha256', secret.expose()).update(`${unix}.${corps}`).digest('hex');
  return `t=${unix},v1=${mac}`;
}

const verifier = new WebhookVerifier(SECRET, {
  signatureHeader: HEADER,
  toleranceSecondes: 300,
});

describe('vérification de signature', () => {
  it('accepte un webhook correctement signé', () => {
    const r = verifier.verify({
      rawBody: CORPS,
      headers: { [HEADER]: signer(CORPS) },
      asOf: ASOF,
    });
    expect(r.eventId).toBe('evt-1');
    expect(r.eventType).toBe('checkout.session.completed');
  });

  it('rejette une signature produite avec une autre clé', () => {
    const autre = new Secret('d'.repeat(48), 'WAVE_WEBHOOK_SECRET');
    expect(() =>
      verifier.verify({ rawBody: CORPS, headers: { [HEADER]: signer(CORPS, UNIX, autre) }, asOf: ASOF }),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('rejette un corps modifié après signature', () => {
    const signature = signer(CORPS);
    const trafique = JSON.stringify({
      id: 'evt-1',
      type: 'checkout.session.completed',
      amount: '2000000',
    });
    expect(() =>
      verifier.verify({ rawBody: trafique, headers: { [HEADER]: signature }, asOf: ASOF }),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('vérifie les octets reçus, pas un JSON re-sérialisé', () => {
    // Piège classique : re-sérialiser avant de vérifier. Même contenu, octets différents.
    const espace = `${CORPS.slice(0, -1)} }`;
    expect(JSON.parse(espace)).toEqual(JSON.parse(CORPS));
    expect(() =>
      verifier.verify({ rawBody: espace, headers: { [HEADER]: signer(CORPS) }, asOf: ASOF }),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('rejette un en-tête absent ou mal formé', () => {
    expect(() => verifier.verify({ rawBody: CORPS, headers: {}, asOf: ASOF })).toThrow(
      MalformedWebhookError,
    );
    for (const mauvais of ['', 'abc', 't=123', 'v1=abc', 't=abc,v1=def']) {
      expect(() =>
        verifier.verify({ rawBody: CORPS, headers: { [HEADER]: mauvais }, asOf: ASOF }),
      ).toThrow(MalformedWebhookError);
    }
  });

  it('lit l’en-tête sans tenir compte de la casse', () => {
    const r = verifier.verify({
      rawBody: CORPS,
      headers: { 'Wave-Signature': signer(CORPS) },
      asOf: ASOF,
    });
    expect(r.eventId).toBe('evt-1');
  });

  it('rejette un événement sans identifiant — la déduplication en dépend', () => {
    const sansId = JSON.stringify({ type: 'checkout.session.completed' });
    expect(() =>
      verifier.verify({ rawBody: sansId, headers: { [HEADER]: signer(sansId) }, asOf: ASOF }),
    ).toThrow(MalformedWebhookError);
  });

  it('ne révèle jamais le secret dans un message d’erreur', () => {
    try {
      verifier.verify({ rawBody: CORPS, headers: { [HEADER]: 'abc' }, asOf: ASOF });
    } catch (e) {
      expect((e as Error).message).not.toContain('cccc');
    }
  });
});

describe('fenêtre d’horodatage — protection contre le rejeu différé', () => {
  it('accepte dans la fenêtre', () => {
    const r = verifier.verify({
      rawBody: CORPS,
      headers: { [HEADER]: signer(CORPS, UNIX - 299) },
      asOf: ASOF,
    });
    expect(r.eventId).toBe('evt-1');
  });

  it('rejette un horodatage trop ancien, même si la signature est valide', () => {
    expect(() =>
      verifier.verify({
        rawBody: CORPS,
        headers: { [HEADER]: signer(CORPS, UNIX - 301) },
        asOf: ASOF,
      }),
    ).toThrow(TimestampOutOfWindowError);
  });

  it('rejette un horodatage dans le futur au-delà de la tolérance — horloge désynchronisée', () => {
    expect(() =>
      verifier.verify({
        rawBody: CORPS,
        headers: { [HEADER]: signer(CORPS, UNIX + 301) },
        asOf: ASOF,
      }),
    ).toThrow(TimestampOutOfWindowError);
  });
});

describe('contrat non établi', () => {
  it('refuse de vérifier tant que le nom de l’en-tête de signature n’est pas confirmé', () => {
    const sansContrat = new WebhookVerifier(SECRET, { signatureHeader: '', toleranceSecondes: 300 });
    expect(() =>
      sansContrat.verify({ rawBody: CORPS, headers: { [HEADER]: signer(CORPS) }, asOf: ASOF }),
    ).toThrow(EndpointContractUnknownError);
  });
});

describe('déduplication — 5 rejeux, 1 traitement', () => {
  it('ne traite qu’une fois le même event_id', async () => {
    const dedup = new WebhookDeduplicator(new InMemoryProcessedEventStore());
    let traitements = 0;

    for (let n = 0; n < 5; n += 1) {
      await dedup.once('evt-1', async () => {
        traitements += 1;
      });
    }

    expect(traitements).toBe(1);
  });

  it('traite des événements distincts', async () => {
    const dedup = new WebhookDeduplicator(new InMemoryProcessedEventStore());
    let traitements = 0;
    const compter = async () => {
      traitements += 1;
    };

    await dedup.once('evt-1', compter);
    await dedup.once('evt-2', compter);
    expect(traitements).toBe(2);
  });

  it('un traitement qui échoue ne marque pas l’événement comme traité', async () => {
    const store = new InMemoryProcessedEventStore();
    const dedup = new WebhookDeduplicator(store);

    await expect(
      dedup.once('evt-1', async () => {
        throw new Error('base indisponible');
      }),
    ).rejects.toThrow('base indisponible');

    // Wave rejouera : le traitement doit pouvoir aboutir cette fois.
    let traite = false;
    await dedup.once('evt-1', async () => {
      traite = true;
    });
    expect(traite).toBe(true);
  });

  it('deux traitements concurrents du même événement n’en exécutent qu’un', async () => {
    const dedup = new WebhookDeduplicator(new InMemoryProcessedEventStore());
    let traitements = 0;

    await Promise.all(
      Array.from({ length: 5 }, () =>
        dedup.once('evt-1', async () => {
          traitements += 1;
        }),
      ),
    );

    expect(traitements).toBe(1);
  });
});
