#!/usr/bin/env node
/**
 * Jeu de donnees de demonstration.
 *
 * Sert a parcourir les trois interfaces sur des donnees qui ressemblent a de l'exploitation :
 * un chauffeur qui a un QR a montrer, un pompiste qui a quelque chose a scanner, un
 * administrateur dont la jauge n'est pas a zero.
 *
 *   node scripts/jeu-demo.mjs charger
 *   node scripts/jeu-demo.mjs effacer
 *
 * Deux garde-fous, parce qu'un jeu de demonstration charge par erreur en production melange des
 * chiffres inventes a des chiffres reels, et plus personne ne sait lesquels sont lesquels :
 *
 *   1. Le script refuse toute base dont l'hote n'est pas local.
 *   2. Chaque ligne porte un identifiant derive d'un libelle fixe. Recharger ne duplique rien,
 *      et `effacer` retire exactement ce qui a ete pose — jamais une ligne d'exploitation.
 *
 * Les numeros de telephone appartiennent tous a la plage +22177000000x, qui n'est attribuee a
 * personne. Aucun SMS ne partira vers un vrai abonne si la passerelle est branchee par erreur.
 */

import { createHash } from 'node:crypto';
import pg from 'pg';

const MSISDN_ADMIN_ATTENDU = /^\+2217700000\d\d$/;

function argument(nom, defaut = null) {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : defaut;
}

const url = argument('url', process.env.DATABASE_URL);
if (!url) {
  console.error('DATABASE_URL manquante (ou --url).');
  process.exit(1);
}

/**
 * Refuse une base distante.
 *
 * Un jeu de demonstration est indiscernable d'une donnee reelle une fois en base : meme tables,
 * meme forme. La seule protection qui tienne est de ne jamais pouvoir l'ecrire ailleurs qu'en
 * local.
 */
{
  const hote = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1', ''].includes(hote)) {
    console.error(
      `refus : « ${hote} » n'est pas une base locale.\n` +
        "Un jeu de demonstration ne se charge pas sur une base distante — une fois melange a " +
        "de l'exploitation, plus personne ne distingue les chiffres inventes des vrais.",
    );
    process.exit(1);
  }
}

/**
 * Identifiant stable derive d'un libelle.
 *
 * Deux executations produisent les memes identifiants : recharger ne duplique pas, et l'effacement
 * cible exactement les lignes posees ici. Le format respecte la version 8 (UUID « custom »), qui
 * existe precisement pour les identifiants derives d'autre chose que du hasard.
 */
function idDe(libelle) {
  const h = createHash('sha256').update(`assurtrans/demo/${libelle}`).digest('hex');
  const variante = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
  return [h.slice(0, 8), h.slice(8, 12), `8${h.slice(13, 16)}`, `${variante}${h.slice(18, 20)}`, h.slice(20, 32)].join('-');
}

const JOUR = 86_400_000;
const maintenant = Date.now();
const iso = (msDepuisMaintenant) => new Date(maintenant + msDepuisMaintenant).toISOString();
const jour = (msDepuisMaintenant) => iso(msDepuisMaintenant).slice(0, 10);

// ---------------------------------------------------------------- le referentiel de demo

const STATIONS = [
  { cle: 'station/plateau', code: 'DK-PLATEAU', nom: 'TotalEnergies Plateau', ville: 'Dakar' },
  { cle: 'station/rufisque', code: 'DK-RUFISQUE', nom: 'TotalEnergies Rufisque', ville: 'Rufisque' },
];

const CHAUFFEURS = [
  { cle: 'chauffeur/moussa', nom: 'Moussa Ndiaye', msisdn: '+221770000011' },
  { cle: 'chauffeur/fatou', nom: 'Fatou Sarr', msisdn: '+221770000012' },
  { cle: 'chauffeur/ibrahima', nom: 'Ibrahima Diallo', msisdn: '+221770000013' },
];

const POMPISTES = [
  { cle: 'pompiste/awa', nom: 'Awa Ba', msisdn: '+221770000021', station: 'station/plateau' },
  { cle: 'pompiste/omar', nom: 'Omar Kane', msisdn: '+221770000022', station: 'station/rufisque' },
];

