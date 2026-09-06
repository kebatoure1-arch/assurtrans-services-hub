/**
 * Accès SQL minimal.
 *
 * Les repositories ne dépendent que de cette interface : elle se satisfait d'un pool
 * node-postgres comme d'un client de transaction, sans que le code appelant ait à savoir lequel.
 */

export interface SqlResult {
  readonly rows: readonly Record<string, unknown>[];
  /** Nombre de lignes touchées. C'est lui qui porte le résultat des écritures conditionnelles. */
  readonly rowCount: number;
}

export interface SqlExecutor {
  query(texte: string, params?: readonly unknown[]): Promise<SqlResult>;
}

/** Exécute un bloc dans une transaction. */
export interface TransactionRunner {
  inTransaction<T>(bloc: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
