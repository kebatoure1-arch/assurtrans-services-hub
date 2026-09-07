/**
 * Ecriture du journal d'audit dans PostgreSQL.
 */

import { empreintePayload, type EvenementAudit } from '../../domain/audit.ts';
import type { AuditLogger } from '../../ports/audit.ts';
import type { SqlExecutor } from '../db/sql-executor.ts';

export class PgAuditLogger implements AuditLogger {
  constructor(private readonly db: SqlExecutor) {}

  /**
   * N'echoue jamais.
   *
   * Un journal indisponible est un incident d'exploitation, pas une raison de refuser
   * l'action metier en cours : refuser la suspension d'un chauffeur parce que la ligne de
   * trace n'a pas pu s'ecrire ne rendrait le systeme ni plus sur, ni plus tracable. L'echec
   * est signale dans les journaux applicatifs, ou la supervision le voit.
   */
  async enregistrer(evenement: EvenementAudit): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_events (actor, action, target_type, target_id, payload_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          evenement.actor,
          evenement.action,
          evenement.targetType,
          evenement.targetId,
          empreintePayload(evenement.payload),
        ],
      );
    } catch (cause) {
      console.error(
        JSON.stringify({
          incident: 'ecriture du journal d audit impossible',
          action: evenement.action,
          cible: `${evenement.targetType}/${evenement.targetId}`,
          detail: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}

/** Journal en memoire, pour les tests et la demonstration. */
export class InMemoryAuditLogger implements AuditLogger {
  readonly evenements: EvenementAudit[] = [];
  async enregistrer(evenement: EvenementAudit): Promise<void> {
    this.evenements.push(evenement);
  }
}
