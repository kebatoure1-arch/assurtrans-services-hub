# ADR-002 — Canal de règlement TotalEnergies

- **Statut** : **Proposé — BLOQUÉ** en attente d'une confirmation écrite de TotalEnergies Sénégal
- **Date** : 2026-09-05
- **Bloque** : l'exécution réelle (§14, paramètres 1 et 2)

## Le point dur

L'API Wave **ne permet pas de régler un code marchand**. Vérification faite sur le contrat
d'intégration :

| API Wave | Sens | Peut régler TotalEnergies ? |
|---|---|---|
| `POST /v1/checkout/sessions` | entrant | **Non.** Encaisse un payeur vers le wallet. Ne paye personne. |
| Aggregated Merchants | entrant | **Non.** Encaissement pour compte de sous-marchands. |
| Balance & Reconciliation | lecture | Non — lecture seule. |
| `POST /v1/payout` | sortant | **Oui**, vers un numéro de mobile (MSISDN). |
| `POST /v1/b2b/payout` | sortant | **Oui**, vers un B2B ID de portefeuille business. |

Il n'existe donc **que deux sorties de fonds programmables**. Toute autre proposition (« payer le
code marchand TE via l'API ») repose sur un endpoint qui n'existe pas.

## Décision

Le domaine métier ne connaît **aucun des deux canaux**. Il dépend de l'interface
`SettlementChannel` (`src/ports/settlement-channel.ts`), résolue au démarrage à partir de
`te_contracts.canal_reglement` :

- `B2B`     → `B2BPayoutChannel`     (`POST /v1/b2b/payout`)
- `MOBILE`  → `MobilePayoutChannel`  (`POST /v1/payout`)
- `DRY_RUN` → `DryRunChannel`        — **valeur par défaut et seule valeur autorisée aujourd'hui**

`DryRunChannel` écrit l'intention complète en base, produit un identifiant de payout simulé
préfixé `DRYRUN-`, et **n'émet aucun appel réseau**.

Basculer `B2B` ↔ `MOBILE` ne modifie aucun fichier de `src/domain/` — vérifié par le test
`test/settlement-channel.spec.ts`.

## Ce qui manque pour lever le blocage

| # | Paramètre | Source | Sans lui |
|---|---|---|---|
| 1 | B2B ID **ou** numéro Wave désigné de TotalEnergies | Interlocuteur TE, par écrit | Aucun bénéficiaire ⇒ pas d'exécution |
| 2 | Format exact de la référence d'imputation attendue par TE (champ libre du payout) | Interlocuteur TE, par écrit | TE ne peut pas rattacher le versement au compte Assur'Trans ⇒ facture non lettrée côté TE malgré un payout réussi |
| 6 | Plafonds Wave du portefeuille Business | Wave Business | Plafonds serveur non calibrés |

**Un versement sans référence d'imputation correcte est un versement perdu côté TE.** Le
paramètre 2 est aussi bloquant que le paramètre 1.

## Champ de référence

Le payload de payout transporte la référence d'imputation dans un champ libre. Le nom exact de ce
champ et sa longueur maximale sont **à confirmer sur la documentation Wave en vigueur** avant tout
appel réel : le code lève `EndpointContractUnknownError` plutôt que de deviner
(`src/infra/wave/wave-client.ts`).

## Trace écrite exigée

Cet ADR ne passe en statut « Accepté » qu'accompagné de la référence écrite de TotalEnergies
(courriel ou avenant) précisant les paramètres 1 et 2. Coller la référence ci-dessous :

```
Référence TE : ____________________
Date         : ____________________
Interlocuteur: ____________________
```
