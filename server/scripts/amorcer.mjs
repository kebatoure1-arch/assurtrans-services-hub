#!/usr/bin/env node
/**
 * Amorçage d'une base neuve.
 *
 * Il y a un œuf et une poule : créer un administrateur passe par l'API, qui exige déjà un
 * jeton d'administrateur. Ce script coupe la boucle, une fois, en écrivant directement en base.
 *
 *   node scripts/amorcer.mjs --entite "Assur'Trans SARL" --admin "Awa Fall" --telephone 770000003
 *
 * Options : --ninea, --rccm, --compte-te, --encours, --delai.
 *
 * Il refuse de s'exécuter si un administrateur existe déjà : c'est un outil d'installation,
 * pas une porte dérobée. Tout le reste — chauffeurs, stations, pompistes — se crée ensuite par
 * l'interface, où chaque geste laisse une trace d'audit.
 */

import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { ATTENDU, normaliserMsisdn } from './msisdn.mjs';

function argument(nom, defaut = null) {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : defaut;
}

const url = argument('url', process.env.DATABASE_URL);
if (!url) {
  console.error('DATABASE_URL manquante (ou --url).');
  process.exit(1);
}

const entite = argument('entite');
const admin = argument('admin');
const telephone = argument('telephone');

if (!entite || !admin || !telephone) {
  console.error('usage : --entite "Raison sociale" --admin "Nom" --telephone 77XXXXXXX');
  process.exit(1);
}

/**
 * Empreinte du payload, comme `src/domain/audit.ts` : clés triées puis SHA-256.
 *
 * Reproduite ici plutôt qu'importée : ce script doit tourner sur une base neuve, avant toute
 * compilation. Les deux implémentations doivent produire la même empreinte pour un même
 * contenu, sinon la première ligne du journal ne serait pas vérifiable comme les suivantes.
 */
function empreintePayload(payload) {
  const canonique = (valeur) => {
    if (valeur === null || typeof valeur !== 'object') return JSON.stringify(valeur) ?? 'null';
    if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`;
    const entrees = Object.entries(valeur)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([cle, v]) => `${JSON.stringify(cle)}:${canonique(v)}`);
    return `{${entrees.join(',')}}`;
  };
  return createHash('sha256').update(canonique(payload), 'utf8').digest('hex');
}

const msisdn = normaliserMsisdn(telephone);
if (msisdn === null) {
  console.error(`numéro inexploitable : « ${telephone} ». Attendu ${ATTENDU}.`);
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const deja = await client.query(`SELECT nom, msisdn FROM operateurs WHERE role = 'ADMIN' LIMIT 1`);
  if (deja.rows.length > 0) {
    console.error(
      `un administrateur existe déjà (${deja.rows[0].nom}, ${deja.rows[0].msisdn}).\n` +
        'Les suivants se créent depuis l’interface, où la création laisse une trace.',
    );
    process.exit(1);
  }

  await client.query('BEGIN');

  const entityId = randomUUID();
  await client.query(
    'INSERT INTO entities (id, raison_sociale, ninea, rccm) VALUES ($1, $2, $3, $4)',
    [entityId, entite, argument('ninea'), argument('rccm')],
  );

  const compteTe = argument('compte-te');
  let contratId = null;
  if (compteTe !== null) {
    contratId = randomUUID();
    await client.query(
      `INSERT INTO te_contracts (id, entity_id, numero_compte_te, encours_autorise,
                                 delai_reglement_jours)
       VALUES ($1, $2, $3, $4, $5)`,
      [contratId, entityId, compteTe, argument('encours', '10000000'), argument('delai', '30')],
    );
  }

  const adminId = randomUUID();
  await client.query(
    `INSERT INTO operateurs (id, nom, msisdn, role, station_id) VALUES ($1, $2, $3, 'ADMIN', NULL)`,
    [adminId, admin, msisdn],
  );

  // Le premier acte du systeme est trace comme tous les suivants. `actor` vaut « amorcage » et
  // non un identifiant d'operateur : personne n'etait encore authentifie a cet instant, et le
  // journal doit le dire.
  const traces = [
    ['ENTITE_CREEE', 'entity', entityId, { raisonSociale: entite }],
    ['OPERATEUR_CREE', 'operateur', adminId, { nom: admin, msisdn, role: 'ADMIN' }],
  ];
  if (contratId !== null) {
    traces.push(['CONTRAT_TE_CREE', 'te_contract', contratId, { numeroCompteTe: compteTe }]);
  }

  for (const [action, targetType, targetId, payload] of traces) {
    await client.query(
      `INSERT INTO audit_events (actor, action, target_type, target_id, payload_hash)
       VALUES ('amorcage', $1, $2, $3, $4)`,
      [action, targetType, targetId, empreintePayload(payload)],
    );
  }

  await client.query('COMMIT');

  console.log('Base amorcée.');
  console.log(`  entité      ${entite}`);
  console.log(`  ENTITY_ID   ${entityId}`);
  if (contratId !== null) console.log(`  contrat TE  ${compteTe}`);
  console.log(`  admin       ${admin} · ${msisdn}`);
  console.log('');
  console.log(`Reportez ENTITY_ID=${entityId} dans server/.env, puis redémarrez le serveur.`);
} catch (cause) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
} finally {
  await client.end();
}