/**
 * L'historique servi, etale sur la fenetre d'observation.
 *
 * Reparti sur trente jours pour que la projection de la date de blocage ait un rythme a
 * mesurer : sans historique, elle ne peut rien dire d'autre que « consommation nulle ».
 */
function historiqueConsomme() {
  const lignes = [];
  for (let n = 0; n < 48; n += 1) {
    const chauffeur = CHAUFFEURS[n % CHAUFFEURS.length];
    const station = STATIONS[n % STATIONS.length];
    const ageJours = 29 - Math.floor((n * 29) / 47);
    lignes.push({
      cle: `bon/servi/${n}`,
      chauffeur,
      station,
      montant: 50_000,
      statut: 'CONSOMME',
      emisA: iso(-ageJours * JOUR - 3 * 3_600_000),
      consommeA: iso(-ageJours * JOUR),
      expireA: iso(-ageJours * JOUR + 21 * 3_600_000),
    });
  }
  return lignes;
}

/** Ce qu'un chauffeur voit a l'ecran aujourd'hui, dans les quatre etats possibles. */
const BONS_DU_JOUR = [
  {
    cle: 'bon/vivant/moussa',
    chauffeur: CHAUFFEURS[0],
    station: null,
    montant: 25_000,
    statut: 'EMIS',
    emisA: iso(-2 * 3_600_000),
    expireA: iso(22 * 3_600_000),
  },
  {
    cle: 'bon/vivant/fatou',
    chauffeur: CHAUFFEURS[1],
    station: null,
    montant: 30_000,
    statut: 'EMIS',
    emisA: iso(-40 * 60_000),
    expireA: iso(23 * 3_600_000),
  },
  {
    // Bientot perime : l'ecran doit le dire avant que le chauffeur se deplace pour rien.
    cle: 'bon/bientot-perime/ibrahima',
    chauffeur: CHAUFFEURS[2],
    station: null,
    montant: 15_000,
    statut: 'EMIS',
    emisA: iso(-23 * 3_600_000),
    expireA: iso(50 * 60_000),
  },
  {
    cle: 'bon/perime/moussa',
    chauffeur: CHAUFFEURS[0],
    station: null,
    montant: 20_000,
    statut: 'EMIS',
    emisA: iso(-3 * JOUR),
    expireA: iso(-2 * JOUR),
  },
  {
    cle: 'bon/annule/fatou',
    chauffeur: CHAUFFEURS[1],
    station: null,
    montant: 40_000,
    statut: 'ANNULE',
    emisA: iso(-5 * JOUR),
    expireA: iso(-4 * JOUR),
    motif: 'paiement conteste par le chauffeur',
  },
  {
    cle: 'bon/servi-aujourdhui/ibrahima',
    chauffeur: CHAUFFEURS[2],
    station: STATIONS[0],
    montant: 35_000,
    statut: 'CONSOMME',
    emisA: iso(-5 * 3_600_000),
    consommeA: iso(-90 * 60_000),
    expireA: iso(19 * 3_600_000),
  },
];

const BONS = [...historiqueConsomme(), ...BONS_DU_JOUR];

const client = new pg.Client({ connectionString: url });
await client.connect();

