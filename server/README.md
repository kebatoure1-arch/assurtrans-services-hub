# Module de règlement carburant post-payé

Orchestration du règlement des factures **TotalEnergies Sénégal** (carte carburant post-payée)
depuis un portefeuille **Wave Business** détenu par l'entité.

État : **fondations posées, exécution réelle verrouillée.** Le canal de règlement est en
`DRY_RUN` et le restera tant que les paramètres 1, 2, 3 et 5 du §14 ne sont pas obtenus.

```bash
cd server
npm install
npm test              # 274 tests
npm run typecheck
npm run scan:secrets
npm run build && npm start
```

## Base de donnees

Deux facons d'obtenir un PostgreSQL. La premiere ne demande ni Docker ni droits
d'administrateur : `embedded-postgres` telecharge une distribution portable et la lance comme un
simple processus utilisateur.

```bash
npm run db:local     # laisse tourner ; imprime les deux URL de connexion
```

Il cree **deux** bases : `assurtrans` pour le developpement, `assurtrans_test` pour les tests.
Elles sont separees pour une raison precise — la suite d'integration vide tout le referentiel
entre chaque cas, et partager la base effacerait l'entite, le contrat et l'administrateur.

Les donnees vivent dans `server/.donnees-locales/`, hors depot. `npm run db:local:effacer`
supprime tout.

L'autre voie reste Docker : `npm run db:up` / `npm run db:down`.

Puis les migrations, sur chaque base :

```bash
npm run migrate -- postgres://assurtrans:developpement-local-uniquement@localhost:55432/assurtrans
npm run migrate -- postgres://assurtrans:developpement-local-uniquement@localhost:55432/assurtrans_test
```

### Amorcage

Une base migree est vide, et cela suffit a bloquer : creer un administrateur passe par l'API,
qui exige deja un jeton d'administrateur. Le script d'amorcage coupe cette boucle **une fois**,
en ecrivant directement en base. Il refuse de s'executer si un administrateur existe deja : ce
n'est pas une porte derobee, c'est un outil d'installation.

```bash
DATABASE_URL=postgres://assurtrans:developpement-local-uniquement@localhost:55432/assurtrans   npm run amorcer -- --entite "Assur'Trans Services SARL"                      --admin "Nom de l'administrateur"                      --telephone 77XXXXXXX                      --compte-te "TE-..." --encours 10000000 --delai 30
```

Il imprime l'`ENTITY_ID` a reporter dans `.env`. Tout le reste — chauffeurs, stations,
pompistes — se cree ensuite depuis l'interface, ou chaque geste laisse une trace d'audit.

### Jeu de demonstration

De quoi parcourir les trois interfaces sur des donnees qui ressemblent a de l'exploitation :
trois chauffeurs dont un QR utilisable chacun, deux stations avec leur pompiste, un historique
de consommation etale sur trente jours, un envoi de QR en echec et une facture echue.

```bash
DATABASE_URL=... ENTITY_ID=... npm run jeu-demo -- charger
DATABASE_URL=... npm run jeu-demo -- effacer
```

Le script **refuse toute base dont l'hote n'est pas local** : une fois melangees a de
l'exploitation, des donnees inventees ne se distinguent plus des vraies. Chaque ligne porte un
identifiant derive d'un libelle fixe, donc recharger ne duplique rien et `effacer` retire
exactement ce qui a ete pose. Les numeros sont tous dans la plage `+22177000000x`, qui n'est
attribuee a personne.

L'encours atteint 74 % du plafond : la jauge passe en alerte et la projection annonce une date
de blocage. C'est voulu — un tableau de bord a zero ne montre rien de ce qu'il sait faire.

### Tests d'integration

```bash
DATABASE_URL_TEST=postgres://assurtrans:developpement-local-uniquement@localhost:55432/assurtrans_test npm run test:integration
```

Sans `DATABASE_URL_TEST`, la suite est **ignoree** plutot qu'en echec : un poste sans base ne
doit pas voir rouge pour cette raison. Attention a ne pas confondre « 40 tests ignores » avec
« 40 tests passes ».

Sans configuration, le serveur refuse de demarrer et nomme la variable manquante :

```
ConfigurationError : variable d'environnement SETTLEMENT_CHANNEL absente ou vide
MissingSecretError : secret WAVE_API_KEY absent ou vide : aucun repli n'est prevu
```

## API

| Route | Role | Effet |
|---|---|---|
| `GET /health` | public | etat du service |
| `POST /api/admin/entities` | `ADMIN` | crée une entité de rattachement |
| `POST /api/admin/drivers` | `ADMIN` | crée un chauffeur |
| `POST /api/admin/stations` | `ADMIN` | crée une station |
| `POST /api/admin/operators` | `ADMIN` | crée un pompiste ou un administrateur |
| `POST /api/paiements/session` | `DRIVER`, `ADMIN` | ouvre une session de paiement, rend l'URL a presenter au chauffeur |
| `POST /webhooks/wave` | signature HMAC | confirme un paiement, emet le bon, met le QR en file |
| `POST /api/station/consommation` | `STATION_OPERATOR` | consomme un bon, rend le montant a servir |
| `GET /api/bons/:id` | `DRIVER` (le sien), `ADMIN`, `STATION_OPERATOR` | consultation |

