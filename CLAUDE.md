# CLAUDE.md

Guide de travail pour Claude Code sur ce dépôt. Complète les README, ne les remplace pas :
`README.md` (démarrage), `README_TESTING.md` (les trois suites), `server/README.md` (runbook et
périmètre), `server/docs/ADR-00{1,2,3}` (décisions).

## Ce qu'est le produit

Assur'Trans orchestre le règlement d'une carte carburant **TotalEnergies post-payée** depuis un
portefeuille **Wave Business**. Les chauffeurs paient Assur'Trans et reçoivent un **bon carburant
à usage unique** (QR signé) qu'un pompiste consomme en station. Marchés : Sénégal (+221) et
Côte d'Ivoire (+225). Montants en **XOF entier**.

Le cadre réglementaire n'est pas décoratif : l'instruction BCEAO n°008-05-2015 sur la monnaie
électronique fixe ce que le système a le droit de faire. Le bon à usage unique plutôt que le
solde rechargeable est précisément ce qui évite l'agrément EME/PSP (ADR-003). **Toute
fonctionnalité qui ferait détenir à Assur'Trans un solde appartenant à un chauffeur est hors
périmètre** — pas « à faire plus tard » : interdite par construction.

## Commandes

```bash
npm test                    # racine : serveur puis interface
npm run typecheck
npm run scan:secrets        # échoue si un nouveau constat apparaît

cd server
npm run db:local            # PostgreSQL portable, sans Docker ; laisser tourner
npm run migrate -- <DATABASE_URL>
npm run amorcer -- --entite "..." --admin "..." --telephone 77XXXXXXX --compte-te "TE-..."
npm run jeu-demo -- charger
npm run build && npm start
DATABASE_URL_TEST=... npm run test:integration

cd web && npm run dev       # http://localhost:5174
```

`node_modules/` n'est pas présent sur un dépôt fraîchement cloné : `npm ci` dans `server/` et
`web/` séparément. Chaque module porte ses dépendances et son lockfile ; la racine n'est qu'un
aiguillage de scripts.

## Architecture — la règle de dépendance

Hexagonale, strictement. Le sens des flèches est vérifié par un test
(`settlement-channel.spec.ts`), pas seulement par convention.

```
domain/       logique métier pure, ZÉRO I/O, n'importe rien de infra/
application/  cas d'usage, ne connaissent que des ports/
ports/        interfaces
infra/        adaptateurs concrets (pg, wave, sms, crypto)
main.ts       LE SEUL endroit où le concret rencontre le métier
```

Corollaires à respecter :
- `domain/` ne connaît aucun endpoint, aucune table, aucun `fetch`.
- Ajouter un canal d'envoi = écrire un `ExpediteurDeBon` de plus, sans toucher au worker.
- `src/infra/db/pg-pool.ts` est le seul fichier qui connaît `node-postgres`.

## Conventions de code

- **TypeScript strict**, ESM. `allowImportingTsExtensions` : les imports relatifs portent
  l'extension `.ts` (`from './money.ts'`). `verbatimModuleSyntax` : `import type` explicite.
- **Nommage mixte, assumé.** Le vocabulaire métier est en français (`cycle-reglement`,
  `rapprocher`, `envoyer-les-bons`, `verrou`), les concepts techniques partagés restent en
  anglais (`repositories`, `payment-intent`, `fuel-voucher`). Suis le voisinage du fichier que tu
  modifies ; ne renomme pas pour uniformiser.
- **Commentaires** : le dépôt explique *pourquoi*, jamais *quoi*. Garde ce registre. Un
  commentaire qui paraphrase la ligne suivante n'a pas sa place ici.
- **Monnaie** : `XOF` entier via `domain/money.ts`. Jamais de flottant, jamais de centime. Les
  `BIGINT` se lisent en entier, un décimal est refusé plutôt qu'arrondi.
- Couverture imposée à **100 %** sur `src/domain/**` (branches 90 %).

## Invariants à ne jamais casser

Chacun est adossé à un test. Les toucher demande une décision explicite, pas un refactor.

| Invariant | Pourquoi |
|---|---|
| L'acteur, la station, le chauffeur viennent **du jeton, jamais du corps** de la requête | sinon la séparation des rôles se contourne en envoyant le nom d'un collègue |
| Le montant d'un règlement vient **de la facture**, jamais du corps | une interface qui propose son montant décide de ce qu'on paie |
| Le montant d'un bon vient **de la session enregistrée**, jamais du webhook | un événement au montant divergent n'émet aucun bon (422) |
| Un préparateur **n'approuve pas** sa propre intention | §9 ; doublé en base (`pi_separation_des_roles`) et dans le domaine |
| **Aucun réessai d'un mouvement d'argent** | timeout / 5xx / 2xx inexploitable ⇒ `AMBIGUOUS` ⇒ `NEEDS_REVIEW` ⇒ humain. Seuls les `GET` sont réessayables |
| La reprise **interroge, ne réémet jamais** | sans identifiant de payout, l'intention part en revue humaine |
| Un bon ne se consomme **qu'une fois** ; rejouer un scan ne sert pas deux fois | `UPDATE ... WHERE statut = $attendu` |
| Un bon invisible pour le demandeur rend **404, pas 403** | on ne confirme pas son existence |
| Le journal d'audit stocke **l'empreinte SHA-256** du payload, jamais le payload | règle append-only de la migration 0001 |
| Le jeton signé du QR **n'est jamais écrit** dans la table d'envois | il se reconstruit, ne se relit pas |

