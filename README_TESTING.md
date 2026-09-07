# Tests Assur'Trans

## Serveur

```powershell
cd server
npm test
npm run typecheck
```

La suite couvre l'OTP par téléphone, les bons, les signatures QR, les paiements, les webhooks et
les repositories PostgreSQL. Les tests d'intégration PostgreSQL sont ignorés si leur environnement
n'est pas disponible.

## Frontend

```powershell
cd web
npm run build
```

Le scénario manuel minimal est : demander un code, ouvrir une session chauffeur, afficher un bon,
couper le réseau et vérifier que seul le dernier bon connu est affiché. Le pompiste doit toujours
refuser de valider un bon sans réseau.
