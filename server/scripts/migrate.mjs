#!/usr/bin/env node
/**
 * Applique les migrations dans l'ordre, une fois chacune.
 *
 * Chaque migration est jouée dans sa propre transaction : elle passe entièrement ou pas du tout.
 * L'enregistrement dans `schema_migrations` fait partie de la même transaction — il ne peut donc
 * pas exister de migration marquée appliquée mais non appliquée.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error('usage : node scripts/migrate.mjs <url-postgres>  (ou DATABASE_URL)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    nom        TEXT PRIMARY KEY,
    applique_a TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const deja = new Set(
  (await client.query('SELECT nom FROM schema_migrations')).rows.map((r) => r.nom),
);

const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let appliquees = 0;
for (const fichier of fichiers) {
  if (deja.has(fichier)) continue;

  const sql = readFileSync(join(DOSSIER, fichier), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [fichier]);
    await client.query('COMMIT');
    console.log(`appliquee : ${fichier}`);
    appliquees += 1;
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(`echec sur ${fichier} : ${cause.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(
  appliquees === 0
    ? `aucune migration a appliquer (${fichiers.length} deja en place)`
    : `${appliquees} migration(s) appliquee(s)`,
);
await client.end();
