# Runbook — incidents de règlement

Règle qui prime sur toutes les autres : **en cas de doute sur un mouvement d'argent, on ne
rejoue rien.** On constate, on documente, on tranche à deux.

Les renvois « §n de ce runbook » désignent les sections numérotées ci-dessous. Un `§n` nu, dans
`server/README.md` ou dans un ADR, renvoie au cahier des charges, dont la numérotation est
indépendante — les deux se croisent sans se correspondre.

---

## 1. Rotation de la clé API Wave

Déclencheurs : rotation périodique, départ d'un administrateur, suspicion de fuite.

1. Business Portal Wave → générer une **nouvelle** clé avec **les mêmes rôles** que l'ancienne.
   Ne pas révoquer l'ancienne à ce stade.
2. Déposer la nouvelle valeur dans KMS/Vault sous une nouvelle version du secret.
3. Redéployer le serveur. Vérifier au démarrage qu'un `GET /v1/payout/:id` sur un payout connu
   répond 200.
4. Attendre la fin de tout job d'ordonnancement en cours. Vérifier qu'aucune intention n'est en
   `DISPATCHING`.
5. Révoquer l'ancienne clé au Business Portal.
6. Consigner la rotation dans `audit_events` (`action = 'WAVE_KEY_ROTATED'`).

En cas de fuite avérée : inverser l'ordre — révoquer d'abord, accepter l'interruption de service.
Une clé fuitée est une autorisation de dépenser.

**Ne jamais** : mettre la clé dans une variable `VITE_*`, un fichier du repo, un log, un message
d'erreur, un ticket.

---

## 2. Clé révoquée pendant un job

Symptôme : `REJECTED` avec un 401/403 sur des intentions successives.

1. Arrêter le scheduler (`job_locks`, poser un verrou manuel de longue durée).
2. Pour chaque intention en `SENT` sans confirmation : `GET /v1/payout/:id`. Le sort de ces
   ordres-là ne dépend pas de la clé courante.
3. Pour chaque intention restée en `DISPATCHING` : passer en `NEEDS_REVIEW`, motif
   `clé révoquée en cours de job`. Ne pas renvoyer.
4. Restaurer une clé valide (§1 de ce runbook), puis traiter les `NEEDS_REVIEW` un par un.

---

## 3. Payout en état ambigu

Symptôme : intention en `NEEDS_REVIEW`, motif timeout ou 5xx.

Ne jamais renvoyer avant d'avoir répondu à : **le payout existe-t-il chez Wave ?**

1. Si un `wave_payout_id` a été conservé → `GET /v1/payout/:id`.
   - 200 → `RESOLVE_REVIEW / PAYOUT_TROUVE` avec l'identifiant. L'intention repasse en `SENT`.
   - 404 → `RESOLVE_REVIEW / PAYOUT_ABSENT`. L'intention passe en `FAILED`. Une nouvelle
     intention peut alors être préparée, avec une **nouvelle** clé d'idempotence.
2. Si aucun identifiant n'a été conservé (crash entre l'écriture `DISPATCHING` et l'appel HTTP) :
   aucun endpoint ne permet de chercher par clé d'idempotence. Recours :
   - relevé du portefeuille sur la fenêtre concernée (export manuel depuis le Business Portal
     tant que l'API Balance n'est pas câblée) ;
   - recherche d'une sortie du montant exact vers le bénéficiaire du contrat ;
   - à défaut de certitude : **contacter Wave**. Ne pas renvoyer.
3. Consigner la décision et son auteur dans `audit_events`.

Rappel : la résolution est faite par un acteur distinct de celui qui a déclenché l'envoi.

---

## 4. Double règlement constaté

Symptôme : deux sorties portent le même payout, ou deux payouts règlent la même facture. Le
rapprochement les classe `VARIANCE`, motif `double règlement`.

1. Geler l'ordonnancement du cycle suivant — c'est automatique
   (`ReconResult.bloqueCycleSuivant`), le vérifier plutôt que le supposer.
2. Identifier les deux mouvements au relevé : montants, horodatages, bénéficiaires,
   clés d'idempotence des intentions correspondantes.
3. Deux clés d'idempotence différentes ⇒ défaut d'ordonnancement (deux intentions créées pour une
   facture). Vérifier l'index `payment_intents_une_vivante_par_facture` : s'il n'a pas joué, c'est
   qu'une intention avait été passée en `FAILED` ou `CANCELLED` à tort.
4. Une seule clé pour deux sorties ⇒ défaut côté fournisseur. Ouvrir un ticket Wave avec la clé
   d'idempotence et les deux identifiants de payout.
