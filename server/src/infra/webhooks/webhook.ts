/**
 * Réception des webhooks.
 *
 * Trois protections, indépendantes les unes des autres :
 *
 *  1. **Signature** — l'événement vient bien du fournisseur, et son corps n'a pas été modifié.
 *     La vérification porte sur les **octets reçus**, jamais sur un JSON re-sérialisé : deux
 *     corps sémantiquement identiques mais formatés différemment ont des signatures différentes.
 *  2. **Fenêtre d'horodatage** — un événement authentique capturé puis rejoué des heures plus
 *     tard est refusé.
 *  3. **Déduplication par `event_id`** — Wave réessaie ; cinq livraisons du même événement ne
 *     doivent produire qu'une seule transition d'état.
 *
 * ⚠️ Le nom de l'en-tête et le format de signature ci-dessous (`t=<unix>,v1=<hex>`, HMAC-SHA256
 * de `<unix>.<corps>`) suivent la convention la plus répandue. **Ils doivent être confirmés sur
 * la documentation Wave en vigueur avant activation.** Tant que `signatureHeader` n'est pas
 * renseigné, la vérification refuse de s'exécuter plutôt que de valider n'importe quoi.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Secret } from '../secrets/secrets';
import { EndpointContractUnknownError } from '../wave/wave-client';

export class WebhookError extends Error {
  constructor(message: string, nom: string) {
    super(message);
    this.name = nom;
  }
}

export class MalformedWebhookError extends WebhookError {
  constructor(detail: string) {
    super(`webhook illisible : ${detail}`, 'MalformedWebhookError');
  }
}

export class InvalidWebhookSignatureError extends WebhookError {
  constructor() {
    super('signature de webhook invalide', 'InvalidWebhookSignatureError');
  }
}

export class TimestampOutOfWindowError extends WebhookError {
  constructor(ecartSecondes: number, tolerance: number) {
    super(
      `horodatage hors fenêtre : ${ecartSecondes} s d'écart pour une tolérance de ${tolerance} s`,
      'TimestampOutOfWindowError',
    );
  }
}

export interface WebhookInput {
  /** Corps brut, tel que reçu. Ne jamais passer un objet re-sérialisé. */
  readonly rawBody: string;
  readonly headers: Record<string, string>;
  readonly asOf: string;
}

export interface VerifiedWebhook {
  readonly eventId: string;
  readonly eventType: string;
  readonly emisA: string;
  readonly payload: Record<string, unknown>;
}

export interface WebhookVerifierOptions {
  readonly signatureHeader: string;
  readonly toleranceSecondes: number;
}

const SIGNATURE = /^t=(\d{1,15}),v1=([0-9a-f]{64})$/;

function enTete(headers: Record<string, string>, nom: string): string | null {
  const cible = nom.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === cible) return v;
  }
  return null;
}

export class WebhookVerifier {
  constructor(
    private readonly secret: Secret,
    private readonly options: WebhookVerifierOptions,
  ) {}

  verify(input: WebhookInput): VerifiedWebhook {
    if (!this.options.signatureHeader) {
      throw new EndpointContractUnknownError(
        'nom de l’en-tête de signature des webhooks Wave et format de la signature',
      );
    }

    const brut = enTete(input.headers, this.options.signatureHeader);
    if (brut === null) throw new MalformedWebhookError('en-tête de signature absent');

    const trouve = SIGNATURE.exec(brut);
    if (trouve === null) throw new MalformedWebhookError('en-tête de signature mal formé');

    const [, unixTexte, macFournie] = trouve;
    const unix = Number(unixTexte);

    const attendue = createHmac('sha256', this.secret.expose())
      .update(`${unix}.${input.rawBody}`)
      .digest('hex');

    const a = Buffer.from(attendue, 'utf8');
    const b = Buffer.from(macFournie, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new InvalidWebhookSignatureError();
    }

    // La fenêtre est contrôlée APRÈS la signature : un horodatage non signé ne mérite pas
    // qu'on s'y intéresse.
    const asOf = Date.parse(input.asOf);
    if (Number.isNaN(asOf)) throw new MalformedWebhookError('date de référence invalide');
    const ecart = Math.abs(Math.floor(asOf / 1000) - unix);
    if (ecart > this.options.toleranceSecondes) {
      throw new TimestampOutOfWindowError(ecart, this.options.toleranceSecondes);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(input.rawBody);
    } catch {
      throw new MalformedWebhookError('corps non analysable');
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new MalformedWebhookError('corps sans objet racine');
    }

    const objet = payload as Record<string, unknown>;
    const eventId = objet.id;
    const eventType = objet.type;
    if (typeof eventId !== 'string' || eventId.length === 0) {
      // Sans identifiant stable, la déduplication est impossible et un rejeu passerait deux fois.
      throw new MalformedWebhookError('événement sans identifiant');
    }

    return {
      eventId,
      eventType: typeof eventType === 'string' ? eventType : 'inconnu',
      emisA: new Date(unix * 1000).toISOString(),
      payload: objet,
    };
  }
}

/**
 * Registre des événements déjà traités.
 *
 * `markIfNew` doit être **atomique** : deux livraisons concurrentes du même événement ne peuvent
 * pas obtenir `true` toutes les deux. En base, c'est l'insertion dans `webhook_events` avec sa
 * clé primaire qui le garantit.
 */
export interface ProcessedEventStore {
  markIfNew(eventId: string): Promise<boolean>;
  forget(eventId: string): Promise<void>;
}

export class InMemoryProcessedEventStore implements ProcessedEventStore {
  readonly #vus = new Set<string>();

  async markIfNew(eventId: string): Promise<boolean> {
    if (this.#vus.has(eventId)) return false;
    this.#vus.add(eventId);
    return true;
  }

  async forget(eventId: string): Promise<void> {
    this.#vus.delete(eventId);
  }
}

export class WebhookDeduplicator {
  constructor(private readonly store: ProcessedEventStore) {}

  /**
   * Exécute `traitement` au plus une fois pour cet `eventId`.
   *
   * Si le traitement échoue, la marque est retirée : Wave rejouera, et le rejeu doit pouvoir
   * aboutir. Un échec de traitement n'est pas un événement traité.
   */
  async once(eventId: string, traitement: () => Promise<void>): Promise<boolean> {
    const nouveau = await this.store.markIfNew(eventId);
    if (!nouveau) return false;

    try {
      await traitement();
      return true;
    } catch (cause) {
      await this.store.forget(eventId);
      throw cause;
    }
  }
}
