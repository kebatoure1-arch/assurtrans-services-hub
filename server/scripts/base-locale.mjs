#!/usr/bin/env node
/**
 * Base PostgreSQL locale, sans Docker ni installation système.
 *
 * `embedded-postgres` télécharge une distribution PostgreSQL portable et la démarre comme un
 * simple processus utilisateur. C'est ce qui permet de disposer d'une vraie base sur un poste
 * où le démon Docker exige des droits d'administrateur.
 *
 *   node scripts/base-locale.mjs demarrer   crée la base si besoin, la démarre, applique les
 *                                           migrations, et affiche l'URL de connexion
 *   node scripts/base-locale.mjs arreter    arrête le serveur, les données restent
 *   node scripts/base-locale.mjs effacer    arrête et supprime tout
 *
 * Les données vivent dans `server/.donnees-locales/`, ignoré par git. Ce n'est PAS un serveur
 * de production : il n'écoute que sur la boucle locale, avec un mot de passe de développement
 * écrit en clair ci-dessous. Une base de production se provisionne ailleurs, et son URL arrive
 * par `DATABASE_URL`.
 */

import { existsSync, rmSync } from 'node:fs';
import pg from 'pg';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DONNEES = join(RACINE, '.donnees-locales');

const PORT = Number(process.env.PG_LOCAL_PORT ?? 55432);
const UTILISATEUR = 'assurtrans';
const MOT_DE_PASSE = 'developpement-local-uniquement';
const BASE = 'assurtrans';
// Base separee pour les tests d'integration : leur `beforeEach` fait un TRUNCATE CASCADE de
// tout le referentiel. Partager la base de developpement reviendrait a effacer l'entite, le
// contrat et l'administrateur a chaque execution de la suite.
const BASE_TEST = 'assurtrans_test';

const urlDe = (base) => `postgres://${UTILISATEUR}:${MOT_DE_PASSE}@localhost:${PORT}/${base}`;

export const URL_LOCALE = urlDe(BASE);
export const URL_TEST = urlDe(BASE_TEST);

/**
 * Cree la base en UTF-8, explicitement.
 *
 * Sur un poste Windows, le cluster s'initialise avec l'encodage du systeme — WIN1252 ici. Une
 * base heritant de cet encodage refuse tout caractere hors Latin-1, et le projet est
 * francophone : noms de stations, libelles, commentaires de migrations. `template0` est le
 * seul modele qui autorise un encodage different de celui du cluster.
 */
async function creerBaseUtf8(base) {
  const client = new pg.Client({
    connectionString: `postgres://${UTILISATEUR}:${MOT_DE_PASSE}@localhost:${PORT}/postgres`,
  });
  await client.connect();
  try {
    const existe = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [base]);
    if (existe.rows.length > 0) {
      const encodage = await client.query(
        'SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1',
        [base],
      );
      console.log(`base « ${base} » deja presente (encodage ${encodage.rows[0].enc})`);
      return;
    }
    await client.query(
      `CREATE DATABASE ${base} WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
    );
    console.log(`base « ${base} » creee en UTF-8`);
  } finally {
    await client.end();
  }
}

function serveur() {
  return new EmbeddedPostgres({
    databaseDir: DONNEES,
    user: UTILISATEUR,
    password: MOT_DE_PASSE,
    port: PORT,
    persistent: true,
  });
}

async function demarrer() {
  const pg = serveur();
  const premiereFois = !existsSync(DONNEES);

  if (premiereFois) {
    console.log('initialisation du répertoire de données…');
    await pg.initialise();
  }

  await pg.start();

  await creerBaseUtf8(BASE);
  await creerBaseUtf8(BASE_TEST);

  console.log(`PostgreSQL écoute sur le port ${PORT}`);
  console.log(`  DATABASE_URL      ${URL_LOCALE}`);
  console.log(`  DATABASE_URL_TEST ${URL_TEST}`);

  // Le serveur est un processus fils : il meurt avec celui-ci. On reste donc en vie jusqu'a
  // interruption, comme n'importe quel serveur de developpement.
  await new Promise((resoudre) => {
    const fermer = async () => {
      await pg.stop().catch(() => undefined);
      resoudre();
    };
    process.on('SIGINT', fermer);
    process.on('SIGTERM', fermer);
  });
}

async function arreter() {
  await serveur().stop();
  console.log('PostgreSQL arrêté. Les données sont conservées.');
}

async function effacer() {
  try {
    await serveur().stop();
  } catch {
    /* déjà arrêté */
  }
  rmSync(DONNEES, { recursive: true, force: true });
  console.log('base locale supprimée.');
}

const commande = process.argv[2] ?? 'demarrer';

const actions = { demarrer, arreter, effacer };
const action = actions[commande];

if (action === undefined) {
  console.error(`commande inconnue : ${commande}. Attendu : demarrer | arreter | effacer`);
  process.exit(1);
}

try {
  await action();
  process.exit(0);
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
}