/** Toutes les lignes posees, dans l'ordre inverse des dependances. */
async function effacer({ silencieux = false } = {}) {
  const idsBons = BONS.map((b) => idDe(b.cle));
  const idsPaiements = BONS.map((b) => idDe(`paiement/${b.cle}`));

  const idsStations = STATIONS.map((s) => idDe(s.cle));
  const idsPorteurs = [...CHAUFFEURS, ...POMPISTES].map((p) => idDe(p.cle));

  await client.query('BEGIN');
  // Les sessions ouvertes par ces comptes referencent leur station : sans cette ligne, retirer
  // le jeu de demonstration echoue des qu'un pompiste s'est connecte une fois.
  await client.query(
    'DELETE FROM api_tokens WHERE station_id = ANY($1::uuid[]) OR subject = ANY($2::text[])',
    [idsStations, idsPorteurs],
  );
  // Les sessions de paiement ouvertes par les chauffeurs de demonstration les retiennent :
  // ouvrir un paiement depuis l'ecran chauffeur suffit a en creer une.
  await client.query('DELETE FROM checkout_sessions WHERE driver_id = ANY($1::uuid[])', [
    CHAUFFEURS.map((c) => idDe(c.cle)),
  ]);
  await client.query('DELETE FROM voucher_deliveries WHERE voucher_id = ANY($1::uuid[])', [idsBons]);
  await client.query('DELETE FROM fuel_vouchers WHERE id = ANY($1::uuid[])', [idsBons]);
  await client.query('DELETE FROM driver_payments WHERE id = ANY($1::uuid[])', [idsPaiements]);
  // Une intention de reglement referencant la facture de demonstration l'empeche d'etre
  // retiree. Elle nait des qu'on exerce le cycle sur ce jeu — la retirer d'abord, sinon
  // `effacer` echoue et le rechargement devient impossible.
  await client.query(
    'DELETE FROM payment_intents WHERE invoice_id = $1',
    [idDe('facture/echue')],
  );
  await client.query('DELETE FROM invoices WHERE id = $1', [idDe('facture/echue')]);
  await client.query('DELETE FROM operateurs WHERE id = ANY($1::uuid[])', [
    POMPISTES.map((p) => idDe(p.cle)),
  ]);
  await client.query('DELETE FROM fuel_vouchers WHERE driver_id = ANY($1::uuid[])', [
    CHAUFFEURS.map((c) => idDe(c.cle)),
  ]);
  await client.query('DELETE FROM drivers WHERE id = ANY($1::uuid[])', [
    CHAUFFEURS.map((c) => idDe(c.cle)),
  ]);
  await client.query('DELETE FROM stations WHERE id = ANY($1::uuid[])', [idsStations]);
  await client.query('COMMIT');

  if (!silencieux) console.log('jeu de demonstration retire.');
}

