/**
 * Verrou de travaux, en base.
 *
 * Deux exemplaires du serveur ne doivent pas reprendre les mêmes envois interrompus au même
 * instant. La prise du verrou est une **écriture conditionnelle** — comme partout ailleurs où
 * l'atomicité compte, ce n'est pas le code qui arbitre mais la base :
 *
 *   `INSERT ... ON CONFLICT (job_name) DO UPDATE ... WHERE job_locks.expires_at < now()`
 *
 * Lire puis écrire laisserait passer les deux exemplaires : entre le `SELECT` et l'`UPDATE`,
 * l'autre est déjà entré.
 *
 * L'échéance est le second choix structurant. Un exemplaire tué en tenant le verrou ne le rend
 * jamais ; sans échéance, la reprise cesserait définitivement — ce qui est pire que de la faire
 * deux fois. Le verrou expire donc de lui-même, et la durée doit dépasser la durée d'un
 * passage, sinon deux exemplaires se retrouveraient dedans.
 */

import type { VerrouTravaux } from '../../ports/verrou.ts';
import type { SqlExecutor } from './sql-executor.ts';

export class PgVerrouTravaux implements VerrouTravaux {
  constructor(
    private readonly db: SqlExecutor,
    /** Qui tient le verrou. Sert au diagnostic, pas à la décision. */
    private readonly porteur: string,
    private readonly dureeSecondes: number,
  ) {}

  async prendre(nom: string): Promise<boolean> {
    const r = await this.db.query(
      `INSERT INTO job_locks (job_name, locked_by, locked_at, expires_at)
       VALUES ($1, $2, now(), now() + make_interval(secs => $3))
       ON CONFLICT (job_name) DO UPDATE
          SET locked_by  = EXCLUDED.locked_by,
              locked_at  = now(),
              expires_at = EXCLUDED.expires_at
        WHERE job_locks.expires_at < now()`,
      [nom, this.porteur, this.dureeSecondes],
    );
    return r.rowCount === 1;
  }

  /**
   * Rendre le verrou, mais seulement si c'est bien le nôtre.
   *
   * Sans la condition sur `locked_by`, un exemplaire dont le verrou a expiré et qui a été repris
   * par un autre libérerait le verrou de cet autre en terminant son propre passage.
   */
  async rendre(nom: string): Promise<void> {
    await this.db.query(
      `UPDATE job_locks SET expires_at = now() WHERE job_name = $1 AND locked_by = $2`,
      [nom, this.porteur],
    );
  }
}
