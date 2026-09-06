#!/usr/bin/env node
/**
 * Scan de secrets — à brancher en CI (§11, premier item de la Definition of Done).
 *
 * Deux familles de constats :
 *
 *  1. Une clé Wave en clair dans un fichier versionné.
 *  2. Une variable d'environnement préfixée `VITE_` dont le nom désigne un secret. Vite inline
 *     toute variable `VITE_*` dans le bundle client : une clé qui porte ce préfixe est, par
 *     construction, publiée aux utilisateurs. C'est l'anti-pattern §12 « mets la clé API dans
 *     le front ».
 *
 * Sortie : code 1 si un constat est remonté.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGUMENTS = process.argv.slice(2);
const MAJ_REFERENCE = ARGUMENTS.includes('--maj-reference');
const RACINE = ARGUMENTS.find((a) => !a.startsWith('--')) ?? join(process.cwd(), '..');

const FICHIER_REFERENCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'scan-secrets.reference.json',
);

const DOSSIERS_IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.devv']);

/** Fixtures de test : les valeurs y sont factices et le scanner ne doit pas crier au loup. */
const CHEMINS_EXEMPTES = [join('server', 'test'), join('server', 'scripts')];

const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.env', '.example',
  '.yml', '.yaml', '.md', '.txt', '.sh', '.ps1', '',
]);

