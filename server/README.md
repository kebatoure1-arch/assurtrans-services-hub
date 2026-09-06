# Module de règlement carburant post-payé

Orchestration du règlement des factures **TotalEnergies Sénégal** (carte carburant post-payée)
depuis un portefeuille **Wave Business** détenu par l'entité.

État : **fondations posées, exécution réelle verrouillée.** Le canal de règlement est en
`DRY_RUN` et le restera tant que les paramètres 1, 2, 3 et 5 du §14 ne sont pas obtenus.

```bash
cd server
npm install
npm test          # 158 tests
npm run typecheck
npm run scan:secrets
```

---

## Ce que le système ne fait pas

Cette section prime sur toute autre. Elle est volontairement placée avant les fonctionnalités.

### Il ne conserve aucun solde appartenant à un chauffeur

Depuis l'ADR-003, les chauffeurs paient Assur'Trans et reçoivent un **bon carburant à usage
unique** : montant figé, une seule consommation, expiration courte, stations TotalEnergies
uniquement, non transférable, sans remboursement en avoir.

Ce qui reste exclu : le **solde rechargeable**. Un chauffeur ne peut pas créditer un compte chez
Assur'Trans et le dépenser au fil de l'eau — ce serait de la valeur stockée, donc de la monnaie
électronique, donc un agrément EME/PSP. Le domaine n'expose aucune opération de crédit de solde.

Le portefeuille Wave Business ne règle que des factures TotalEnergies émises au nom de l'entité.

### Il ne paie pas un code marchand

Aucun endpoint Wave ne le permet. Les deux seules sorties de fonds programmables sont
`POST /v1/payout` (vers un numéro de mobile) et `POST /v1/b2b/payout` (vers un B2B ID).
L'API Checkout encaisse ; elle ne règle personne. Toute proposition contraire repose sur un
endpoint qui n'existe pas.

### Il ne lit pas le solde du portefeuille

Le chemin de l'API « Balance & Reconciliation » n'est pas établi par le contrat d'intégration
dont nous disposons. `WaveClient.fetchBalance()` et `fetchStatement()` lèvent
`EndpointContractUnknownError` plutôt que de deviner une URL. Le rapprochement à trois voies
fonctionne dès qu'on lui fournit le relevé ; il ne sait pas encore aller le chercher seul.

### Il ne retrouve pas un payout par clé d'idempotence

Aucun endpoint documenté ne le permet. La reprise après crash s'appuie sur `GET /v1/payout/:id`
avec l'identifiant conservé. Une intention restée en `DISPATCHING` **sans** identifiant de payout
part en `NEEDS_REVIEW` : c'est une décision humaine, pas un renvoi à l'aveugle.

### Il ne réessaie jamais un mouvement d'argent

Timeout, 5xx, réponse 2xx sans identifiant exploitable : tout devient `AMBIGUOUS`, puis
`NEEDS_REVIEW`, puis attend un humain. Seules les lectures (`GET`) sont réessayables.

### Il n'appelle aucune API TotalEnergies

TotalEnergies n'expose pas d'API. La consommation entre par import de fichier ou saisie. Aucun
connecteur simulé n'est fourni : un faux connecteur donnerait l'illusion d'une intégration qui
n'existe pas.

### Il ne fait pas de change, de crédit, de scoring ni de KYC de tiers

Hors périmètre v1. Les montants sont en XOF entiers, sans conversion.

### Il ne remplace pas le wallet client existant du front

Le front applicatif (`src/features/fuel/`, `src/features/payments/`) implémente un wallet client
rechargeable par Mobile Money. Ce module ne s'appuie sur aucune de ces fonctions. Voir la section
« Constat sur l'existant » de l'ADR-001 : la mise en production conjointe des deux briques expose
l'entité tant que la question de l'agrément n'est pas tranchée.

---

## Secrets

Voir `docs/SECRETS.md` pour le détail complet.

Le front est servi par Vite, qui **inline toute variable `VITE_*`** dans le JavaScript envoyé au
navigateur. L'audit initial a relevé 22 constats bloquants : 13 définitions de secrets dans
`.env.example` et 9 lectures effectives dans le code.

Aucune de ces variables n'était renseignée — les services tournaient en simulation, rien n'a
fuité. Le risque était que `.env.example` demandait explicitement de les remplir. Une exception
bien active : `src/lib/qr-crypto.ts` embarque un secret de signature de repli codé en dur.

Ce qui a été fait :

| Mesure | Effet |
|---|---|
| `.env.example` réécrit — configuration publique uniquement | plus personne ne peut renseigner un secret au mauvais endroit |
| `server/.env.example` créé | chaque secret conservé a un emplacement serveur nommé |
| `.gitignore` créé | aucun `.env` n'entrera dans le dépôt |
| `Secret` (`src/infra/secrets/`) | une valeur sensible ne peut plus être interpolée, sérialisée ni journalisée par accident |
| `EnvSecretProvider` | refuse tout nom préfixé `VITE_`, sans repli |
| `loadConfig()` | échoue au démarrage, pas au premier paiement |
| Scan CI avec référence figée | la dette connue passe, toute régression échoue le build |

