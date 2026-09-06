# 🚀 Workflow Technique Finalisé — Plateforme Assur'Trans©

## Vue d'Ensemble

**Système prépayé sécurisé** avec Mobile Money intégré
- **Disponibilité**: 99,9%
- **Temps de réponse**: < 2 secondes
- **Architecture**: PWA + API REST sécurisée (JWT + HMAC)
- **Intégration**: Mobile Money (Orange Money, Wave, Free Money)

---

## 🎯 Deux Macro-Phases

### **Phase 1**: Approvisionnement & Allocation
**Pilotée par**: Client Flotte / Chauffeur + Assur'Trans
**Objectif**: Gestion des fonds et génération des droits

### **Phase 2**: Consommation & Validation
**Pilotée par**: Chauffeur ↔ Pompiste ↔ Assur'Trans
**Objectif**: Transaction temps réel en station OLA ENERGY

---

## 📋 PHASE 1 — APPROVISIONNEMENT & ALLOCATION

### Étape 1: Approvisionnement du Compte (Recharge Mobile Money)

**Acteurs**: Chauffeur / Client Flotte → Assur'Trans

**Méthodes de paiement**:
- ✅ Orange Money
- ✅ Wave
- ✅ Free Money
- ✅ Crédit manuel Assur'Trans (assistance/avance)

**Processus technique**:
1. Chauffeur/Gestionnaire initie un dépôt via Mobile Money
2. API Mobile Money traite le paiement
3. Callback de confirmation reçu
4. Mise à jour du solde wallet Assur'Trans

**Résultats Système**:
- ✔ Solde mis à jour dans le wallet Assur'Trans
- ✔ Notification instantanée (SMS/WhatsApp/App Push)

**APIs requises**:
- `POST /api/payments/mobile-money/initiate`
- `POST /api/payments/mobile-money/callback` (webhook)
- `POST /api/wallets/credit`
- `POST /api/notifications/send`

---

### Étape 2: Allocation / Dispatching des Dotations Carburant

**Acteur**: Client Flotte (Gestionnaire)

**Cas d'usage**:
- **Chef de Flotte**: Répartit une enveloppe à chaque chauffeur
- **Chauffeur individuel**: Utilise directement son propre solde prépayé

**Processus technique**:
1. Gestionnaire sélectionne chauffeur(s) et montant(s)
2. Système vérifie solde disponible
3. Création de commande(s) interne(s)
4. Mise en réserve du montant (réservation comptable)

**Résultats Système**:
- ✔ Création d'une commande interne (droit d'achat carburant)
- ✔ Mise en réserve du montant alloué (réservation comptable)

**APIs requises**:
- `POST /api/orders/allocate`
- `PUT /api/wallets/reserve`
- `GET /api/wallets/balance`

---

### Étape 3: Génération des Droits – QR Code / OTP

**Acteur**: Assur'Trans (Automatique)

**Processus technique**:
1. Commande créée → Génération automatique de jetons
2. **QR Code dynamique**:
   - Crypté (HMAC-SHA256)
   - Expiration (24-48h configurable)
   - Encodage JSON + signature
3. **OTP (One Time Password)**:
   - 6 chiffres
   - Fallback validation manuelle
   - Expiration 15 minutes

**Contenu du QR Code**:
```json
{
  "order_id": "ORD-2025-001234",
  "driver_id": "DRV-5678",
  "allocated_amount": 50000,
  "timestamp": 1704067200,
  "expiration": 1704153600,
  "hash_signature": "a3f8b2c..."
}
```

**Notifications multiples**:
- ✅ Notification Assur'Trans (in-app)
- ✅ SMS (fallback)
- ✅ WhatsApp (option)
- ✅ Confirmation commande + montant alloué

**Résultats Système**:
- ✔ QR Code généré et stocké (base64 PNG)
- ✔ OTP généré et envoyé
- ✔ Notifications envoyées sur tous les canaux
- ✔ Jeton synchronisé avec ID commande

