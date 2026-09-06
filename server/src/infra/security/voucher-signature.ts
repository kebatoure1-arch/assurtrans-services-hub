/**
 * Signature des bons carburant.
 *
 * Le QR présenté au pompiste porte un jeton signé. Trois propriétés :
 *
 *  1. **Non forgeable** — la clé HMAC ne quitte jamais le serveur. Un secret de signature publié
 *     dans un bundle client ne signe rien : quiconque peut l'extraire peut émettre des bons.
 *     C'est le défaut que remplace ce module.
 *  2. **Non modifiable** — le montant et l'identifiant sont couverts par la signature. Gonfler
 *     un montant invalide le jeton.
 *  3. **Rotative** — un bon vit 24 h. Changer la clé ne doit pas invalider les bons déjà envoyés
 *     par WhatsApp, d'où la liste de clés de vérification héritées.
 *
 * La signature ne remplace pas la consommation côté serveur : un jeton valide dit « ce bon a
 * bien été émis par nous », pas « ce bon n'a pas déjà été utilisé ». L'unicité d'usage est
 * portée par la base (voir migration 0002).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Secret } from '../secrets/secrets.ts';

const PREFIXE = 'AT1';

export class SignatureError extends Error {
  constructor(message: string, nom: string) {
    super(message);
    this.name = nom;
  }
}

export class MalformedTokenError extends SignatureError {
  constructor() {
    // Message volontairement uniforme : on ne renseigne pas un attaquant sur ce qui a échoué.
    super('jeton illisible', 'MalformedTokenError');
  }
}

export class InvalidSignatureError extends SignatureError {
  constructor() {
    super('signature invalide', 'InvalidSignatureError');
  }
}

export interface VoucherPayload {
  readonly id: string;
  readonly montant: number;
  readonly expireA: string;
}

interface ChargeSerialisee {
  readonly v: 1;
  readonly i: string;
  readonly m: number;
  readonly e: string;
}

function estChargeValide(x: unknown): x is ChargeSerialisee {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    c.v === 1 &&
    typeof c.i === 'string' &&
    c.i.length > 0 &&
    typeof c.m === 'number' &&
    Number.isSafeInteger(c.m) &&
    c.m > 0 &&
    typeof c.e === 'string' &&
    c.e.length > 0
  );
}

export class VoucherSigner {
  /**
   * @param cleActive   clé utilisée pour signer les nouveaux bons
   * @param clesHeritees clés acceptées en vérification seulement, le temps d'une rotation
   */
  constructor(
    private readonly cleActive: Secret,
    private readonly clesHeritees: readonly Secret[] = [],
  ) {}

  private hmac(cle: Secret, charge: string): Buffer {
    return createHmac('sha256', cle.expose()).update(`${PREFIXE}.${charge}`).digest();
  }

  sign(payload: VoucherPayload): string {
    const charge: ChargeSerialisee = {
      v: 1,
      i: payload.id,
      m: payload.montant,
      e: payload.expireA,
    };
    const encodee = Buffer.from(JSON.stringify(charge), 'utf8').toString('base64url');
    return `${PREFIXE}.${encodee}.${this.hmac(this.cleActive, encodee).toString('base64url')}`;
  }

  verify(jeton: string): VoucherPayload {
    if (typeof jeton !== 'string') throw new MalformedTokenError();

    const morceaux = jeton.split('.');
    if (morceaux.length !== 3) throw new MalformedTokenError();

    const [prefixe, encodee, signature] = morceaux;
    if (prefixe !== PREFIXE || encodee.length === 0 || signature.length === 0) {
      throw new MalformedTokenError();
    }

    const fournie = Buffer.from(signature, 'base64url');

    // Toutes les clés sont essayées : l'active d'abord, puis les héritées le temps d'une
    // rotation. La comparaison est à durée constante et la longueur est vérifiée d'abord —
    // `timingSafeEqual` lève sur des longueurs différentes.
    const acceptee = [this.cleActive, ...this.clesHeritees].some((cle) => {
      const attendue = this.hmac(cle, encodee);
      return attendue.length === fournie.length && timingSafeEqual(attendue, fournie);
    });

    if (!acceptee) throw new InvalidSignatureError();

    let charge: unknown;
    try {
      charge = JSON.parse(Buffer.from(encodee, 'base64url').toString('utf8'));
    } catch {
      throw new MalformedTokenError();
    }
    if (!estChargeValide(charge)) throw new MalformedTokenError();

    return { id: charge.i, montant: charge.m, expireA: charge.e };
  }
}