## Secrets

Doctrine stricte, issue d'un audit qui avait relevé 22 constats bloquants — aujourd'hui **zéro**,
et la référence figée du scan est vide : **tout nouveau constat casse le build**.

- Aucun secret dans `web/`. Vite inline toute variable exposée ; `vite.config.ts` n'autorise que
  le préfixe `ASSURTRANS_`, et `ASSURTRANS_API` est une adresse publique.
- Côté serveur, une valeur sensible est portée par `Secret` (`infra/secrets/`) : non
  interpolable, non sérialisable, non journalisable. `EnvSecretProvider` refuse tout nom préfixé
  `VITE_`, sans repli.
- `loadConfig()` **échoue au démarrage**, pas au premier paiement. N'ajoute jamais de valeur de
  repli pour une donnée sensible ou monétaire.
- Seuls les `.env.example` sont versionnés, sans valeurs.

## Tests — trois suites, trois choses prouvées

| Suite | Emplacement | Prouve | Ne prouve pas |
|---|---|---|---|
| Serveur | `server/test/*.spec.ts` | domaine, cas d'usage, routes HTTP | que le SQL s'exécute |
| Intégration | `server/test/integration/` | que les contraintes des migrations tiennent | ce que l'utilisateur voit |
| Interface | `web/test/` | ce qu'un écran affiche **et ce qu'il transmet** | le comportement du vrai serveur |

**Le piège à connaître** : sans `DATABASE_URL_TEST`, la suite d'intégration est *ignorée*, pas en
échec. « 116 tests ignorés » n'est pas « 116 tests passés ». La CI échoue explicitement si elle
voit `skipped` — ne retire pas ce garde-fou.

Les tests d'interface traversent le vrai client d'API ; seul `fetch` est remplacé.

## État du système

Le canal de règlement est en **`DRY_RUN`** et y reste tant que les paramètres **1, 2, 3 et 5 du
§14** (`server/README.md`) ne sont pas obtenus de TotalEnergies et de la direction. Aucun
mouvement d'argent réel ne part.

Deux de ces quatre sont tenus par le code, pas par la discipline : `loadConfig()` refuse tout
canal autre que `DRY_RUN` sans `WAVE_PAYOUT_REFERENCE_FIELD` (paramètre 2), et la contrainte
`CHECK` de la migration 0001 exige `te_b2b_id` ou `te_msisdn` selon le canal (paramètre 1).

Ce que le système ne fait **pas**, et ne doit pas se voir ajouter par confort :
- pas de solde rechargeable (cf. supra) ;
- pas de paiement d'un code marchand — aucun endpoint Wave ne le permet (ADR-002) ;
- pas de lecture du solde ni du relevé : `fetchBalance()` / `fetchStatement()` lèvent
  `EndpointContractUnknownError` plutôt que de deviner une URL. Le relevé se saisit à la main ;
- aucune API TotalEnergies — **ne fournis pas de connecteur simulé**, il donnerait l'illusion
  d'une intégration inexistante.

## Points d'attention connus

- **N'écris aucun nombre de tests dans un document.** Les README en annonçaient quatre jeux
  (274/40/64/124) contre un comptage réel de 358 unitaires, 116 d'intégration et 122 d'interface ;
  ils ont été retirés plutôt que corrigés, un compteur en dur redevenant faux au commit suivant.
  Le chiffre d'interface illustre le piège : 116 déclarations `it(`, mais deux `it.each` portant
  5 et 3 cas, donc 122 tests exécutés. Décris ce qu'une suite prouve, pas combien elle en compte.
- **Le scan de secrets ne voit pas les variables orphelines.** Il travaille sur une référence
  figée et cherche des valeurs, pas des noms déclarés puis jamais lus. `RESEND_API_KEY`,
  `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` avaient survécu ainsi dans `.env.example` ; elles
  sont retirées. Avant d'ajouter une variable, vérifie qu'elle est réellement lue — un exemple
  qui invite à renseigner un secret sans emplacement réel est exactement ce que l'audit a traité.
- **Les préfixes mobiles se périment.** La liste vit à deux endroits, `src/domain/otp.ts` et
  `scripts/msisdn.mjs` (les scripts tournent avant toute compilation) ; `test/msisdn.spec.ts`
  prouve qu'ils restent d'accord. Modifier l'un sans l'autre casse la suite — c'est voulu.
- **Migrations** : versionnées et jamais réécrites. Un écart schéma/code se corrige par une
  nouvelle migration (cf. `0005_corrections_schema.sql`).
- **Ordre CI** : le scan de secrets passe **avant** les tests. Un secret exposé rend le reste sans
  objet — ne réordonne pas les étapes.

## Compétences

Ce dépôt n'embarque aucune compétence : `.claude/` ne contient que `launch.json`. Les compétences
*OSP Marketing Tools* (rédaction technique, relecture éditoriale, metadata web, value map, SEO)
ont été portées depuis leur serveur MCP amont puis installées en portée utilisateur
(`~/.claude/skills/`) — leur objet n'a aucun rapport avec ce code, et une compétence chargée à
chaque session coûte du contexte à toutes les autres. Source pour les regénérer :
<https://github.com/open-strategy-partners/osp_marketing_tools>.

Si une compétence devait être versionnée ici, elle porterait sur ce qui est spécifique à
Assur'Trans et coûteux à redécouvrir : écrire une migration conforme, ajouter un adaptateur dans
`infra/` sans inverser le sens des dépendances, parcourir le mode `DRY_RUN` du règlement.
