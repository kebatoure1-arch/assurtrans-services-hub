/**
 * Port du journal d'audit.
 *
 * `enregistrer` ne leve jamais : voir la note d'implementation dans
 * `infra/audit/audit-logger.ts`.
 */

import type { EvenementAudit } from '../domain/audit.ts';

export interface AuditLogger {
  enregistrer(evenement: EvenementAudit): Promise<void>;
}