const REGLES = [
  {
    code: 'WAVE_KEY_EN_CLAIR',
    gravite: 'BLOQUANT',
    motif: /wave_(sn|ci|ml|bf|sl|ug)_(prod|test|sandbox)_[A-Za-z0-9]{6,}/,
    explication: 'clé API Wave en clair dans un fichier versionné',
  },
  {
    code: 'SECRET_EXPOSE_AU_BUNDLE',
    gravite: 'BLOQUANT',
    motif: /\bVITE_[A-Z0-9_]*(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE|SIGNATURE|CREDENTIAL)[A-Z0-9_]*\b/,
    explication:
      'variable VITE_* désignant un secret : Vite l’inline dans le bundle client, donc elle est publiée',
    // Cette règle porte sur un NOM, pas sur une valeur. La documentation doit pouvoir nommer ce
    // qu'elle interdit, et un nom mis en commentaire dans un .env n'est plus une définition.
    // Les règles portant sur des valeurs, elles, s'appliquent partout sans exception.
    ignoreDocumentation: true,
    ignoreLignesCommentees: true,
  },
  {
    code: 'BEARER_EN_DUR',
    gravite: 'BLOQUANT',
    motif: /Bearer\s+(?!\$\{|"\s*\+|`)[A-Za-z0-9_\-.]{20,}/,
    explication: 'jeton porteur écrit en dur',
  },
  {
    code: 'SECRET_DE_REPLI_EN_DUR',
    gravite: 'BLOQUANT',
    motif: /['"`][A-Za-z0-9]*(dev|default|fallback|insecure|test|change)[-_][A-Za-z0-9_-]*secret[A-Za-z0-9_-]*['"`]/i,
    explication:
      'secret de repli codé en dur : il devient le secret réel dès que la variable est absente',
  },
];

function* fichiers(dossier) {
  for (const entree of readdirSync(dossier)) {
    if (DOSSIERS_IGNORES.has(entree)) continue;
    const chemin = join(dossier, entree);
    let info;
    try {
      info = statSync(chemin);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      yield* fichiers(chemin);
    } else if (EXTENSIONS.has(extname(entree)) || entree.startsWith('.env')) {
      yield chemin;
    }
  }
}

function estExempte(cheminRelatif) {
  return CHEMINS_EXEMPTES.some((p) => cheminRelatif.startsWith(p + sep) || cheminRelatif === p);
}

function estDocumentation(cheminRelatif) {
  return extname(cheminRelatif) === '.md';
}

function estLigneCommentee(ligne, cheminRelatif) {
  const base = cheminRelatif.split(sep).pop() ?? '';
  if (base.startsWith('.env')) return /^\s*#/.test(ligne);
  return false;
}

const constats = [];

for (const chemin of fichiers(RACINE)) {
  const cheminRelatif = relative(RACINE, chemin);
  if (estExempte(cheminRelatif)) continue;

  let contenu;
  try {
    contenu = readFileSync(chemin, 'utf8');
  } catch {
    continue;
  }

  contenu.split(/\r?\n/).forEach((ligne, index) => {
    for (const regle of REGLES) {
      if (regle.ignoreDocumentation && estDocumentation(cheminRelatif)) continue;
      if (regle.ignoreLignesCommentees && estLigneCommentee(ligne, cheminRelatif)) continue;
      const trouve = regle.motif.exec(ligne);
      if (trouve) {
        constats.push({
          // Séparateurs normalisés : la référence figée doit être identique sous Windows et
          // sous Linux, sinon la CI ne reconnaît aucun constat connu.
          fichier: cheminRelatif.split(sep).join('/'),
          ligne: index + 1,
          code: regle.code,
          gravite: regle.gravite,
          explication: regle.explication,
          // On ne réimprime jamais la valeur : seul le nom du motif est affiché.
          extrait: trouve[0].slice(0, 24).replace(/[A-Za-z0-9]{6,}$/, '…'),
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Référence figée
//
// Les constats déjà connus et documentés (server/docs/SECRETS.md) ne font pas
// échouer le build : un garde-fou rouge en permanence finit par être ignoré.
// Tout constat NOUVEAU — fichier inconnu, ou occurrence supplémentaire dans un
// fichier connu — fait échouer.
//
// `--maj-reference` régénère la référence. À n'utiliser qu'après avoir RÉDUIT
// la dette, jamais pour l'absorber.
// ---------------------------------------------------------------------------

const cle = (c) => `${c.fichier}|${c.code}`;

const compteActuel = {};
for (const c of constats) {
  compteActuel[cle(c)] = (compteActuel[cle(c)] ?? 0) + 1;
}

if (MAJ_REFERENCE) {
  writeFileSync(FICHIER_REFERENCE, `${JSON.stringify(compteActuel, null, 2)}\n`, 'utf8');
  console.log(`référence mise à jour : ${Object.keys(compteActuel).length} entrée(s).`);
  process.exit(0);
}

const reference = existsSync(FICHIER_REFERENCE)
  ? JSON.parse(readFileSync(FICHIER_REFERENCE, 'utf8'))
  : {};

const restant = { ...reference };
const nouveaux = [];
for (const c of constats) {
  const k = cle(c);
  if ((restant[k] ?? 0) > 0) {
    restant[k] -= 1;
  } else {
    nouveaux.push(c);
  }
}

const connus = constats.length - nouveaux.length;
const resolus = Object.values(restant).reduce((a, b) => a + b, 0);

if (nouveaux.length === 0) {
  const details = [];
  if (connus > 0) details.push(`${connus} constat(s) connu(s), documenté(s) dans server/docs/SECRETS.md`);
  if (resolus > 0) {
    details.push(`${resolus} constat(s) de la référence ont disparu — penser à « npm run scan:secrets -- --maj-reference »`);
  }
  console.log(
    details.length === 0
      ? 'scan de secrets : aucun constat.'
      : `scan de secrets : aucun constat nouveau. ${details.join(' ; ')}.`,
  );
  process.exit(0);
}

console.error(`scan de secrets : ${nouveaux.length} constat(s) NOUVEAU(X).\n`);
for (const c of nouveaux) {
  console.error(`  [${c.gravite}] ${c.code}  ${c.fichier}:${c.ligne}`);
  console.error(`             ${c.explication}`);
  console.error(`             motif : ${c.extrait}`);
}
if (connus > 0) {
  console.error(`\n(${connus} constat(s) connu(s) par ailleurs, hors de ce décompte.)`);
}
console.error('\nAucun secret ne doit atteindre le repo ni le bundle client (§9, §12).');
process.exit(1);
