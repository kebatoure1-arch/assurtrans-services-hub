/**
 * Adaptateur node-postgres.
 *
 * Le reste du code ne dépend que de `SqlExecutor` : ce fichier est le seul à connaître `pg`.
 */

import { Pool, type PoolClient } from 'pg';
import type { Secret } from '../secrets/secrets.ts';
import type { SqlExecutor, SqlResult, TransactionRunner } from './sql-executor.ts';

export class PgDatabase implements SqlExecutor, TransactionRunner {
  private readonly pool: Pool;

  constructor(url: Secret, options: { readonly maxConnexions?: number } = {}) {
    // L'URL contient le mot de passe : elle est portée par `Secret` et exposée ici uniquement.
    this.pool = new Pool({ connectionString: url.expose(), max: options.maxConnexions ?? 10 });
  }

  async query(texte: string, params: readonly unknown[] = []): Promise<SqlResult> {
    const r = await this.pool.query(texte, params as unknown[]);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  }

  /**
   * Exécute un bloc dans une transaction. Un échec annule tout : c'est ce qui permet
   * d'enregistrer un paiement et d'émettre son bon sans jamais laisser l'un sans l'autre.
   */
  async inTransaction<T>(bloc: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const executeur: SqlExecutor = {
        query: async (texte, params = []) => {
          const r = await client.query(texte, params as unknown[]);
          return { rows: r.rows, rowCount: r.rowCount ?? 0 };
        },
      };
      const resultat = await bloc(executeur);
      await client.query('COMMIT');
      return resultat;
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw cause;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
