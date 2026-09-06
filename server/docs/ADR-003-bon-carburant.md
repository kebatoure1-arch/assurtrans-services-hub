# ADR-003 — Bon carburant à usage unique

- **Statut** : Accepté (v1)
- **Date** : 2026-09-06
- **Décideur** : direction Assur'Trans
- **Révise** : ADR-001, qui excluait tout encaissement de tiers en v1

## Contexte

Décision produit du 2026-09-06 : les chauffeurs paient Assur'Trans, reçoivent **un QR par
transaction** envoyé sur WhatsApp, et le présentent au pompiste en station. Assur'Trans reverse
ensuite à TotalEnergies.

L'ADR-001 posait « aucun encaissement de tiers en v1 ». Cette décision revient dessus. Elle est
tenable, à une condition de conception près — c'est l'objet de cet ADR.

## Le point de bascule

Deux produits identiques pour le chauffeur, très différents en droit :

| | Solde rechargeable | Bon à usage unique |
|---|---|---|
| Le chauffeur | crédite 50 000, dépense au fil de l'eau | paie 20 000, reçoit un bon de 20 000 |
| Assur'Trans détient | le solde non consommé de chaque chauffeur | rien : la contrepartie est due immédiatement |
| Nature | valeur stockée, réutilisable, remboursable | achat payé d'avance |
| Régime | monnaie électronique — agrément EME/PSP (Instruction BCEAO n°008-05-2015) | vente de biens |

Le front applicatif existant (`src/features/fuel/services/wallet-service.ts`,
`DepositDialog.tsx`) implémente la colonne de gauche.

## Décision

**Le bon à usage unique.** La formulation même de la décision — « à la suite de chaque
transaction, nous délivrons un QR Code » — décrit la colonne de droite.

Six règles rendent la distinction effective. Elles ne sont pas décoratives : c'est leur respect
qui fait que l'objet n'est pas de la valeur stockée.

1. **Montant figé à l'émission.** Ni rechargeable, ni cumulable, ni fractionnable.
   `emitVoucher` refuse un montant nul ; le domaine n'expose aucune opération de crédit.
2. **Usage unique.** Un scan, une consommation. Garanti par `UPDATE ... WHERE statut = 'EMIS'`
   et par `fuel_vouchers_redemption_unique`.
3. **Expiration courte.** Un bon qui traîne indéfiniment redevient un solde. Validité en heures,
   fixée à l'émission.
4. **Réseau fermé.** Stations TotalEnergies uniquement, carburant uniquement.
5. **Pas de remboursement en espèces.** Un bon annulé avant consommation donne lieu à un
   remboursement du paiement d'origine, sur son canal d'origine — pas à un avoir.
6. **Non transférable.** Le bon est rattaché à un chauffeur. Il n'existe aucune opération de
   cession entre chauffeurs.

**Si l'une de ces six règles saute, l'objet redevient de la valeur stockée et l'analyse change.**
C'est notamment le cas si l'on ajoute un jour « le reliquat est conservé pour la prochaine fois ».

### Ce que cet ADR ne prétend pas être

Une distinction d'ingénierie, pas un avis juridique. La qualification finale — bon à usage unique
en réseau fermé, exclusion du champ de la monnaie électronique — doit être confirmée par un
conseil compétent avant la mise en production. Ce document dit ce que le code garantit ; il ne
dit pas ce que le régulateur conclura.

## Chaîne complète

```
Chauffeur paie                    driver_payments (canal, référence, unicité)
      │
      ▼
Émission du bon                   fuel_vouchers — montant figé, expiration, 1 bon par paiement
      │
      ▼
QR signé HMAC                     VoucherSigner — clé serveur, rotation supportée
      │
      ▼
Envoi WhatsApp                    voucher_deliveries — un échec d'envoi doit se voir
      │
      ▼
Le pompiste consomme              UPDATE conditionnel : usage unique atomique
      │
      ▼
Consommation carte TotalEnergies  card_transactions.voucher_id
      │
      ▼
Facture TE → règlement Wave       payment_intents (ADR-002, DRY_RUN)
```

## Le QR ne suffit pas

Un QR « présenté pour vérification » et contrôlé à l'œil est rejouable : une capture d'écran
suffit, et le même bon peut être présenté dans dix stations.

La signature HMAC répond à « ce bon a-t-il bien été émis par nous, pour ce montant ». Elle ne
répond pas à « ce bon a-t-il déjà servi ». Seul le serveur le sait. La consommation passe donc
obligatoirement par un appel serveur, et l'unicité est portée par la base, pas par l'écran.

Conséquence opérationnelle : **le pompiste a besoin d'un accès réseau au moment de servir.**
C'est une contrainte réelle à valider sur le terrain. Le mode dégradé — servir puis régulariser —
n'est pas implémenté et ne doit pas l'être sans décision explicite : il rouvre exactement la
faille que la consommation serveur ferme.

## Ce que cela change dans l'ADR-001

La phrase « aucune route entrante » n'est plus vraie : l'encaissement des chauffeurs est
désormais dans le périmètre. Ce qui reste vrai, et qui portait le raisonnement :

- Assur'Trans ne détient jamais de solde appartenant à un chauffeur.
- Le portefeuille Wave ne règle que des factures TotalEnergies émises au nom de l'entité.
- La ristourne reste un produit propre, la couverture santé une charge propre.

## Conséquences à traiter

| Sujet | État |
|---|---|
| Wallet client existant du front | ⛔ à retirer ou à neutraliser — il implémente le modèle écarté |
| Canal d'encaissement Wave Checkout (`POST /v1/checkout/sessions`) | ⬜ à implémenter |
| Envoi WhatsApp | ⬜ bloqué : identifiants WhatsApp Business et modèle de message approuvé par Meta |
| Écran pompiste (consommation en ligne) | ⬜ à construire ; `QRScannerPage` et le rôle `station_operator` existent déjà |
| Rapprochement bon ↔ mouvement carte TE | ⬜ dépend du format du relevé TE (§14, paramètre 4) |
| Bons émis, jamais consommés, expirés | ⬜ politique à définir : remboursement, ou produit acquis ? La réponse a un effet comptable et contractuel |
