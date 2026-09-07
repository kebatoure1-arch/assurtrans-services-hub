# Assur'Trans

Assur'Trans gere l'emission et la consommation de bons carburant pour chauffeurs et stations.
Le depot contient un frontend autonome et une API serveur separee.

## Structure

- `web/` : application React/Vite destinée aux chauffeurs et pompistes.
- `server/` : API Fastify/PostgreSQL, authentification par téléphone, paiements et bons.
- `server/migrations/` : schéma PostgreSQL versionné.

## Démarrage local

```powershell
cd server
npm install
npm run typecheck
npm test

cd ../web
npm install
npm run dev
```

Le frontend utilise `ASSURTRANS_API` pour l'adresse publique de l'API. Copiez `.env.example`
vers `web/.env.local` et adaptez cette valeur si nécessaire. Les secrets serveur sont documentés
dans `server/.env.example` et ne doivent jamais être ajoutés au dépôt.

## Sécurité et limites

- Les OTP sont envoyés par Africa's Talking lorsque `OTP_SMS_PROVIDER=AFRICAS_TALKING`.
- `LOG` et `OTP_ECHO=true` sont réservés aux démonstrations locales.
- Le dernier bon utilisable peut être affiché hors ligne par le chauffeur ; la validation en
  station et les paiements nécessitent toujours l'API.
- L'écran administrateur est volontairement un écran d'attente sans actions fictives.

## CI

La CI exécute le scan de secrets, le typecheck et les tests du serveur, ainsi que le build du
frontend. Voir [server/README.md](server/README.md) pour le runbook opérationnel.