async function charger() {
  // L'entite visee est celle que le serveur sert : le tableau de bord lit `ENTITY_ID`, et des
  // donnees rattachees a une autre entite resteraient invisibles a l'ecran. A defaut, on prend
  // celle qui porte un contrat — une entite sans contrat n'a rien a afficher.
  const vise = argument('entite', process.env.ENTITY_ID) || null;
  const entites = await client.query(
    `SELECT e.id, e.raison_sociale, c.id AS contract_id
       FROM entities e
       JOIN te_contracts c ON c.entity_id = e.id
      WHERE $1::uuid IS NULL OR e.id = $1::uuid
      ORDER BY c.created_at DESC
      LIMIT 1`,
    [vise],
  );
  if (entites.rows.length === 0) {
    console.error(
      vise === null
        ? 'aucune entite avec contrat TotalEnergies : lancez `npm run amorcer` avec `--compte-te`.'
        : `l'entite ${vise} n'existe pas, ou n'a pas de contrat TotalEnergies.`,
    );
    process.exit(1);
  }
  const { id: entityId, contract_id: contractId, raison_sociale: raisonSociale } = entites.rows[0];

  // On repart d'une base propre cote demo : sinon un rechargement apres modification du script
  // laisserait derriere lui des lignes de la version precedente.
  await effacer({ silencieux: true });

  await client.query('BEGIN');

  for (const s of STATIONS) {
    await client.query(
      'INSERT INTO stations (id, code, nom, ville) VALUES ($1, $2, $3, $4)',
      [idDe(s.cle), s.code, s.nom, s.ville],
    );
  }

  for (const c of CHAUFFEURS) {
    await client.query(
      'INSERT INTO drivers (id, entity_id, nom, msisdn) VALUES ($1, $2, $3, $4)',
      [idDe(c.cle), entityId, c.nom, c.msisdn],
    );
  }

  for (const p of POMPISTES) {
    await client.query(
      `INSERT INTO operateurs (id, nom, msisdn, role, station_id)
       VALUES ($1, $2, $3, 'STATION_OPERATOR', $4)`,
      [idDe(p.cle), p.nom, p.msisdn, idDe(p.station)],
    );
  }

  for (const b of BONS) {
    const bonId = idDe(b.cle);
    const paiementId = idDe(`paiement/${b.cle}`);
    const consomme = b.statut === 'CONSOMME';

    await client.query(
      `INSERT INTO driver_payments (id, driver_id, montant_xof, canal, reference, recu_a)
       VALUES ($1, $2, $3, 'WAVE_CHECKOUT', $4, $5)`,
      [paiementId, idDe(b.chauffeur.cle), b.montant, `demo-${paiementId.slice(0, 12)}`, b.emisA],
    );

    await client.query(
      `INSERT INTO fuel_vouchers (id, driver_id, payment_id, montant_xof, statut, emis_a, expire_a,
                                  consomme_a, station_id, operateur_id, redemption_id,
                                  motif_annulation, payment_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        bonId,
        idDe(b.chauffeur.cle),
        paiementId,
        b.montant,
        b.statut,
        b.emisA,
        b.expireA,
        consomme ? b.consommeA : null,
        consomme ? idDe(b.station.cle) : null,
        consomme ? idDe(`pompiste/${b.station.cle === STATIONS[0].cle ? 'awa' : 'omar'}`) : null,
        consomme ? `demo-red-${bonId.slice(0, 12)}` : null,
        b.statut === 'ANNULE' ? b.motif : null,
        `WAVE_CHECKOUT/demo-${paiementId.slice(0, 12)}`,
      ],
    );
  }

  // Un envoi de QR en echec : le chauffeur a paye et n'a rien recu. C'est l'incident que
  // l'administrateur doit voir en premier, parce qu'il est rattrapable.
  await client.query(
    `INSERT INTO voucher_deliveries (id, voucher_id, canal, destinataire, statut, erreur, tentatives)
     VALUES ($1, $2, 'WHATSAPP', $3, 'ECHEC', 'destinataire injoignable', 3)`,
    [idDe('envoi/echec'), idDe('bon/vivant/fatou'), CHAUFFEURS[1].msisdn],
  );

  // Une facture echue et non reglee : sans elle l'encours ne refleterait que la consommation
  // courante, et la jauge resterait basse quoi qu'il arrive.
  await client.query(
    `INSERT INTO invoices (id, contract_id, numero, periode_debut, periode_fin, montant_xof,
                           date_emission, date_echeance, statut)
     VALUES ($1, $2, 'TE-2026-08', $3, $4, 5000000, $5, $6, 'OUVERTE')`,
    [
      idDe('facture/echue'),
      contractId,
      jour(-60 * JOUR),
      jour(-31 * JOUR),
      jour(-30 * JOUR),
      jour(-5 * JOUR),
    ],
  );

  await client.query(
    `INSERT INTO audit_events (actor, action, target_type, target_id, payload_hash)
     VALUES ('demo', 'JEU_DEMO_CHARGE', 'entity', $1, $2)`,
    [entityId, createHash('sha256').update(`${BONS.length} bons`).digest('hex')],
  );

  await client.query('COMMIT');

  console.log(`Jeu de demonstration charge sur « ${raisonSociale} ».`);
  console.log('');
  console.log('  Chauffeurs');
  for (const c of CHAUFFEURS) console.log(`    ${c.msisdn}   ${c.nom}`);
  console.log('  Pompistes');
  for (const p of POMPISTES) {
    const s = STATIONS.find((x) => x.cle === p.station);
    console.log(`    ${p.msisdn}   ${p.nom} — ${s.nom}`);
  }
  const admins = await client.query(
    `SELECT nom, msisdn FROM operateurs WHERE role = 'ADMIN' ORDER BY created_at LIMIT 1`,
  );
  if (admins.rows.length > 0) {
    console.log('  Administrateur');
    console.log(`    ${admins.rows[0].msisdn}   ${admins.rows[0].nom}`);
    if (!MSISDN_ADMIN_ATTENDU.test(admins.rows[0].msisdn)) {
      console.log('    (numero hors plage de test : il a ete cree hors demonstration)');
    }
  }
  console.log('');
  console.log(`  ${BONS.length} bons, dont 3 utilisables tout de suite et 1 bientot perime.`);
}

const actions = { charger, effacer };
const action = actions[process.argv[2] ?? 'charger'];

if (action === undefined) {
  console.error(`commande inconnue. Attendu : charger | effacer`);
  process.exit(1);
}

try {
  await action();
} catch (cause) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
} finally {
  await client.end();
}