5. Récupération du trop-versé : demande de remboursement auprès de TotalEnergies, ou imputation
   sur la facture suivante selon le contrat. Ne pas compenser par une intention négative — la
   machine à états n'accepte pas de montant négatif, et c'est voulu.
6. Ne pas clore le `VARIANCE` avant que le remboursement ou l'imputation soit constaté au relevé.

---

## 5. Écart de rapprochement

Symptôme : ligne `VARIANCE` avec un écart non nul.

| Écart | Piste |
|---|---|
| Écart petit et constant | frais prélevés par le fournisseur — vérifier le contrat, puis paramétrer `toleranceXof` et documenter la décision |
| Montant réglé < facture | payout partiel, ou facture révisée après ordonnancement |
| Montant réglé > facture | double imputation, ou erreur de saisie du montant de facture |
| Aucune trace au relevé | payout accepté puis rejeté en aval, ou relevé incomplet sur la fenêtre |

Dans tous les cas : la facture ne passe pas en `LETTREE` tant que l'écart n'est pas résolu, et le
cycle suivant reste bloqué.

---

## 6. Facture réglée deux fois par deux canaux

Cas : un règlement a été effectué à la main depuis l'application Wave, en parallèle du système.

1. Le règlement manuel apparaît au rapprochement en `ORPHAN` — sortie sans intention.
2. Ne pas créer une intention rétroactive pour « faire propre » : cela masquerait l'incident.
   Créer une ligne de rapprochement résolue à la main, avec l'auteur et la note.
3. Traiter le trop-versé selon §4 de ce runbook.
4. Cause racine : un accès direct au portefeuille reste ouvert. Décider si cet accès doit être
   restreint ; sinon l'incident se reproduira.

---

## 7. Solde insuffisant à l'échéance

Symptôme : `REJECTED` avec un motif de fonds insuffisants.

1. L'intention passe en `FAILED`. Elle n'est pas rejouée automatiquement.
2. Approvisionner le portefeuille — **hors du système**, et jamais par encaissement de tiers
   (ADR-001).
3. Préparer une nouvelle intention avec une nouvelle clé d'idempotence.
4. Si l'échéance est dépassée : vérifier la pénalité de retard au contrat TE et le risque de
   suspension des cartes (§8 de ce runbook).

Prévention : surveiller la projection d'atteinte du seuil de blocage, pas le solde Wave.

---

## 8. Suspension de carte par TotalEnergies

Symptôme : refus en station, ou notification TE.

1. Vérifier l'encours : `evaluateCreditLine` — le niveau est-il en `BLOCAGE` ?
2. Vérifier les factures échues impayées, et les intentions bloquées en `NEEDS_REVIEW`.
3. Régler la ou les factures échues en priorité, puis demander la réouverture de l'encours à TE.
4. Passer la carte en `SUSPENDUE` dans le référentiel pour que la consommation attendue cesse
   d'alimenter la projection.
5. Après réouverture : repasser la carte en `ACTIVE` et relancer un import de consommation, la
   projection se recalcule.

---

## 9. Webhook douteux

| Symptôme | Conduite |
|---|---|
| Signature HMAC invalide | rejeter, journaliser l'`event_id` et l'IP, ne pas traiter |
| `event_id` déjà présent dans `webhook_events` | ignorer silencieusement, c'est un rejeu normal |
| Horodatage hors fenêtre | rejeter — tentative de rejeu |
| Webhook reçu avant la réponse HTTP du payout | normal : la machine à états accepte `DISPATCH_ACK` puis `CONFIRM_SETTLED` dans cet ordre. Si `CONFIRM_SETTLED` arrive alors que l'intention est encore en `DISPATCHING`, la transition est refusée et l'événement reste non traité — le rejeu de Wave le reprendra |
| Montant différent d'un rejeu précédent | `NEEDS_REVIEW`, motif `règlement rejoué avec un montant différent` |

---

## 10. Horloge désynchronisée

Symptôme : webhooks rejetés en masse pour horodatage hors fenêtre, ou échéances mal calculées.

1. Vérifier NTP sur le serveur.
2. Ne pas élargir la fenêtre d'horodatage pour « débloquer » : c'est la protection anti-rejeu.
3. Après resynchronisation, rejouer les webhooks non traités depuis `webhook_events`
   (`processed_at IS NULL`).

---

## 11. Portefeuille Wave désactivé

Le solde reste consultable, les payouts échouent.

1. Toutes les intentions passent en `FAILED` ou `AMBIGUOUS` selon la réponse. Traiter les
   ambiguës selon §3 de ce runbook.
2. Suspendre l'ordonnancement tant que le portefeuille n'est pas réactivé.
3. Si l'échéance TE approche : prévenir TotalEnergies avant l'échéance, pas après.