**APIs requises**:
- `POST /api/qr/generate`
- `POST /api/otp/generate`
- `POST /api/notifications/multi-channel`

---

## 🔥 PHASE 2 — CONSOMMATION & VALIDATION

### Étape 4: Présentation du QR Code (Initiation)

**Acteurs**: Chauffeur → Pompiste

**Processus**:
1. Chauffeur arrive en station OLA ENERGY
2. Présente QR Code au pompiste
3. Pompiste scanne via TPE OLA ENERGY

**Point de contact**:
- TPE OLA ENERGY (terminal de paiement intégré)

---

### Étape 5: Validation au TPE + Décision

**Acteur**: Pompiste / Système Assur'Trans

**Processus temps réel (< 2 secondes)**:
1. TPE scanne QR Code
2. TPE interroge API Assur'Trans:
   - ✅ Validité du QR Code
   - ✅ Montant autorisé
   - ✅ Statut de la commande
   - ✅ Identité chauffeur
3. Affichage résultat au pompiste
4. Pompiste clique **Valider** ou **Refuser**

**Garanties de sécurité**:
- 🛡 Aucun dépassement possible (montant strictement plafonné)
- 🛡 Jeton automatiquement invalidé après utilisation
- 🛡 Vérification signature cryptographique
- 🛡 Détection tentatives de fraude

**Résultat**:
- ✅ **Validé**: Autorisation de servir carburant
- ❌ **Refusé**: Blocage + notification

**APIs requises**:
- `POST /api/qr/validate` (vérification)
- `POST /api/orders/authorize` (autorisation)
- `POST /api/orders/reject` (rejet)

---

### Étape 6: Consommation + Mise à Jour Temps Réel

**Acteur**: Système Assur'Trans & OLA ENERGY

**Processus post-validation**:
1. Pompiste sert le carburant
2. Montant réel consommé saisi
3. Validation finale au TPE
4. Mise à jour immédiate:
   - Commande marquée "COMPLETED"
   - Solde wallet débité
   - Points fidélité crédités (5% automatique)

**Journalisation complète**:
- ✅ Identité pompiste
- ✅ Station OLA ENERGY
- ✅ Heure exacte (timestamp)
- ✅ Montant consommé
- ✅ GPS (option - géolocalisation)
- ✅ Produit carburant (type)
- ✅ Volume (litres)

**Notifications automatiques**:
- 📲 Chauffeur (transaction complétée)
- 📲 Client Flotte (alerte consommation)
- 📲 Assur'Trans (audit trail)
- 📲 Station OLA ENERGY Manager (option)

**APIs requises**:
- `POST /api/orders/complete`
- `PUT /api/wallets/debit`
- `POST /api/loyalty/earn`
- `POST /api/transactions/log`
- `POST /api/notifications/broadcast`

---

## 📱 MODULE "MES COMMANDES" — Fonctionnalités Clés

### APIs Nécessaires

| Fonctionnalité | Rôle Technique | APIs / Source |
|---|---|---|
| **Passer une commande carburant** | Création de "droit carburant" | `POST /api/orders/create` |
| **Suivi de la consommation** | Récupération temps réel | `GET /api/orders/status` |
| **Historique transactions** | Listing sécurisé + filtres | `GET /api/transactions/list` |
| **Programme de fidélité** | Accumulation 5% + conversion | `POST /api/loyalty/earn`<br>`POST /api/loyalty/redeem` |

---

## 🔐 QR Code = Jeton Numérique d'Achat

### Structure du QR Code

```json
{
  "order_id": "ORD-2025-001234",
  "driver_id": "DRV-5678",
  "allocated_amount": 50000,
  "timestamp": 1704067200,
  "expiration": 1704153600,
  "hash_signature": "a3f8b2c1d5e6f7g8h9i0j1k2l3m4n5o6"
}
```

