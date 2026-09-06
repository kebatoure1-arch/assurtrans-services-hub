# Gestion des secrets

## Le constat de départ

Le front est une application React servie par Vite. Vite **inline toute variable `VITE_*`** dans
le JavaScript envoyé au navigateur. Une clé placée dans une variable `VITE_*` n'est pas
« configurée » : elle est **publiée**.

L'audit initial a relevé **22 constats bloquants** : 13 variables de secret dans `.env.example`
et 9 lectures effectives dans le code du front. Après nettoyage de `.env.example` puis retrait de
l'héritage OLA ENERGY, il en reste **6**.

Nuance importante, et bonne nouvelle : **aucune de ces variables n'était renseignée**. Les
services concernés tournaient en mode simulation. Rien n'a fuité. Le risque était que
`.env.example` demandait explicitement de remplir ces cases — la fuite était programmée, pas
encore réalisée.

Une exception, elle bien active : `src/lib/qr-crypto.ts` embarque un secret de repli codé en dur
(`dev-insecure-secret-…`) utilisé dès que la variable est absente. En développement, tout QR
carburant est donc forgeable. En production le code lève une exception plutôt que d'utiliser le
repli — mais l'existence même de ce repli est le genre de chose qui survit à un refactor.

## Le modèle retenu

```
Navigateur (bundle public)          Serveur (processus privé)         Coffre
┌───────────────────────┐          ┌────────────────────────┐    ┌──────────┐
│ VITE_* : configuration│  HTTPS   │ Secret (non loggable)  │◄───│ KMS/Vault│
│ publique uniquement   │─────────►│ EnvSecretProvider      │    └──────────┘
│ aucune clé, aucun     │          │ refuse tout nom VITE_* │
│ secret, aucun jeton   │◄─────────│ loadConfig() fail-fast │
└───────────────────────┘          └────────────────────────┘
```

Quatre mécanismes, du plus fort au plus faible :

1. **`Secret`** (`src/infra/secrets/secrets.ts`) — la valeur est portée par un champ privé de
   classe. Interpolation, `JSON.stringify`, `console.log`, inspection Node : tout rend
   `[REDACTED:NOM]`. La valeur ne sort que par `expose()`, appelé à **un seul endroit** du
   système : la construction de l'en-tête `Authorization` dans `WaveClient.headers()`.
2. **`EnvSecretProvider`** — refuse tout nom préfixé `VITE_`, y compris quand c'est la seule
   variable disponible. Pas de repli silencieux.
3. **`loadConfig()`** — un secret manquant, un plafond absent ou un canal mal configuré empêchent
   le démarrage. Échouer au boot, pas au premier paiement.
4. **`redact()`** — filet de sécurité pour les traces et messages d'erreur produits par des
   bibliothèques tierces, qui ne connaissent pas `Secret`.

Vérifié par 25 tests (`test/secrets.spec.ts`, `test/config.spec.ts`), dont : la clé n'apparaît ni
dans une interpolation, ni dans un `JSON.stringify` de la configuration complète, ni dans un
`console.log`, ni dans le message d'une erreur de secret manquant.

## Table de correspondance

| Ancien nom (bundle client) | Nouveau nom (serveur) | Statut | Ce qui doit bouger dans le front |
|---|---|---|---|
| `VITE_WAVE_API_KEY` | `WAVE_API_KEY` | ✅ fait | jamais utilisé par le front — rien à faire |
| `VITE_WAVE_API_SECRET` | — | ✅ retiré | Wave n'utilise pas de secret pair |
| `VITE_QR_SIGNATURE_SECRET` | `QR_SIGNATURE_SECRET` | ⬜ à migrer | `src/lib/qr-crypto.ts` → signature et vérification côté serveur |
| `VITE_TPE_API_KEY` | — | ✅ supprimé | intégration OLA ENERGY retirée le 2026-09-06 |
| `VITE_TPE_API_SECRET` | — | ✅ supprimé | idem |
| `VITE_TPE_MERCHANT_ID` | — | ✅ supprimé | idem |
| `VITE_TPE_WEBHOOK_SECRET` | — | ✅ supprimé | `tpe-webhook-handler.ts` supprimé |
| `VITE_RESEND_API_KEY` | `RESEND_API_KEY` | ⬜ à migrer | `src/services/email-receipt-service.ts` |
| `VITE_TWILIO_ACCOUNT_SID` | `TWILIO_ACCOUNT_SID` | ⬜ à migrer | `src/services/sms-notification-service.ts` |
| `VITE_TWILIO_AUTH_TOKEN` | `TWILIO_AUTH_TOKEN` | ⬜ à migrer | idem |
| `VITE_AFRICAS_TALKING_API_KEY` | `AFRICAS_TALKING_API_KEY` | ⬜ à migrer | idem |
| `VITE_ORANGE_MONEY_*` | — | ⬜ à décider | dépend du sort du wallet client (ADR-001) |
| `VITE_FREE_MONEY_*` | — | ⬜ à décider | idem |

## Ordre de migration

Par gravité décroissante, pas par facilité.

### 1. Signature des QR codes — le plus urgent

C'est le seul secret dont un repli codé en dur est **actif** aujourd'hui, et c'est celui qui
protège la valeur : un QR carburant forgé, c'est du carburant délivré sans contrepartie.

Un secret de signature dans le bundle ne signe rien. Tant que la vérification est côté client,
un attaquant peut aussi bien contourner la vérification que forger la signature — la migration
doit donc déplacer **la vérification**, pas seulement la génération.

À faire : deux routes serveur (`POST /qr/sign`, `POST /qr/verify`), `qr-crypto.ts` devient un
client HTTP, suppression du repli `dev-insecure-secret-…`.

### 2. Resend, Twilio, Africa's Talking

Impact financier (envoi à volonté aux frais de l'entité) plutôt que fraude directe.

### 3. Orange Money / Free Money

À trancher avec le sort du wallet client — voir la section « Constat sur l'existant » de
l'ADR-001. Si le wallet disparaît, ces clés disparaissent avec.

## Ce qui n'a pas été fait, et pourquoi

Les fonctions du front qui lisent ces variables **n'ont pas été supprimées**. Les retirer
aujourd'hui casserait le paiement TPE, la signature des QR et l'envoi de SMS sans rien
remplacer — les routes serveur correspondantes n'existent pas encore.

Ce qui a été fait est le préalable : les noms de variables ont disparu de `.env.example`, donc
**plus personne ne peut renseigner un secret au mauvais endroit**, et le scan CI échoue si
quelqu'un les réintroduit. Le code lit désormais des variables qui n'existeront jamais : les
services restent en mode simulation jusqu'à leur migration, ce qui est le comportement sûr.

## Rotation

Voir `RUNBOOK.md` §1. `CachingSecretProvider.invalidate(nom)` permet une rotation sans
redémarrage lorsque le fournisseur va chercher la valeur au coffre à chaud.

## Contrôle continu

```bash
cd server && npm run scan:secrets
```

Le scan est exécuté en CI sur chaque poussée (`.github/workflows/ci.yml`) et échoue le build.
Il détecte : les clés Wave en clair, les variables `VITE_*` désignant un secret, les jetons
porteurs codés en dur et les secrets de repli codés en dur.

Le dépôt n'est pas encore sous git (`git init` n'a pas été fait). Le `.gitignore` est en place
pour le jour où il le sera : aucun `.env` ne doit y entrer.
