/**
 * Implementations Postgres des ports d'authentification.
 */

import { randomUUID } from 'node:crypto';
import type { OtpChallenge } from '../../domain/otp.ts';
import type {
  AnnuaireComptes,
  ApiTokenIssuer,
  OtpChallengeRepository,
} from '../../ports/authentication.ts';
import { empreinte, genererJeton, type ApiRole } from '../auth/api-tokens.ts';
import type { SqlExecutor } from './sql-executor.ts';

function instant(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return new Date(String(v)).toISOString();
}

export class PgOtpChallengeRepository implements OtpChallengeRepository {
  constructor(private readonly db: SqlExecutor) {}

  async trouverVivant(msisdn: string): Promise<OtpChallenge | null> {
    const r = await this.db.query(
      `SELECT id, msisdn, code_hash, emis_a, expire_a, tentatives, max_tentatives, consomme
         FROM otp_challenges WHERE msisdn = $1 AND consomme = false`,
      [msisdn],
    );
    if (r.rows.length === 0) return null;
    const l = r.rows[0];
    return {
      id: String(l.id),
      msisdn: String(l.msisdn),
      codeHash: String(l.code_hash),
      emisA: instant(l.emis_a),
      expireA: instant(l.expire_a),
      tentatives: Number(l.tentatives),
      maxTentatives: Number(l.max_tentatives),
      consomme: Boolean(l.consomme),
    };
  }

  /**
   * Demander un nouveau code invalide le precedent. Sans cela, deux codes vivants
   * coexisteraient et l'index unique refuserait l'insertion.
   */
  async remplacer(c: OtpChallenge): Promise<void> {
    await this.db.query(
      `UPDATE otp_challenges SET consomme = true WHERE msisdn = $1 AND consomme = false`,
      [c.msisdn],
    );
    await this.db.query(
      `INSERT INTO otp_challenges
         (id, msisdn, code_hash, emis_a, expire_a, tentatives, max_tentatives, consomme)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [c.id, c.msisdn, c.codeHash, c.emisA, c.expireA, c.tentatives, c.maxTentatives],
    );
  }

  async majTentative(c: OtpChallenge): Promise<void> {
    await this.db.query(
      `UPDATE otp_challenges SET tentatives = $2, consomme = $3 WHERE id = $1`,
      [c.id, c.tentatives, c.consomme],
    );
  }

  async compterDepuis(msisdn: string, depuis: string): Promise<number> {
    const r = await this.db.query(
      `SELECT count(*)::int AS n FROM otp_challenges WHERE msisdn = $1 AND emis_a >= $2`,
      [msisdn, depuis],
    );
    return Number(r.rows[0]?.n ?? 0);
  }
}

export class PgApiTokenIssuer implements ApiTokenIssuer {
  constructor(private readonly db: SqlExecutor) {}

  async emettre(input: {
    subject: string;
    role: ApiRole;
    stationId: string | null;
    expireA: string;
    libelle: string;
  }): Promise<string> {
    const jeton = genererJeton();
    await this.db.query(
      `INSERT INTO api_tokens (id, role, subject, token_hash, station_id, libelle, expire_a)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        input.role,
        input.subject,
        empreinte(jeton),
        input.stationId,
        input.libelle,
        input.expireA,
      ],
    );
    return jeton;
  }
}

export class PgAnnuaireComptes implements AnnuaireComptes {
  constructor(private readonly db: SqlExecutor) {}

  async resoudre(msisdn: string) {
    const chauffeur = await this.db.query(
      `SELECT id FROM drivers WHERE msisdn = $1 AND statut = 'ACTIF'`,
      [msisdn],
    );
    if (chauffeur.rows.length > 0) {
      return { subject: String(chauffeur.rows[0].id), role: 'DRIVER' as ApiRole, stationId: null };
    }

    const operateur = await this.db.query(
      `SELECT id, role, station_id FROM operateurs WHERE msisdn = $1 AND statut = 'ACTIF'`,
      [msisdn],
    );
    if (operateur.rows.length > 0) {
      const l = operateur.rows[0];
      return {
        subject: String(l.id),
        role: l.role as ApiRole,
        stationId: l.station_id === null || l.station_id === undefined ? null : String(l.station_id),
      };
    }

    return null;
  }
}
