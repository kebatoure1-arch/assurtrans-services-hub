/**
 * Authentification par jeton porteur.
 *
 * Le jeton n'est jamais stocké : seule son empreinte SHA-256 l'est. Une fuite de la base ne donne
 * donc pas la capacité d'appeler l'API.
 *
 * La recherche se fait **par empreinte**, via un index unique. Il n'y a aucune comparaison de
 * secret en mémoire, donc aucune fuite de temps à protéger.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { SqlExecutor } from '../db/sql-executor.ts';

export type ApiRole = 'DRIVER' | 'STATION_OPERATOR' | 'ADMIN';

export interface Principal {
  readonly subject: string;
  readonly role: ApiRole;
  /** Station de rattachement d'un pompiste. `null` pour les autres rôles. */
  readonly stationId: string | null;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<Principal | null>;
}

export function empreinte(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Génère un jeton d'API. Rendu une seule fois, à l'émission : il n'est plus jamais lisible. */
export function genererJeton(): string {
  return `at_${randomBytes(32).toString('base64url')}`;
}

export class PgAccessTokenVerifier implements AccessTokenVerifier {
  constructor(private readonly db: SqlExecutor) {}

  async verify(token: string): Promise<Principal | null> {
    if (typeof token !== 'string' || token.length < 16) return null;

    const r = await this.db.query(
      `UPDATE api_tokens
          SET dernier_usage = now()
        WHERE token_hash = $1 AND revoque_a IS NULL
      RETURNING subject, role, station_id`,
      [empreinte(token)],
    );
    if (r.rows.length === 0) return null;

    const l = r.rows[0];
    return {
      subject: String(l.subject),
      role: l.role as ApiRole,
      stationId: l.station_id === null || l.station_id === undefined ? null : String(l.station_id),
    };
  }
}
