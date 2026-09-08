# Tests Assur'Trans

Trois suites, trois choses différentes prouvées. Aucune ne remplace les autres.

| Suite | Ce qu'elle prouve | Ce qu'elle ne peut pas prouver |
|---|---|---|
| Serveur — 274 tests | le domaine, les cas d'usage, les routes HTTP | que le SQL s'exécute |
| Intégration — 40 tests | que les contraintes des migrations tiennent | ce que l'utilisateur voit |
| Interface — 64 tests | ce qu'un écran affiche et ce qu'il transmet | le comportement du vrai serveur |

## Serveur

```bash
cd server
npm test
npm run typecheck
npm run scan:secrets
```

Le scan de secrets travaille sur une référence figée, aujourd'hui vide : tout nouveau constat
fait échouer la construction.

## Intégration PostgreSQL

Elles exécutent le SQL contre une vraie base — la seule vérification qui prouve quelque chose
pour du SQL. Une doublure accepte volontiers une colonne qui n'existe pas.

```bash
cd server
npm run db:local     # laisser tourner ; imprime les deux URL
npm run migrate -- <DATABASE_URL_TEST>
DATABASE_URL_TEST=... npm run test:integration
```

La suite tourne sur `assurtrans_test`, jamais sur la base de développement : son `beforeEach`
vide tout le référentiel.

Sans `DATABASE_URL_TEST`, la suite est **ignorée** plutôt qu'en échec. Attention à ne pas
confondre « 40 tests ignorés » avec « 40 tests passés » — la ligne de résumé de vitest distingue
`skipped` de `passed`.

## Interface

```bash
cd web
npm test
```

Ils traversent le vrai client d'API ; seul `fetch` est remplacé. La traduction des codes de refus
en phrases lisibles est donc exercée pour de bon, et le serveur factice enregistre ce qu'on lui
envoie : on vérifie non seulement ce qu'un écran affiche, mais ce qu'il transmet.

## Ce qu'aucune suite ne couvre

Le scénario manuel qui reste à faire à la main, parce qu'il porte sur le réseau réel :

1. Ouvrir une session chauffeur, afficher un bon.
2. Couper le réseau. Le dernier bon connu doit rester affiché.
3. Ouvrir l'écran pompiste sans réseau. Il doit lire « ne pas servir » — seul le serveur sait si
   un bon a déjà été consommé, et un feu vert hors ligne ne voudrait rien dire.

## Tout, d'un coup

```bash
npm test              # serveur puis interface, depuis la racine
npm run typecheck
npm run scan:secrets
```

La CI exécute les trois suites. Elle provisionne un PostgreSQL 16 en service pour la troisième,
applique les migrations, puis vérifie que la suite n'a pas été **ignorée** : sans
`DATABASE_URL_TEST` elle le serait silencieusement, et le vert ne prouverait rien.

Ce qu'elle ne fait toujours pas : mesurer la couverture, et jouer les scénarios de concurrence
sur plusieurs processus. Les écritures conditionnelles sont vérifiées séquentiellement, ce qui
prouve la contrainte en base mais pas la course elle-même.
