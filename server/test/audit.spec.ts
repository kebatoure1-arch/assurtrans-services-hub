import { describe, expect, it } from 'vitest';
import { empreintePayload, type EvenementAudit } from '../src/domain/audit.ts';
import { PgAuditLogger } from '../src/infra/audit/audit-logger.ts';
import type { SqlExecutor, SqlResult } from '../src/infra/db/sql-executor.ts';

class ExecuteurFactice implements SqlExecutor {
  readonly appels: { texte: string; params: readonly unknown[] }[] = [];
  async query(texte: string, params: readonly unknown[] = []): Promise<SqlResult> {
    this.appels.push({ texte, params });
    return { rows: [], rowCount: 1 };
  }
}

const EVENEMENT: EvenementAudit = {
  actor: 'admin-1',
  action: 'DRIVER_SUSPENDU',
  targetType: 'driver',
  targetId: 'chauffeur-7',
  payload: { motif: 'demande du gestionnaire de flotte', msisdn: '+221770000001' },
};

describe('empreinte du payload', () => {
  it('est stable : deux fois le même contenu donnent la même empreinte', () => {
    expect(empreintePayload({ a: 1, b: 'x' })).toBe(empreintePayload({ a: 1, b: 'x' }));
  });

  it('ne dépend pas de l’ordre des clés — sinon la trace serait illisible à la relecture', () => {
    expect(empreintePayload({ a: 1, b: 2 })).toBe(empreintePayload({ b: 2, a: 1 }));
  });

  it('change dès que le contenu change', () => {
    expect(empreintePayload({ a: 1 })).not.toBe(empreintePayload({ a: 2 }));
  });

  it('rend une empreinte SHA-256 en hexadécimal', () => {
    expect(empreintePayload({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepte un payload vide', () => {
    expect(empreintePayload({})).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('journal d’audit', () => {
  it('écrit l’acteur, l’action et la cible', async () => {
    const db = new ExecuteurFactice();
    await new PgAuditLogger(db).enregistrer(EVENEMENT);

    expect(db.appels[0].texte).toMatch(/INSERT\s+INTO\s+audit_events/i);
    expect(db.appels[0].params).toContain('admin-1');
    expect(db.appels[0].params).toContain('DRIVER_SUSPENDU');
    expect(db.appels[0].params).toContain('chauffeur-7');
  });

  it('n’écrit jamais le payload en clair, seulement son empreinte', async () => {
    const db = new ExecuteurFactice();
    await new PgAuditLogger(db).enregistrer(EVENEMENT);

    const parametres = JSON.stringify(db.appels[0].params);
    // Le journal trace qui a fait quoi, pas les donnees personnelles manipulees au passage.
    expect(parametres).not.toContain('+221770000001');
    expect(parametres).not.toContain('gestionnaire de flotte');
    expect(db.appels[0].params).toContain(empreintePayload(EVENEMENT.payload));
  });

  it('n’émet aucun UPDATE ni DELETE — la table est en ajout seul', async () => {
    const db = new ExecuteurFactice();
    const logger = new PgAuditLogger(db);
    await logger.enregistrer(EVENEMENT);
    await logger.enregistrer({ ...EVENEMENT, action: 'DRIVER_REACTIVE' });

    const sql = db.appels.map((a) => a.texte).join(' ');
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b/i);
    expect(db.appels).toHaveLength(2);
  });

  it('une écriture d’audit qui échoue ne fait pas échouer l’action métier', async () => {
    // Un journal indisponible est un incident d'exploitation. Refuser au passage la suspension
    // d'un chauffeur ne rendrait le systeme ni plus sur, ni plus tracable.
    const db: SqlExecutor = {
      async query() {
        throw new Error('base indisponible');
      },
    };
    await expect(new PgAuditLogger(db).enregistrer(EVENEMENT)).resolves.toBeUndefined();
  });
});
