# CLAUDE.md — Contexte de travail Assur'Trans

Ce fichier sert aux sessions Claude Code ouvertes sur ce dépôt. Il décrit ce qu'il faut savoir
avant d'écrire une ligne, pas ce que le dépôt contient déjà (voir `README.md`).

## Ce qu'est le produit

Bons carburant à usage unique pour flottes, Sénégal et Côte d'Ivoire. Le chauffeur paie depuis
son téléphone, reçoit un bon signé du montant exact, le pompiste le scanne, le bon est consommé
une seule fois. Côté gestion : suivi d'encours, règlement du fournisseur carburant depuis un
portefeuille Wave Business, rapprochement à trois voies, journal d'audit.

## Conventions du dépôt — à respecter, elles ne sont pas décoratives

- **Tout est en français** : code, commentaires, messages d'erreur, noms de domaine
  (`bon`, `encours`, `rapprochement`, `verrou`). Ne pas angliciser.
- **Les en-têtes de fichier expliquent le *pourquoi*, pas le *quoi*.** Chaque module porte un
  bloc de commentaire qui justifie ses arbitrages (ordre des contrôles, invariants, ce qu'on
  refuse de faire et pourquoi). C'est la mémoire du projet : la maintenir en modifiant le code.
- **Architecture ports / adaptateurs** : `domain/` est pur (aucune I/O, aucune horloge — la date
  de référence est toujours un paramètre), `application/` orchestre, `ports/` déclare, `infra/`
  branche.
- **Aucune valeur de repli sur la configuration.** Une variable manquante empêche le démarrage.
  Ne jamais introduire de défaut silencieux.
- **Aucun secret côté front.** `EnvSecretProvider` refuse tout nom préfixé `VITE_`.

## Invariants à ne jamais casser

1. Un paiement finance exactement un bon — l'unicité est portée par la persistance, pas par une
   vérification en mémoire.
2. Un bon est consommé une fois, par écriture conditionnelle atomique. La base fait foi, jamais
   le jeton.
3. Un jeton correctement signé mais au montant divergent = incident de sécurité, pas erreur de
   saisie : on refuse.
4. Côté règlement : `DISPATCHING` et la clé d'idempotence sont écrits **avant** l'appel sortant.
   Aucune reprise automatique d'un versement — on interroge le fournisseur.
5. Les envois de bons, eux, sont rejouables : le jeton est déterministe, deux envois donnent le
   même code. Ne pas confondre les deux régimes.

## État connu

- Le canal de règlement est en `DRY_RUN` et le reste tant que les paramètres 1, 2, 3 et 5 du §14
  ne sont pas obtenus de TotalEnergies. Ne pas « débloquer » ce verrou.
- `OTP_SMS_PROVIDER=LOG` et `OTP_ECHO=true` sont interdits en production, par construction.

## Commandes

```bash
cd server && npm test && npm run typecheck && npm run scan:secrets
cd web && npm test && npm run typecheck
```

## Documents publiés

- `docs/vitrine-partenaire.html` — présentation partenaire (décideur non technique) : parcours de
  bout en bout, garde-fous, pilotage de l'encours, état réel du projet. Publiée comme Artifact.
  **Règle qui s'applique à toute mise à jour de ce document : aucun chiffre, logo, témoignage ou
  référence client inventé.** Les valeurs affichées sont des exemples, et le sont dites. L'état
  du projet y est décrit tel qu'il est, marche à blanc comprise — une vitrine qui promet plus que
  le code ne tient coûte la relation qu'elle cherche à ouvrir.

## Journal de session

- **2026-09-10** — Création de `docs/vitrine-partenaire.html` (vitrine partenaire) et de ce
  fichier. Le système visuel de la page reprend `web/src/styles.css` (béton et pétrole, vert du
  logo, sémantique feu tricolore, Archivo + Public Sans) au lieu d'en inventer un second.
