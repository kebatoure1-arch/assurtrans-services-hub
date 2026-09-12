# CLAUDE.md

Consignes de travail pour Claude Code sur ce dépôt. À tenir à jour à chaque
session : ce fichier est chargé automatiquement au démarrage.

## Le produit

Assur'Trans : émission et consommation de bons carburant pour chauffeurs et
stations (Sénégal, Côte d'Ivoire). Le module de règlement orchestre une carte
carburant post-payée TotalEnergies depuis un portefeuille Wave Business.

**Le règlement est en `DRY_RUN`.** Aucun mouvement d'argent réel ne part tant
que les paramètres du §14 ne sont pas obtenus. Ne pas lever ce garde-fou, ni
écrire de code qui le contourne, sans instruction explicite.

## Architecture

Deux paquets autonomes, chacun avec ses dépendances et son lockfile — la racine
n'est qu'un aiguillage de scripts npm.

- `server/` — API Fastify 5 + PostgreSQL (`pg`), TypeScript, validation Zod,
  tests Vitest. Découpage `domain/` · `application/` · `ports/` · `infra/` ·
  `http/` : la logique métier ne connaît ni Fastify ni `pg`, les adaptateurs
  vivent dans `infra/`. Respecter ce sens de dépendance.
- `server/migrations/` — schéma PostgreSQL versionné. Toute évolution de schéma
  passe par une migration, jamais par un `ALTER` manuel.
- `web/` — front React 18 + Vite + React Router, autonome. **Aucun secret dans
  le bundle**, aucune dépendance à un fournisseur d'identité tiers.

## Commandes

Depuis la racine : `npm test`, `npm run typecheck`, `npm run scan:secrets`,
`npm run test:integration`.

Base locale sans Docker : `npm --prefix server run db:local` (laisser tourner),
puis `npm --prefix server run migrate -- <DATABASE_URL>`. Une base neuve n'a
aucun administrateur — `npm --prefix server run amorcer` en crée un.

Front : `npm --prefix web run dev` (http://localhost:5174). L'adresse de l'API
vient de `ASSURTRANS_API` (défaut `http://localhost:3001`).

## Avant de pousser

1. `npm run scan:secrets` — passe en premier en CI : un secret exposé rend le
   reste sans objet.
2. `npm run typecheck`
3. `npm test`
4. `npm run test:integration` si une base de test est disponible.

Piège connu : sans `DATABASE_URL_TEST`, les tests d'intégration sont **ignorés**
plutôt qu'en échec, pour qu'un poste sans base ne voie pas rouge. En CI, une
suite ignorée échoue — ne pas conclure au vert local sans avoir vérifié qu'elle
a réellement tourné.

## Conventions

- Messages de commit en français, à l'indicatif, décrivant l'effet obtenu et non
  le fichier touché (voir `git log`).
- Secrets serveur documentés dans `server/.env.example`, jamais dans le dépôt.
- `LOG` et `OTP_ECHO=true` sont réservés aux démonstrations locales.

## Compétences

Ce dépôt n'embarque **aucune compétence** (`.claude/skills/` n'existe pas). Les
compétences *OSP Marketing Tools* ont été portées ici puis déplacées en portée
utilisateur (`~/.claude/skills/`), leur objet — contenu marketing, SEO,
positionnement — n'ayant aucun rapport avec ce code.

Si une compétence devait un jour être ajoutée au dépôt, elle devrait porter sur
ce qui est spécifique à Assur'Trans et coûteux à redécouvrir : écriture d'une
migration PostgreSQL conforme, ajout d'un adaptateur dans `infra/` sans casser
le sens des dépendances, ou parcours du mode `DRY_RUN` du règlement.

## Journal

- 2026-09-12 — Portage des OSP Marketing Tools (serveur MCP amont) en
  compétences natives, puis sortie du dépôt vers la portée utilisateur. Reste
  extractible de l'historique : `git archive 0814965 .claude/skills`.
  Création de ce fichier.
