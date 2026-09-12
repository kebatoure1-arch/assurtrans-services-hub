# Assur'Trans

Assur'Trans gere l'emission et la consommation de bons carburant pour chauffeurs et stations.
Le depot contient un frontend autonome et une API serveur separee.

## Structure

- `web/` : application React/Vite destinée aux chauffeurs, aux pompistes et à l'administration.
  Autonome, sans dépendance à un fournisseur d'identité tiers, sans secret dans le bundle.
- `server/` : API Fastify/PostgreSQL, authentification par téléphone, paiements et bons.
- `server/migrations/` : schéma PostgreSQL versionné.
- `server/scripts/` : base locale sans Docker, migrations, amorçage, jeu de démonstration.

La racine ne contient plus que l'aiguillage de scripts : `web/` et `server/` portent chacun
leurs dépendances et leur lockfile, comme la CI les installe.

## Démarrage local

```powershell
cd server
npm install
npm run db:local          # PostgreSQL local, sans Docker ; laisser tourner
```

Dans un autre terminal, migrations puis amorçage — une base neuve n'a aucun administrateur, et
en créer un passe par l'API, qui en exige déjà un :

```powershell
cd server
npm run migrate -- <DATABASE_URL>
npm run amorcer -- --entite "..." --admin "..." --telephone 77XXXXXXX --compte-te "TE-..."
npm run jeu-demo -- charger    # facultatif : de quoi parcourir les écrans
npm run build; npm start
```

Puis le front :

```powershell
cd web
npm install
npm run dev               # http://localhost:5174
```

Le frontend utilise `ASSURTRANS_API` pour l'adresse publique de l'API (défaut
`http://localhost:3001`). Copiez `.env.example` vers `web/.env.local` pour l'ajuster. Les secrets
serveur sont documentés dans `server/.env.example` et ne doivent jamais être ajoutés au dépôt.

Le détail — encodage de la base, séparation base de développement / base de test, garde-fous du
jeu de démonstration — est dans [server/README.md](server/README.md).

## Sécurité et limites

- Les OTP sont envoyés par Africa's Talking lorsque `OTP_SMS_PROVIDER=AFRICAS_TALKING`.
- `LOG` et `OTP_ECHO=true` sont réservés aux démonstrations locales.
- Le dernier bon utilisable peut être affiché hors ligne par le chauffeur ; la validation en
  station et les paiements nécessitent toujours l'API.
- L'administration tient le référentiel (chauffeurs, stations, opérateurs) et le pilotage de
  l'encours. Le règlement de TotalEnergies reste en `DRY_RUN` : aucun mouvement d'argent réel
  ne part tant que les paramètres du §14 ne sont pas obtenus.

## CI

Trois tâches, en parallèle :

| Tâche | Contenu |
|---|---|
| Module de règlement | scan de secrets, typecheck, tests unitaires — domaine, cas d'usage, routes HTTP |
| Contraintes de la base | PostgreSQL 16 en service, migrations, tests d'intégration — les contraintes tiennent |
| Frontend autonome | typecheck, tests d'interface — ce qu'un écran affiche et ce qu'il transmet, build |

Le scan de secrets passe en premier — un secret exposé rend le reste sans objet.

La tâche d'intégration vérifie aussi que la suite **a réellement tourné**. Sans
`DATABASE_URL_TEST`, les tests sont ignorés plutôt qu'en échec — pour qu'un poste sans base ne
voie pas rouge. En CI, une suite ignorée passerait pour verte sans rien prouver : la tâche
échoue si elle voit `skipped`.

Voir [server/README.md](server/README.md) pour le runbook opérationnel.
