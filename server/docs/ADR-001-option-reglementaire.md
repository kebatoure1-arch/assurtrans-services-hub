# ADR-001 — Option réglementaire retenue

- **Statut** : Accepté (v1)
- **Date** : 2026-09-05
- **Décideurs** : Assur'Trans — à contresigner par la direction avant mise en production
- **Contexte réglementaire** : Instruction BCEAO n°008-05-2015 relative aux modalités d'exercice
  des activités des émetteurs de monnaie électronique dans l'UEMOA.
  ⚠️ **La version en vigueur doit être vérifiée avant production** (cf. §14 param. 5).

## Contexte

La plateforme orchestre le règlement d'une carte carburant TotalEnergies **post-payée** depuis un
portefeuille **Wave Business** détenu par Assur'Trans.

Le fait générateur d'agrément EME/PSP est le suivant : si la plateforme **encaisse des tiers**
(flottes, conducteurs, clients) puis **détient ces fonds** avant de régler TotalEnergies, elle
exerce une activité de détention de fonds pour compte de tiers.

Le simple fait de payer TotalEnergies depuis un wallet appartenant à Assur'Trans, pour la
consommation propre d'Assur'Trans, **ne déclenche pas** ce fait générateur.

## Options examinées

| Option | Mécanisme | Exposition |
|---|---|---|
| A — Mandat pur | La plateforme n'encaisse jamais de tiers. Elle émet des ordres depuis un compte qu'elle détient en propre, ou sur mandat écrit depuis un compte de cantonnement bancaire | Nulle |
| B — Adossement PSP | Encaissement et détention par un établissement agréé ; la plateforme est agent technique | Nulle, mais dépendance contractuelle + adaptateur PSP à écrire |
| C — Flux d'information | Chaque client règle TE directement ; la plateforme orchestre et rapproche sans mouvement de fonds | Nulle, mais suppression des payouts sortants |

## Décision

**Option A — Mandat pur, restreinte à la consommation propre de l'entité en v1.**

Le portefeuille Wave Business ne règle **que** les factures TotalEnergies correspondant à la
consommation de l'entité Assur'Trans elle-même.

Conséquences codées et vérifiables :

1. **Aucun encaissement de tiers** dans ce module. Il n'existe aucune implémentation entrante
   (`Checkout`, `Aggregated Merchants`) dans `server/`.
2. Un `payment_intent` est **toujours** rattaché à une `invoice` émise par TotalEnergies au nom
   de l'entité titulaire du contrat. Contrainte en base : `payment_intents.invoice_id NOT NULL`.
3. Le bénéficiaire d'un payout est **exclusivement** le bénéficiaire déclaré au contrat TE
   (`te_contracts.te_b2b_id` ou `te_contracts.te_msisdn`). Aucune API n'accepte un bénéficiaire
   fourni par l'appelant.

## Constat sur l'existant — hors périmètre mais à traiter

Le front applicatif existant (`src/features/fuel/services/wallet-service.ts`,
`src/features/fuel/components/DepositDialog.tsx`,
`src/features/payments/services/mobile-money-service.ts`) implémente un **wallet client
rechargeable par Mobile Money**. Fonctionnellement, cela revient à encaisser des tiers et à
détenir leurs fonds jusqu'à consommation.