Trois regles y sont verifiees par des tests, parce qu'elles se contournent facilement si on ne
les ecrit pas explicitement :

- **La station vient du jeton, jamais du corps de la requete.** Un pompiste ne sert pas au nom
  d'une autre station, meme s'il envoie `stationId` dans son message.
- **Le chauffeur vient du jeton, jamais du corps.** Envoyer `driverId` dans une demande de
  session ne change rien.
- **Le montant vient de la session enregistree, jamais du webhook.** Un evenement annoncant un
  montant different de celui demande n'emet aucun bon et remonte en 422.

Un bon qui ne regarde pas le demandeur rend 404, pas 403 : on ne confirme pas son existence.

Les créations administratives, les ouvertures de paiement et les consommations de bons écrivent un
événement dans `audit_events`. Le payload n'est pas conservé : seule son empreinte SHA-256 est
écrite, conformément à la règle append-only de la première migration.

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

Constats restants : **aucun**. 22 → 10 après nettoyage de `.env.example`, → 6 après retrait de
l'héritage OLA ENERGY, → 0 avec la suppression de l'ancien front Devv. La référence figée du
scan est vide : tout nouveau constat fait échouer le build.

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
│   ├── 0002_bons_carburant.sql           Chauffeurs, paiements, bons, envois, stations
│   ├── 0003_acces_api.sql                Jetons d'API, roles, rattachement des pompistes
│   └── 0004_sessions_paiement.sql        Sessions ouvertes : qui paie, et combien
├── src/
│   ├── domain/                           Logique métier pure. Zéro I/O.
│   │   ├── money.ts                      XOF entier. Aucun flottant, aucun centime.
│   │   ├── credit-line.ts                Encours, seuils, projection d'atteinte du blocage
│   │   ├── payment-intent.ts             Machine à états du règlement
│   │   ├── fuel-voucher.ts               Bon à usage unique : émission, consommation, annulation
│   │   └── reconciliation.ts             Rapprochement à trois voies
│   ├── main.ts                           Cablage. Seul fichier ou le concret rencontre le metier.
│   ├── config.ts                         Chargement au démarrage, échec immédiat si incomplet
│   ├── http/
│   │   ├── server.ts                     Routes Fastify, authentification, corps brut du webhook
│   │   └── checkout-mapper.ts            Lecture des evenements de paiement, par configuration
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
│       ├── auth/api-tokens.ts            Jetons porteurs : seule l'empreinte est stockee
│       ├── db/sql-executor.ts            Port SQL minimal
│       ├── db/pg-repositories.ts         Ecritures conditionnelles, BIGINT lus sans arrondi
│       └── db/pg-pool.ts                 Seul fichier qui connait node-postgres
│       └── wave/
│           ├── wave-client.ts            HTTP. Endpoints documentés uniquement.
│           ├── payout-channels.ts        B2BPayoutChannel | MobilePayoutChannel
│           ├── checkout-channel.ts       Encaissement — POST /v1/checkout/sessions
│           ├── dry-run-channel.ts        Mode par défaut. Aucun appel réseau.
│           ├── dry-run-collection-channel.ts
│           ├── resolve-channel.ts        Sélection du canal de règlement
│           └── resolve-collection.ts     Sélection du canal d'encaissement
├── scripts/scan-secrets.mjs              Scan CI (§11, item 1) + référence figée
└── test/                                 194 tests
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
| Un BIGINT lu en base devient un entier, et un decimal est refuse plutot qu'arrondi | `pg-repositories.spec.ts` |
| La consommation passe par `UPDATE ... WHERE statut = $attendu` | `pg-repositories.spec.ts` |
| Le jeton signe du QR n'est jamais ecrit dans la table d'envois | `pg-repositories.spec.ts` |
| Sans jeton, ou avec un role insuffisant, l'API refuse | `http-api.spec.ts` |
| Un pompiste ne peut pas servir au nom d'une autre station | `http-api.spec.ts` |
| Un webhook au corps modifie apres signature n'emet aucun bon | `http-api.spec.ts` |
| Un montant paye different du montant demande n'emet aucun bon | `http-api.spec.ts` |
| Un chauffeur ne peut pas consulter le bon d'un autre | `http-api.spec.ts` |

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

1. Envoi WhatsApp — **bloque** : identifiants WhatsApp Business et modele approuve par Meta.
2. Worker d'envoi et reprise des envois en echec.
3. `AuditLogger` branche sur `audit_events`.
4. `Scheduler` : jobs at-least-once, verrou via `job_locks`, intention de reglement a J-n.
5. Import du releve de consommation TE — **format a obtenir** (§14, parametre 4).
6. PWA installable (manifest, service worker, file d'actions hors ligne, Web Push VAPID).
7. Jeu d'enregistrements de reponses reelles en sandbox Wave.

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