Constats restants : **6** (22 → 10 après nettoyage de `.env.example`, → 6 après retrait de
l'héritage OLA ENERGY), tous du code front, tous listés avec leur ordre de migration dans
`docs/SECRETS.md`. Ils n'ont pas été supprimés parce que les retirer aujourd'hui casserait la
signature des QR et l'envoi de SMS sans rien remplacer.

La clé Wave, elle, n'entre jamais dans ce périmètre : injectée au démarrage depuis KMS/Vault,
portée par `Secret`, exposée à un seul endroit du système — la construction de l'en-tête
`Authorization` dans `WaveClient.headers()`.

## Ce qui est construit

```
server/
├── docs/
│   ├── ADR-001-option-reglementaire.md   Option A — mandat pur, aucun encaissement de tiers
│   ├── ADR-002-canal-reglement.md        B2B vs MOBILE — BLOQUÉ en attente de TotalEnergies
│   ├── ADR-003-bon-carburant.md          Bon à usage unique plutôt que solde rechargeable
│   ├── SECRETS.md                        Modèle de gestion des secrets + plan de migration
│   └── RUNBOOK.md                        Procédures d'incident
├── migrations/
│   ├── 0001_init.sql                     Schéma + contraintes d'intégrité en base
│   └── 0002_bons_carburant.sql           Chauffeurs, paiements, bons, envois, stations
├── src/
│   ├── domain/                           Logique métier pure. Zéro I/O.
│   │   ├── money.ts                      XOF entier. Aucun flottant, aucun centime.
│   │   ├── credit-line.ts                Encours, seuils, projection d'atteinte du blocage
│   │   ├── payment-intent.ts             Machine à états du règlement
│   │   ├── fuel-voucher.ts               Bon à usage unique : émission, consommation, annulation
│   │   └── reconciliation.ts             Rapprochement à trois voies
│   ├── config.ts                         Chargement au démarrage, échec immédiat si incomplet
│   ├── application/
│   │   ├── emit-voucher-on-payment.ts    Paiement confirmé → bon émis → QR mis en file
│   │   └── redeem-voucher-at-station.ts  Scan du pompiste → consommation atomique
│   ├── ports/
│   │   ├── settlement-channel.ts         Sortie de fonds — règlement TotalEnergies
│   │   ├── collection-channel.ts         Entrée de fonds — paiement des chauffeurs
│   │   └── repositories.ts               Persistance, écritures conditionnelles
│   └── infra/
│       ├── secrets/secrets.ts            Secret non journalisable, refus du préfixe VITE_
│       ├── security/voucher-signature.ts Signature HMAC du QR, rotation de clé supportée
│       ├── webhooks/webhook.ts           Signature, fenêtre d'horodatage, déduplication
│       └── wave/
│           ├── wave-client.ts            HTTP. Endpoints documentés uniquement.
│           ├── payout-channels.ts        B2BPayoutChannel | MobilePayoutChannel
│           ├── checkout-channel.ts       Encaissement — POST /v1/checkout/sessions
│           ├── dry-run-channel.ts        Mode par défaut. Aucun appel réseau.
│           ├── dry-run-collection-channel.ts
│           ├── resolve-channel.ts        Sélection du canal de règlement
│           └── resolve-collection.ts     Sélection du canal d'encaissement
├── scripts/scan-secrets.mjs              Scan CI (§11, item 1) + référence figée
└── test/                                 158 tests
```

### Garanties couvertes par les tests

| Garantie | Test |
|---|---|
| Le XOF reste entier ; décimales, négatifs et débordements refusés | `money.spec.ts` |
| Projection d'atteinte du seuil de blocage en arithmétique entière, arrondie au jour supérieur | `credit-line.spec.ts` |
| Un préparateur ne peut pas approuver sa propre intention | `payment-intent.spec.ts` |
| Seconde authentification exigée à `APPROVED → DISPATCHING` | `payment-intent.spec.ts` |
| Clé d'idempotence persistée avant l'appel sortant | `payment-intent.spec.ts` |
| Plafonds unitaire et quotidien serveur | `payment-intent.spec.ts` |
| Réponse ambiguë ⇒ `NEEDS_REVIEW`, aucune reprise automatique | `payment-intent.spec.ts` |
| 5 rejeux du même webhook ⇒ exactement 1 transition | `payment-intent.spec.ts` |
| Un payout id divergent au rejeu part en revue humaine | `payment-intent.spec.ts` |
| 100 % des transactions du relevé classées, aucun reliquat | `reconciliation.spec.ts` |
| Un `VARIANCE` ou un `ORPHAN` non résolu bloque le cycle suivant | `reconciliation.spec.ts` |
| `DRY_RUN` n'émet aucun appel réseau | `settlement-channel.spec.ts` |
| Timeout ⇒ `AMBIGUOUS`, une seule tentative | `settlement-channel.spec.ts` |
| La lecture du solde échoue tant que le chemin n'est pas documenté | `settlement-channel.spec.ts` |
| Le domaine n'importe aucune infrastructure et ne connaît aucun endpoint | `settlement-channel.spec.ts` |
| La clé API n'apparaît ni en interpolation, ni en JSON, ni dans un log, ni dans une erreur | `secrets.spec.ts` |
| Tout nom préfixé `VITE_` est refusé côté serveur, sans repli | `secrets.spec.ts` |
| Un secret manquant ou un plafond absent empêche le démarrage | `config.spec.ts` |
| Un canal réel sans champ de référence d'imputation est refusé | `config.spec.ts` |
| Un bon ne se consomme qu'une fois ; un second pompiste est refusé avec la trace du premier | `fuel-voucher.spec.ts` |
| Un même scan rejoué ne sert pas deux fois et n'affiche pas d'erreur au pompiste | `fuel-voucher.spec.ts` |
| Un bon expiré ou annulé est refusé | `fuel-voucher.spec.ts` |
| Un montant gonflé dans le QR invalide la signature | `voucher-signature.spec.ts` |
| Une rotation de clé n'invalide pas les bons déjà envoyés | `voucher-signature.spec.ts` |
| La signature de webhook porte sur les octets reçus, pas sur un JSON re-sérialisé | `webhook.spec.ts` |
| Un horodatage hors fenêtre est rejeté même avec une signature valide | `webhook.spec.ts` |
| 5 livraisons du même événement ⇒ 1 traitement ; un traitement échoué reste rejouable | `webhook.spec.ts` |
| Rejouer 5 fois le même paiement n'émet qu'un seul bon | `use-cases.spec.ts` |
| Un QR forgé est refusé sans toucher la base | `use-cases.spec.ts` |
| Un montant divergent entre le QR et la base est refusé — la base fait foi | `use-cases.spec.ts` |
| Deux pompistes simultanés : un seul sert | `use-cases.spec.ts` |
| Le chauffeur garde son bon même si l'envoi WhatsApp échoue | `use-cases.spec.ts` |

### Séparation des rôles

`VIEWER` lit · `PREPARER` crée et soumet · `APPROVER` approuve · `EXECUTOR` déclenche.

Deux règles sont codées, l'une exigée par le cahier des charges, l'autre ajoutée :

1. **Exigée** — un préparateur ne peut pas approuver sa propre intention. Contrainte doublée en
   base (`pi_separation_des_roles`) et dans le domaine (`SegregationOfDutiesError`).
2. **Ajoutée** — celui qui a déclenché un envoi ne peut pas trancher lui-même la revue humaine de
   son propre envoi ambigu. C'est le même principe des quatre yeux appliqué au moment où il
   compte le plus. Si cette règle gêne l'exploitation, elle se retire dans le cas
   `RESOLVE_REVIEW` de `payment-intent.ts`.

---

## Ce qui reste à construire

Dans l'ordre où cela devrait être fait :

1. Couche de persistance : implémenter les ports de `repositories.ts` sur Postgres. Les deux
   écritures conditionnelles (`saveIfNew`, `saveIfStatut`) deviennent des `INSERT ... ON CONFLICT`
   et des `UPDATE ... WHERE statut = $attendu` — c'est là que se joue l'atomicité.
2. API HTTP : encaissement, réception du webhook, écran pompiste, authentification et rôles.
3. Envoi WhatsApp — **bloqué** : identifiants WhatsApp Business et modèle approuvé par Meta.
4. `AuditLogger` branché sur `audit_events`.
5. `Scheduler` : jobs at-least-once, verrou via `job_locks`, intention de règlement à J-n.
6. Import du relevé de consommation TE — **format à obtenir** (§14, paramètre 4).
7. PWA installable (manifest, service worker, file d'actions hors ligne, Web Push VAPID).
8. Jeu d'enregistrements de réponses réelles en sandbox Wave.

---

## Paramètres bloquants

| # | Paramètre | Source | Bloque | État |
|---|---|---|---|---|
| 1 | B2B ID ou numéro Wave désigné de TotalEnergies | TE, par écrit | exécution réelle | ⛔ |
| 2 | Format de la référence d'imputation attendue par TE | TE, par écrit | rapprochement côté TE | ⛔ |
| 3 | Encours autorisé et délai de règlement contractuel | Contrat TE | moteur d'encours | ⛔ |
| 4 | Format du relevé de consommation TE | TE | import consommation | ⛔ |
| 5 | Option réglementaire §4 | Décision interne | architecture | 📝 proposée en ADR-001, à contresigner |
| 6 | Plafonds Wave du portefeuille Business | Wave Business | plafonds serveur | ⛔ |

Tant que 1, 3 et 5 ne sont pas levés, `canal_reglement` reste à `DRY_RUN`.