Ce module `server/` **ne s'appuie sur aucune de ces fonctions** et n'en dépend pas. Le traitement
du wallet client existant (suppression, migration vers option B, ou obtention d'un agrément)
fait l'objet d'une décision distincte, hors de cet ADR. Tant que cette décision n'est pas prise,
la mise en production conjointe des deux briques expose l'entité.

## Ce que cette décision interdit

- Créditer le wallet Wave Business depuis un paiement client, puis payer TE avec.
- Régler une facture TE au nom d'un tiers depuis le wallet de l'entité.
- Toute route entrante d'encaissement dans `server/`.

## Réversibilité

Passer à l'option B suppose l'ajout d'un `SettlementFundingPort` et d'un adaptateur PSP agréé.
Le domaine métier (`src/domain/`) n'a aucune connaissance de l'origine des fonds ; il n'est donc
pas impacté.

---

## Précision reçue le 2026-09-06 — ristourne TotalEnergies et couverture santé

Modèle économique communiqué par la direction : TotalEnergies verse à Assur'Trans une
**ristourne** sur la consommation carburant. Assur'Trans finance, avec cette ristourne, une
**couverture d'assurance santé** au bénéfice des clients carburant (chauffeurs et automobilistes).

### Effet sur la décision — elle est confortée

Le flux est le suivant :

```
TotalEnergies ──ristourne──► Assur'Trans ──prime──► Assureur ──couverture──► Chauffeurs
              (produit propre)          (charge propre)
```

La ristourne est un **produit d'exploitation d'Assur'Trans**, pas un fonds détenu pour le compte
d'un tiers. La prime versée à l'assureur est une **charge d'Assur'Trans**. À aucun moment
Assur'Trans ne détient de l'argent appartenant à un chauffeur.

L'option A reste donc la bonne, et ce modèle la renforce : la couverture santé n'est pas vendue
aux bénéficiaires, elle leur est offerte. Il n'y a pas d'encaissement de prime.

### Trois points à vérifier avant production — ils ne relèvent pas de la BCEAO

Le fait d'offrir une couverture d'assurance ne relève pas de l'Instruction BCEAO n°008-05-2015,
mais du **Code CIMA**. Ce sont des questions distinctes de l'architecture technique, à trancher
avec un conseil compétent :

1. **Forme du contrat.** Assur'Trans souscrit-elle une assurance de groupe dont les chauffeurs
   sont adhérents, ou distribue-t-elle des contrats individuels ? Le second cas relève de
   l'intermédiation en assurance et suppose une habilitation, ou le passage par un intermédiaire
   habilité.
2. **Gratuité effective.** Tant que la couverture est intégralement financée par la ristourne et
   qu'aucune contrepartie n'est demandée au bénéficiaire, il n'y a pas de perception de prime.
   Si un jour une part est refacturée au chauffeur — même partielle, même via le prix du
   carburant — l'analyse change entièrement.
3. **Le wallet client reste le point dur.** Ce modèle ne règle pas la question posée plus haut :
   si Assur'Trans encaisse les chauffeurs pour leur consommation carburant, la détention de fonds
   pour compte de tiers existe, indépendamment de l'assurance. La ristourne finance l'assurance ;
   elle ne légitime pas l'encaissement du carburant.

### Effet sur le code — deux conséquences concrètes

**a) La ristourne doit être modélisée, et elle n'est pas un simple produit comptable.**

Elle est assise sur la consommation carburant, donc sur les mêmes `card_transactions` qui
alimentent le moteur d'encours. Elle a sa propre échéance et son propre rapprochement. Elle
appartient au périmètre de ce module, pas à un tableur.

**b) Le rapprochement doit savoir si TotalEnergies déduit la ristourne de la facture.**

Deux cas, à confirmer auprès de TotalEnergies (à ajouter au §14) :

| Cas | Conséquence sur le rapprochement |
|---|---|
| TE verse la ristourne séparément | la facture est réglée pour son montant plein ; la ristourne est un flux entrant distinct — et ce flux entrant sera classé `ORPHAN` par le rapprochement actuel, qui interdit tout mouvement entrant |
| TE déduit la ristourne de la facture | le montant facturé est déjà net ; aucun ajustement, mais le contrôle de cohérence « facture vs consommation agrégée » doit intégrer la déduction sous peine de lever un faux écart |

Tant que ce point n'est pas tranché, un versement de ristourne reçu sur le portefeuille Wave
apparaîtra en `ORPHAN` au rapprochement. C'est le comportement voulu : un mouvement entrant
inattendu doit être vu, pas absorbé.

**Paramètre à obtenir (§14, nouveau) :** modalité de versement de la ristourne — séparée ou
déduite de la facture — et sa périodicité.