### Propriétés du Jeton

- ✅ **Unique**: Un seul usage autorisé
- ✅ **Crypté**: HMAC-SHA256 signature
- ✅ **Expirant**: Durée de validité configurable (24-48h)
- ✅ **Vérifiable**: Validation instantanée par TPE + API centrale
- ✅ **Tracé**: Journalisation complète (qui, quand, où, combien)

### Vérification en 3 Étapes

1. **Décodage**: Extraction des données JSON du QR Code
2. **Validation signature**: Vérification HMAC avec clé secrète
3. **Vérification métier**:
   - QR Code non expiré
   - Commande en statut "DISPATCHED" ou "PENDING"
   - Montant disponible
   - Pas d'utilisation antérieure

---

## 🎯 Garanties Techniques

### Sécurité
- ✅ JWT + HMAC pour toutes les APIs
- ✅ Cryptage end-to-end Mobile Money
- ✅ Signature cryptographique QR Code
- ✅ OTP fallback pour validation manuelle
- ✅ Détection de fraude automatique

### Performance
- ✅ Temps de réponse < 2 secondes
- ✅ Disponibilité 99,9%
- ✅ Validation temps réel
- ✅ Notifications instantanées

### Auditabilité
- ✅ Journalisation complète (audit trail)
- ✅ Traçabilité de bout en bout
- ✅ Horodatage précis (timestamp)
- ✅ Géolocalisation (GPS optionnel)

---

## 📊 Diagramme de Flux Simplifié

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: APPROVISIONNEMENT               │
└─────────────────────────────────────────────────────────────┘
   Chauffeur/Flotte
        │
        │ 1. Recharge Mobile Money
        ▼
   Assur'Trans Wallet
        │
        │ 2. Allocation Carburant
        ▼
   Commande Créée
        │
        │ 3. Génération QR + OTP
        ▼
   Notifications envoyées

┌─────────────────────────────────────────────────────────────┐
│                  PHASE 2: CONSOMMATION                       │
└─────────────────────────────────────────────────────────────┘
   Chauffeur en station
        │
        │ 4. Présentation QR Code
        ▼
   TPE OLA ENERGY
        │
        │ 5. Validation (<2s)
        ▼
   Autorisation/Rejet
        │
        │ 6. Consommation + MAJ
        ▼
   Transaction complétée
        │
        ├──> Wallet débité
        ├──> Points fidélité +5%
        └──> Notifications envoyées
```

---

## 🚀 Prochaines Étapes d'Implémentation

### Phase Immédiate (MVP)
1. ✅ **QR Code**: Génération automatique (DÉJÀ FAIT)
2. ✅ **Scanner QR**: Interface pompiste (DÉJÀ FAIT)
3. ⏳ **Mobile Money**: Intégration paiements
4. ⏳ **Validation temps réel**: API authorize/complete
5. ⏳ **Notifications multi-canal**: SMS/WhatsApp

### Phase 2 (Enrichissement)
6. ⏳ **OTP fallback**: Validation manuelle
7. ⏳ **GPS tracking**: Géolocalisation transactions
8. ⏳ **Analytics avancées**: Tableaux de bord temps réel
9. ⏳ **API TPE OLA ENERGY**: Intégration terminaux

### Phase 3 (Optimisation)
10. ⏳ **Mode offline**: Synchronisation différée
11. ⏳ **Détection fraude**: Machine learning
12. ⏳ **Multi-devises**: Support FCFA/autres

---

## 📚 Documentation Technique Associée

- **QR_CODE_ENHANCEMENTS.md**: Implémentation QR Code actuelle
- **ADMIN_UNRESTRICTED_ACCESS.md**: Gestion permissions admin
- **STRUCTURE.md**: Architecture globale du projet

---

**Document créé le**: 2025-01-12  
**Version**: 1.0  
**Statut**: 🎯 Guide d'implémentation officiel
