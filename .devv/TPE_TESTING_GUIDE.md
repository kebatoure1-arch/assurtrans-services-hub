# 🧪 Guide de Test Complet - TPE OLA ENERGY

**Version**: 1.0.0  
**Date**: Décembre 2025  
**Auteur**: Devv AI  
**Projet**: Assur'Trans©

---

## 📑 Table des Matières

1. [Prérequis et Configuration](#1-prérequis-et-configuration)
2. [Tests en Mode Simulation](#2-tests-en-mode-simulation)
3. [Tests en Mode Production](#3-tests-en-mode-production)
4. [Tests de Webhook](#4-tests-de-webhook)
5. [Tests de Bout-en-Bout](#5-tests-de-bout-en-bout)
6. [Tests de Performance et Sécurité](#6-tests-de-performance-et-sécurité)
7. [Troubleshooting et Débogage](#7-troubleshooting-et-débogage)
8. [Checklist de Certification](#8-checklist-de-certification)

---

## 1. Prérequis et Configuration

### 1.1 Environnement de Test Requis

**Matériel**:
- [ ] Ordinateur avec navigateur moderne (Chrome 90+, Firefox 88+, Safari 14+)
- [ ] Smartphone pour tests mobile (iOS 14+, Android 8+)
- [ ] Caméra fonctionnelle (pour scan QR Code)
- [ ] Connexion internet stable (minimum 2 Mbps)

**Logiciels**:
- [ ] Node.js 18+ installé
- [ ] Projet Assur'Trans cloné et installé
- [ ] DevTools navigateur ouvert (Console + Network)

**Comptes de Test**:
- [ ] Compte Admin créé (admin@assurtrans.com)
- [ ] Compte Station créé (station@assurtrans.com)
- [ ] Compte Driver créé (driver@assurtrans.com)
- [ ] Seed data exécuté (Settings → Données Démo)

### 1.2 Configuration Mode Simulation

**Par défaut, le système fonctionne en mode simulation** (pas besoin de credentials OLA ENERGY).

Vérifiez dans `.env.local` :
```bash
# Mode Simulation (par défaut)
# Pas de variables OLA ENERGY = Mode Simulation activé automatiquement
```

**Comment vérifier le mode actuel** :
1. Ouvrir la Console DevTools
2. Aller à `/tpe-terminal`
3. Rechercher dans les logs : `"🟡 MODE SIMULATION ACTIVÉ"`

### 1.3 Configuration Mode Production

**Uniquement si vous avez les credentials OLA ENERGY**.

Créer `.env.local` à la racine du projet :
```bash
# Mode Production (credentials OLA ENERGY)
VITE_OLA_TPE_API_KEY=sandbox_ola_xxxxxxxxxxxxx
VITE_OLA_TPE_MERCHANT_ID=MERC_SANDBOX_001
VITE_OLA_TPE_API_URL=https://sandbox-api.olaenergy.com/v1
VITE_OLA_TPE_WEBHOOK_SECRET=whsec_sandbox_xxxxxxxxx
```

**Redémarrer le serveur** :
```bash
npm run dev
```

**Vérifier le mode** :
- Logs Console : `"🟢 MODE PRODUCTION ACTIVÉ"`
- Logs Console : `"API URL: https://sandbox-api.olaenergy.com/v1"`

---

## 2. Tests en Mode Simulation

### TEST 2.1 : Validation QR Code Valide ✅

**Objectif** : Vérifier que le TPE peut scanner et valider un QR Code valide.

**Prérequis** :
- [ ] Commande carburant créée (avec QR Code)
- [ ] Statut commande = `dispatched` (dispatchée à une station)
- [ ] QR Code visible dans OrderDetailsDialog

**Étapes** :
1. **Se connecter en tant que Station** :
   - Email : `station@assurtrans.com`
   - OTP : (vérifier email)

2. **Aller au TPE Terminal** :
   - Cliquer sur "TPE Terminal" dans le dashboard
   - OU naviguer vers `/tpe-terminal`

3. **Scanner le QR Code** :
   - Cliquer sur le bouton scan (icône caméra)
   - Autoriser l'accès caméra si demandé
   - Présenter le QR Code devant la caméra
   - OU cliquer "Saisie Manuelle" et entrer le numéro de commande

4. **Vérifier le résultat** :
   - ✅ QR Code scanné avec succès
   - ✅ Détails commande affichés (montant, véhicule, produit)
   - ✅ Code de validation affiché (4 chiffres)
   - ✅ Bouton "Valider et Payer" activé

**Résultat Attendu** :
```json
{
  "success": true,
  "order": {
    "orderId": "ORD-2025-001",
    "amount": 50000,
    "vehicleRegistration": "AA-1234-AB",
    "productName": "Gasoil",
    "validationCode": "1234"
  },
  "validationTime": 682  // ms (< 2000ms ✅)
}
```

**Console Logs Attendus** :
```
🔍 [TPE] Scanning QR Code...
✅ [TPE] QR Code decoded: ORD-2025-001
🔐 [QR Validation] Starting validation...
✅ [QR Validation] Order found: ORD-2025-001
✅ [QR Validation] Validation complete in 682ms
```

**KPIs** :
- ⏱️ Temps validation : **< 2 secondes** (TARGET)
- ✅ Taux de succès : **100%**

---

### TEST 2.2 : Validation QR Code Expiré ❌

**Objectif** : Vérifier que le TPE rejette un QR Code expiré (> 48h).

**Prérequis** :
- [ ] QR Code créé il y a > 48 heures
- [ ] OU modifier manuellement `createdAt` dans la base de données

**Étapes** :
1. **Créer un QR Code expiré** :
   - Option A : Attendre 48h (lent)
   - Option B : Modifier DB manuellement (rapide)

2. **Scanner le QR Code** :
   - Même processus que TEST 2.1

3. **Vérifier le résultat** :
   - ❌ Message d'erreur : "QR Code expiré"
   - ❌ Bouton "Valider et Payer" désactivé
   - ⚠️ Toast rouge : "Le QR Code a expiré après 48 heures"

**Résultat Attendu** :
```json
{
  "success": false,
  "error": "EXPIRED_QR",
  "message": "Le QR Code a expiré après 48 heures",
  "expirationDate": "2025-12-05T10:30:00Z"
}
```

**Console Logs Attendus** :
```
🔍 [TPE] Scanning QR Code...
✅ [TPE] QR Code decoded: ORD-2025-001
🔐 [QR Validation] Starting validation...
❌ [QR Validation] EXPIRED_QR: Created 49 hours ago
⏰ Expiration limit: 48 hours
```

**KPIs** :
- ✅ Détection expiration : **Immédiate**
- 🔒 Sécurité : **Aucune transaction autorisée**

---

### TEST 2.3 : Validation QR Code Déjà Utilisé ❌

**Objectif** : Vérifier que le TPE rejette un QR Code déjà utilisé (one-time use).

**Prérequis** :
- [ ] QR Code valide scanné une première fois
- [ ] Transaction complétée (statut = `completed`)

**Étapes** :
1. **Compléter une transaction** :
   - Suivre TEST 2.1 jusqu'au bout
   - Payer avec carte (simulation)
   - Statut final = `completed`

2. **Tenter de réutiliser le QR Code** :
   - Scanner à nouveau le même QR Code
   - OU saisir manuellement le même numéro

3. **Vérifier le résultat** :
   - ❌ Message d'erreur : "QR Code déjà utilisé"
   - ⚠️ Toast rouge : "Cette commande a déjà été traitée"

**Résultat Attendu** :
```json
{
  "success": false,
  "error": "ALREADY_USED",
  "message": "QR Code déjà utilisé",
  "usedAt": "2025-12-07T14:20:00Z",
  "usedBy": "Station ABC"
}
```

**Console Logs Attendus** :
```
🔍 [TPE] Scanning QR Code...
✅ [TPE] QR Code decoded: ORD-2025-001
🔐 [QR Validation] Starting validation...
❌ [QR Validation] ALREADY_USED: Order status = completed
⚠️ Used at: 2025-12-07T14:20:00Z
```

**KPIs** :
- 🔒 Protection anti-rejeu : **100%**
- ✅ Double-dépense empêchée : **Oui**

---

### TEST 2.4 : Paiement Carte Visa (Simulation) 💳

**Objectif** : Vérifier le flow complet de paiement carte Visa en mode simulation.

**Prérequis** :
- [ ] QR Code valide scanné (TEST 2.1 réussi)
- [ ] Détails commande affichés

**Étapes** :
1. **Sélectionner méthode de paiement** :
   - Méthode par défaut : Carte (Visa/Mastercard)
   - Vérifier que l'icône carte est active

2. **Cliquer "Valider et Payer"** :
   - Observer le loading state (spinner)
   - Attendre 2-3 secondes (simulation)

3. **Vérifier le résultat** :
   - ✅ État : "success"
   - ✅ Message : "Paiement réussi"
   - ✅ Reçu affiché (détails transaction)
   - ✅ Boutons : "Télécharger PDF" + "Imprimer"

4. **Télécharger le reçu PDF** :
   - Cliquer "Télécharger Reçu"
   - Vérifier le fichier : `recus-tpe-ORD-2025-001-20251207-142030.pdf`
   - Ouvrir le PDF : vérifier QR Code + détails

5. **Vérifier la base de données** :
   - Table `transactions` : nouvelle entrée
   - Type : `tpe_payment`
   - Statut : `completed`
   - Montant débité du wallet

**Résultat Attendu** :
```json
{
  "success": true,
  "transactionId": "TXN-TPE-2025-001",
  "orderId": "ORD-2025-001",
  "amount": 50000,
  "paymentMethod": "CARD_VISA",
  "status": "completed",
  "timestamp": "2025-12-07T14:20:35Z",
  "receipt": {
    "receiptNumber": "RCP-TPE-001",
    "qrCode": "data:image/png;base64,..."
  }
}
```

**Console Logs Attendus** :
```
💳 [TPE] Payment initiated: CARD_VISA
🔄 [Payment] Processing in SIMULATION mode...
⏳ Simulating card payment (2s)...
✅ [Payment] SIMULATION SUCCESS
💰 Wallet debited: 50000 XOF
📧 Email receipt sent to driver@assurtrans.com
✅ [TPE] Transaction complete in 2.3s
```

**KPIs** :
- ⏱️ Temps total : **2-3 secondes** (simulation)
- ✅ Taux de succès : **100%** (simulation)
- 📧 Email envoyé : **Oui** (si configuré)

---

### TEST 2.5 : Paiement Mobile Money (Simulation) 📱

**Objectif** : Vérifier le flow de paiement Mobile Money en mode simulation.

**Prérequis** :
- [ ] QR Code valide scanné
- [ ] Mode simulation activé

**Étapes** :
1. **Sélectionner Mobile Money** :
   - Cliquer sur l'onglet "Mobile Money"
   - Icône téléphone active

2. **Cliquer "Valider et Payer"** :
   - Observer le loading state
   - Attendre 2-3 secondes

3. **Vérifier le résultat** :
   - ✅ État : "success"
   - ✅ Message : "Paiement Mobile Money réussi"
   - ✅ Reçu affiché

**Résultat Attendu** :
```json
{
  "success": true,
  "paymentMethod": "MOBILE_MONEY",
  "operator": "Orange Money",  // Simulation
  "status": "completed"
}
```

**Console Logs Attendus** :
```
📱 [TPE] Payment initiated: MOBILE_MONEY
🔄 [Payment] SIMULATION mode - Auto-success
✅ [Payment] SIMULATION SUCCESS (Mobile Money)
```

---

### TEST 2.6 : Paiement Portefeuille Prépayé 💰

**Objectif** : Vérifier le paiement via portefeuille prépayé (solde existant).

**Prérequis** :
- [ ] Driver a un solde wallet > montant commande
- [ ] QR Code valide scanné

**Étapes** :
1. **Sélectionner Portefeuille Prépayé** :
   - Cliquer sur l'onglet "Portefeuille"
   - Vérifier le solde affiché

2. **Cliquer "Valider et Payer"** :
   - Attendre 1-2 secondes

3. **Vérifier le résultat** :
   - ✅ Paiement immédiat (< 1s)
   - ✅ Solde wallet mis à jour
   - ✅ Reçu généré

**Résultat Attendu** :
```json
{
  "success": true,
  "paymentMethod": "PREPAID_WALLET",
  "walletBalanceBefore": 100000,
  "walletBalanceAfter": 50000,
  "amountDebited": 50000
}
```

**KPIs** :
- ⏱️ Temps : **< 1 seconde** (le plus rapide)
- ✅ Débit immédiat : **Oui**

---

### TEST 2.7 : Solde Wallet Insuffisant ❌

**Objectif** : Vérifier le rejet si solde wallet insuffisant.

**Prérequis** :
- [ ] Driver avec solde wallet < montant commande

**Étapes** :
1. **Sélectionner Portefeuille Prépayé** :
   - Vérifier solde affiché (ex: 10,000 XOF)
   - Montant commande : 50,000 XOF

2. **Cliquer "Valider et Payer"** :
   - Observer le résultat immédiat

3. **Vérifier le résultat** :
   - ❌ Message d'erreur : "Solde insuffisant"
   - ⚠️ Toast : "Votre solde est insuffisant. Rechargez via Mobile Money."
   - 💡 Bouton : "Recharger Wallet"

**Résultat Attendu** :
```json
{
  "success": false,
  "error": "INSUFFICIENT_FUNDS",
  "walletBalance": 10000,
  "amountRequired": 50000,
  "amountMissing": 40000
}
```

**Console Logs Attendus** :
```
💰 [Wallet] Checking balance...
❌ [Wallet] INSUFFICIENT_FUNDS
   Balance: 10,000 XOF
   Required: 50,000 XOF
   Missing: 40,000 XOF
```

---

### TEST 2.8 : Recharge Hybride (Top-Up) 🔄

**Objectif** : Vérifier le top-up automatique via carte si wallet insuffisant.

**Prérequis** :
- [ ] Solde wallet < montant commande
- [ ] Mode hybride activé

**Étapes** :
1. **Tenter paiement wallet insuffisant** :
   - Solde : 10,000 XOF
   - Montant : 50,000 XOF

2. **Système propose top-up** :
   - Message : "Solde insuffisant. Recharger 40,000 XOF via carte ?"
   - Bouton : "Recharger et Payer"

3. **Accepter top-up** :
   - Paiement carte de 40,000 XOF (simulation)
   - Recharge wallet automatique
   - Paiement commande avec nouveau solde

4. **Vérifier le résultat** :
   - ✅ 2 transactions créées :
     - Transaction 1 : Top-up wallet (+40,000)
     - Transaction 2 : Paiement carburant (-50,000)
   - ✅ Solde final : 0 XOF

**Résultat Attendu** :
```json
{
  "success": true,
  "transactions": [
    {
      "type": "wallet_topup",
      "amount": 40000,
      "paymentMethod": "CARD_VISA"
    },
    {
      "type": "fuel_payment",
      "amount": 50000,
      "paymentMethod": "PREPAID_WALLET"
    }
  ],
  "walletBalanceFinal": 0
}
```

---

### TEST 2.9 : Impression Reçu Thermique 🖨️

**Objectif** : Vérifier l'impression sur imprimante thermique 80mm.

**Prérequis** :
- [ ] Transaction complétée avec succès
- [ ] Reçu affiché à l'écran

**Étapes** :
1. **Cliquer "Imprimer"** :
   - Bouton avec icône imprimante
   - Dialogue d'impression navigateur s'ouvre

2. **Configurer l'impression** :
   - Format : Portrait
   - Taille : 80mm (ou A4)
   - Marges : Minimales

3. **Imprimer ou sauvegarder PDF** :
   - Imprimer sur imprimante thermique
   - OU "Enregistrer en PDF" pour vérification

4. **Vérifier le reçu** :
   - ✅ Logo Assur'Trans
   - ✅ QR Code (40mm × 40mm)
   - ✅ Détails transaction (montant, date, station)
   - ✅ Numéro de commande
   - ✅ Lisible et bien formaté

**KPIs** :
- 📄 Format : **80mm × longueur variable** (thermique)
- 🎨 Qualité : **Professionnelle**
- ⏱️ Temps : **< 5 secondes**

---

### TEST 2.10 : Mode Offline (Queue) 📵

**Objectif** : Vérifier la file d'attente offline si connexion perdue.

**Prérequis** :
- [ ] Transaction en cours
- [ ] Connexion internet désactivée (DevTools → Network → Offline)

**Étapes** :
1. **Activer mode offline** :
   - DevTools → Network → Throttling → Offline

2. **Tenter paiement** :
   - Scanner QR Code (fonctionne, cache local)
   - Cliquer "Valider et Payer"
   - Observer le comportement

3. **Vérifier le résultat** :
   - ⚠️ Message : "Mode hors ligne détecté"
   - ⏳ Transaction ajoutée à la file d'attente
   - 💾 Sauvegarde locale (localStorage)
   - 🔔 Toast : "Transaction enregistrée. Sera synchronisée dès la connexion rétablie."

4. **Réactiver connexion** :
   - DevTools → Network → No Throttling
   - Observer la synchronisation automatique

5. **Vérifier la synchronisation** :
   - ✅ Transaction envoyée au serveur
   - ✅ File d'attente vidée
   - ✅ Notification : "Synchronisation réussie"

**Résultat Attendu** :
```json
{
  "offlineMode": true,
  "queuedTransactions": 1,
  "transaction": {
    "status": "queued",
    "queuedAt": "2025-12-07T14:25:00Z"
  }
}
```

**Console Logs Attendus** :
```
📵 [TPE] No internet connection detected
💾 [Offline] Saving transaction to local queue...
✅ [Offline] Transaction queued (ID: offline_001)
🔔 [Offline] Will sync when online

// Après reconnexion
🌐 [Sync] Connection restored
🔄 [Sync] Processing 1 queued transaction(s)...
✅ [Sync] Transaction synced: offline_001
🗑️ [Sync] Queue cleared
```

**KPIs** :
- 📵 Disponibilité : **99.9%** (même offline)
- ⏱️ Temps sync : **< 5 secondes** après reconnexion

---

## 3. Tests en Mode Production

**⚠️ IMPORTANT** : Cette section nécessite des **credentials OLA ENERGY valides**.

### TEST 3.1 : Configuration Credentials Production

**Objectif** : Vérifier que les credentials sont correctement configurés.

**Prérequis** :
- [ ] Credentials OLA ENERGY reçus (sandbox ou production)
- [ ] Fichier `.env.local` créé

**Étapes** :
1. **Créer `.env.local`** :
```bash
VITE_OLA_TPE_API_KEY=sandbox_ola_xxxxxxxxxxxxx
VITE_OLA_TPE_MERCHANT_ID=MERC_SANDBOX_001
VITE_OLA_TPE_API_URL=https://sandbox-api.olaenergy.com/v1
VITE_OLA_TPE_WEBHOOK_SECRET=whsec_sandbox_xxxxxxxxx
```

2. **Redémarrer le serveur** :
```bash
npm run dev
```

3. **Vérifier dans Console** :
```
🟢 MODE PRODUCTION ACTIVÉ
📡 API URL: https://sandbox-api.olaenergy.com/v1
🔑 Merchant ID: MERC_SANDBOX_001
```

4. **Test de Connexion** :
   - Aller à `/tpe-terminal`
   - Observer les logs console
   - Vérifier : `"✅ Connected to OLA ENERGY API"`

**Résultat Attendu** :
- ✅ Mode production activé
- ✅ Aucune erreur de configuration
- ✅ API accessible

---

### TEST 3.2 : Paiement Carte Réel (Sandbox)

**Objectif** : Tester un paiement carte réel via l'API OLA ENERGY (sandbox).

**Prérequis** :
- [ ] Mode production activé (TEST 3.1 ✅)
- [ ] QR Code valide scanné
- [ ] Cartes de test fournies par OLA ENERGY

**Étapes** :
1. **Scanner QR Code** :
   - Même processus que mode simulation

2. **Sélectionner paiement carte** :
   - Méthode : Carte (Visa/Mastercard)

3. **Cliquer "Valider et Payer"** :
   - ⚠️ Cette fois, appel API réel !
   - Observer les logs : `"📡 Calling OLA ENERGY API..."`

4. **Vérifier le résultat** :
   - ✅ Réponse API dans 1.5-3 secondes
   - ✅ Transaction ID réel reçu
   - ✅ Statut : `approved` (si carte valide)

**Cartes de Test OLA ENERGY** (exemples) :
```
✅ Carte approuvée :
   Numéro : 5555 5555 5555 4444
   CVV : 123
   Expiry : 12/25

❌ Carte refusée :
   Numéro : 4000 0000 0000 0002
   CVV : 123
   Expiry : 12/25
```

**Résultat Attendu** :
```json
{
  "success": true,
  "transactionId": "TXN_SANDBOX_ABC123",  // ID réel OLA ENERGY
  "status": "approved",
  "approvalCode": "AUTH_001",
  "cardLastFour": "4444",
  "cardType": "VISA",
  "processingTime": 1850  // ms
}
```

**Console Logs Attendus** :
```
📡 [TPE] Calling OLA ENERGY API...
🔑 API Key: sandbox_ola_xxx...xxx (masked)
📤 Request: POST https://sandbox-api.olaenergy.com/v1/payments
⏳ Waiting for response...
✅ [OLA API] Response received in 1.85s
✅ Status: approved
📋 Transaction ID: TXN_SANDBOX_ABC123
```

**KPIs** :
- ⏱️ Temps : **1.5-3 secondes** (API réelle)
- ✅ Taux de succès : **Dépend de la carte** (90%+ en sandbox)

---

### TEST 3.3 : Gestion Erreurs API Réelles

**Objectif** : Vérifier la gestion des erreurs API (carte refusée, timeout, etc.).

**Étapes** :
1. **Test carte refusée** :
   - Utiliser carte de test "declined"
   - Vérifier message : "Paiement refusé par la banque"

2. **Test timeout** :
   - Simuler réseau lent (DevTools → Network → Slow 3G)
   - Vérifier timeout après 2 minutes
   - Message : "Délai d'attente dépassé"

3. **Test erreur serveur** :
   - Invalider temporairement l'API Key
   - Vérifier message : "Erreur de configuration API"

**Résultat Attendu** :
```json
{
  "success": false,
  "error": "PAYMENT_DECLINED",
  "errorCode": "CARD_DECLINED",
  "errorMessage": "Insufficient funds",
  "retriable": false  // Ne pas réessayer
}
```

---

### TEST 3.4 : Retry Logic Automatique

**Objectif** : Vérifier le retry automatique en cas d'erreur réseau temporaire.

**Étapes** :
1. **Simuler erreur réseau** :
   - DevTools → Network → Throttling → Custom (10% packet loss)

2. **Tenter paiement** :
   - Observer les tentatives multiples
   - Max 3 tentatives avec exponential backoff

3. **Vérifier les logs** :
```
🔄 [Retry] Attempt 1 failed: Network error
⏳ Waiting 1s before retry...
🔄 [Retry] Attempt 2 failed: Network error
⏳ Waiting 2s before retry...
✅ [Retry] Attempt 3 succeeded!
```

**KPIs** :
- 🔄 Max tentatives : **3**
- ⏱️ Backoff : **1s → 2s → 4s**
- ✅ Taux de succès après retry : **85%+**

---

## 4. Tests de Webhook

**⚠️ IMPORTANT** : Cette section nécessite un **endpoint webhook déployé**.

### TEST 4.1 : Configuration Webhook Endpoint

**Objectif** : Déployer et configurer le webhook endpoint.

**Option A : Vercel (Recommandé)**

1. **Créer `api/webhooks/tpe.ts`** :
```typescript
import { vercelTPEWebhookHandler } from '@/services/tpe-webhook-handler';

export default vercelTPEWebhookHandler;
```

2. **Déployer sur Vercel** :
```bash
vercel --prod
```

3. **URL Webhook** :
```
https://your-app.vercel.app/api/webhooks/tpe
```

4. **Configurer dans OLA ENERGY** :
   - Dashboard OLA ENERGY → Webhooks
   - Ajouter URL : `https://your-app.vercel.app/api/webhooks/tpe`
   - Secret : Copier le secret fourni

**Option B : Express.js**

Voir `.devv/TPE_PRODUCTION_MODE_IMPLEMENTATION.md` section 5.3.

---

### TEST 4.2 : Webhook Transaction Approved ✅

**Objectif** : Vérifier la réception d'un webhook après paiement réussi.

**Prérequis** :
- [ ] Webhook endpoint déployé (TEST 4.1 ✅)
- [ ] URL configurée dans OLA ENERGY

**Étapes** :
1. **Effectuer paiement carte réel** :
   - Suivre TEST 3.2
   - Transaction approuvée

2. **Attendre callback webhook** :
   - Délai : 2-5 secondes
   - Observer les logs serveur

3. **Vérifier le webhook reçu** :
```json
{
  "event": "payment.approved",
  "transaction_id": "TXN_SANDBOX_ABC123",
  "amount": 50000,
  "currency": "XOF",
  "status": "approved",
  "timestamp": "2025-12-07T14:30:00Z",
  "signature": "sha256=abc123..."
}
```

4. **Vérifier la mise à jour DB** :
   - Table `transactions` : statut = `completed`
   - Table `orders` : statut = `completed`
   - Wallet débité automatiquement

**Console Logs Attendus** (serveur) :
```
📨 [Webhook] Received event: payment.approved
🔐 [Webhook] Verifying signature...
✅ [Webhook] Signature valid
🔄 [Webhook] Processing transaction: TXN_SANDBOX_ABC123
💾 [Webhook] Updating database...
✅ [Webhook] Transaction updated: completed
📧 [Webhook] Sending confirmation email...
✅ [Webhook] Processing complete in 450ms
```

**KPIs** :
- ⏱️ Temps traitement : **< 500ms**
- ✅ Taux de succès : **99.5%+**
- 🔒 Sécurité : **HMAC vérifié**

---

### TEST 4.3 : Webhook Transaction Declined ❌

**Objectif** : Vérifier le webhook après paiement refusé.

**Étapes** :
1. **Utiliser carte de test refusée** :
   - Carte : 4000 0000 0000 0002

2. **Attendre callback webhook** :
```json
{
  "event": "payment.declined",
  "transaction_id": "TXN_SANDBOX_XYZ789",
  "status": "declined",
  "reason": "insufficient_funds"
}
```

3. **Vérifier la mise à jour DB** :
   - Table `transactions` : statut = `failed`
   - Table `orders` : statut reste `dispatched`
   - Wallet NON débité

**Console Logs Attendus** :
```
📨 [Webhook] Received event: payment.declined
✅ [Webhook] Signature valid
⚠️ [Webhook] Processing declined payment
💾 [Webhook] Transaction status: failed
📧 [Webhook] Sending failure notification...
✅ [Webhook] Processing complete
```

---

### TEST 4.4 : Webhook Idempotency Protection 🔒

**Objectif** : Vérifier la protection contre les duplications (replay attacks).

**Étapes** :
1. **Recevoir webhook valide** :
   - Event : `payment.approved`
   - Transaction ID : `TXN_001`

2. **Recevoir MÊME webhook une 2e fois** :
   - Même payload
   - Même signature

3. **Vérifier le comportement** :
   - ✅ Webhook accepté la 1ère fois
   - ⚠️ Webhook ignoré la 2e fois (idempotency key)
   - 📝 Log : "Duplicate webhook ignored (already processed)"

**Console Logs Attendus** :
```
// Première fois
✅ [Webhook] Processing transaction: TXN_001
💾 Saved to database

// Deuxième fois
⚠️ [Webhook] Idempotency check: TXN_001 already processed
🛡️ [Webhook] Duplicate ignored (status: 200 OK returned)
```

**KPIs** :
- 🔒 Protection : **100%** (aucun doublon traité)
- ⚡ Performance : **< 50ms** (détection immédiate)

---

### TEST 4.5 : Webhook Signature Invalide 🚨

**Objectif** : Vérifier le rejet de webhooks avec signature invalide (attaque).

**Étapes** :
1. **Envoyer webhook avec signature falsifiée** :
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/tpe \
  -H "Content-Type: application/json" \
  -H "X-OLA-Signature: sha256=FAKE_SIGNATURE" \
  -d '{"event":"payment.approved","transaction_id":"TXN_FAKE"}'
```

2. **Vérifier le rejet** :
   - ❌ Status : 401 Unauthorized
   - ❌ Message : "Invalid webhook signature"
   - 🚨 Alerte sécurité loggée

**Console Logs Attendus** :
```
📨 [Webhook] Received event
🔐 [Webhook] Verifying signature...
❌ [Webhook] INVALID SIGNATURE
🚨 [Security] Potential attack detected
📝 Event logged for investigation
⛔ Response: 401 Unauthorized
```

**KPIs** :
- 🔒 Sécurité : **100%** (aucun webhook non signé accepté)
- 🚨 Détection : **Immédiate**

---

## 5. Tests de Bout-en-Bout

### TEST 5.1 : Flow Complet Driver → Station → Confirmation

**Objectif** : Tester le workflow complet de A à Z.

**Acteurs** :
- 👤 Driver (commande + QR Code)
- 🏪 Station (scan + paiement)
- 📧 System (email + notifications)

**Étapes** :

**1. Driver crée une commande** :
- Se connecter : `driver@assurtrans.com`
- Aller à : "Commander du Carburant"
- Créer commande :
  - Produit : Gasoil
  - Quantité : 100 L
  - Montant : 50,000 XOF
- ✅ QR Code généré automatiquement

**2. Fleet Manager dispatche** :
- Se connecter : `admin@assurtrans.com`
- Aller à : "Gestion Carburant"
- Dispatcher la commande :
  - Station : OLA ENERGY - Plateau
- ✅ Statut : `dispatched`

**3. Driver reçoit notification** :
- 📧 Email : "Votre commande a été dispatchée"
- 📱 Notification in-app
- 🎫 QR Code disponible dans "Mes Commandes"

**4. Driver se présente à la station** :
- Montrer le QR Code sur téléphone

**5. Station scanne le QR Code** :
- Se connecter : `station@assurtrans.com`
- Aller à : `/tpe-terminal`
- Scanner le QR Code
- ✅ Détails commande affichés

**6. Station valide et encaisse** :
- Sélectionner méthode : Carte (ou Wallet)
- Cliquer "Valider et Payer"
- ✅ Paiement réussi en 2-3s

**7. Reçu généré et envoyé** :
- 🖨️ Reçu imprimé (thermique)
- 📧 Email envoyé au driver
- 💾 Transaction enregistrée

**8. Driver reçoit confirmation** :
- 📧 Email : "Votre paiement est confirmé"
- 📱 Notification : "50,000 XOF débités"
- 🏆 Points fidélité crédités (+2,500 pts)

**Temps Total** : **< 3 minutes** (de la commande au reçu)

**Vérifications Finales** :
- ✅ Commande statut : `completed`
- ✅ Transaction enregistrée : `tpe_payment`
- ✅ Wallet driver débité : -50,000 XOF
- ✅ Points fidélité : +2,500 pts
- ✅ Email reçu : 2 emails (dispatch + confirmation)
- ✅ Reçu PDF téléchargeable

---

### TEST 5.2 : Flow Multi-Commandes (Volume)

**Objectif** : Tester le traitement de plusieurs commandes en parallèle.

**Scénario** :
- 5 drivers créent des commandes simultanément
- 1 station traite les 5 commandes en séquence
- Temps total < 15 minutes

**Étapes** :
1. **Créer 5 commandes** (différents drivers)
2. **Dispatcher toutes à la même station**
3. **Station traite une par une** :
   - Scanner QR 1 → Payer → Suivant
   - Scanner QR 2 → Payer → Suivant
   - ... (5 fois)

**KPIs** :
- ⏱️ Temps moyen par transaction : **< 3 minutes**
- ✅ Taux de succès : **100%**
- 🚫 Conflits : **0** (aucune commande traitée 2 fois)

---

## 6. Tests de Performance et Sécurité

### TEST 6.1 : Temps de Validation QR Code

**Objectif** : Mesurer le temps de validation QR Code.

**Méthode** :
```javascript
// Dans Console DevTools
const start = performance.now();
// Scanner QR Code
const end = performance.now();
console.log(`Validation time: ${end - start}ms`);
```

**Cibles** :
- ⏱️ Moyenne : **< 1000ms** (1 seconde)
- ⏱️ P95 : **< 1500ms**
- ⏱️ Max : **< 2000ms** ✅ TARGET

**Résultats Attendus** :
```
Test 1: 682ms ✅
Test 2: 745ms ✅
Test 3: 891ms ✅
Test 4: 1234ms ✅
Test 5: 1502ms ✅

Average: 1011ms ✅
P95: 1502ms ✅
Max: 1502ms ✅
```

---

### TEST 6.2 : Charge Simultanée (Stress Test)

**Objectif** : Tester la charge de 10 stations simultanées.

**Outil** : Artillery, k6, ou script custom

**Scénario** :
```yaml
# artillery-tpe-load.yml
config:
  target: 'https://your-app.vercel.app'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requêtes/sec

scenarios:
  - name: "QR Validation"
    flow:
      - post:
          url: "/api/tpe/validate"
          json:
            qrCode: "ORD-2025-001"
```

**Exécution** :
```bash
artillery run artillery-tpe-load.yml
```

**KPIs** :
- 📊 Throughput : **> 50 req/sec**
- ⏱️ Latency P95 : **< 2000ms**
- ✅ Success Rate : **> 99%**

---

### TEST 6.3 : Sécurité HMAC Signature

**Objectif** : Vérifier que les QR Codes non signés sont rejetés.

**Étapes** :
1. **Créer QR Code sans HMAC** :
```javascript
// QR Code falsifié (sans signature)
const fakeQR = JSON.stringify({
  orderId: "ORD-FAKE-001",
  amount: 1000000,  // 1M XOF !
  timestamp: Date.now()
});
```

2. **Tenter de scanner** :
   - Scanner le QR Code falsifié
   - Observer le rejet

3. **Vérifier le résultat** :
   - ❌ Erreur : "QR Code invalide (signature manquante)"
   - 🚨 Event de sécurité loggé
   - ⛔ Transaction bloquée

**Console Logs Attendus** :
```
🔐 [QR Validation] Checking HMAC signature...
❌ [Security] SIGNATURE_MISSING or SIGNATURE_INVALID
🚨 [Security] Potential tampering detected
📝 Security event logged
⛔ Validation rejected
```

**KPIs** :
- 🔒 Taux de détection : **100%**
- 🚨 Aucune transaction frauduleuse autorisée

---

### TEST 6.4 : Rate Limiting

**Objectif** : Vérifier la protection contre les attaques par force brute.

**Étapes** :
1. **Tenter 20 scans en 1 minute** :
   - Même station
   - Différents QR Codes

2. **Vérifier le blocage** :
   - Après 10 tentatives : Warning
   - Après 15 tentatives : Temporaire (1 minute)
   - Après 20 tentatives : Bloqué (10 minutes)

**Résultat Attendu** :
```
Attempt 1-10: ✅ OK
Attempt 11: ⚠️ Warning: Rate limit approaching
Attempt 15: ⏸️ Temporarily blocked (60s)
Attempt 20: 🚫 Blocked (10 minutes)
```

**KPIs** :
- 🛡️ Protection : **Active**
- 🚫 Attaques bloquées : **100%**

---

## 7. Troubleshooting et Débogage

### 7.1 Problème : QR Code Ne Scanne Pas

**Symptômes** :
- Caméra OK mais QR Code non détecté
- Message : "Aucun QR Code trouvé"

**Causes Possibles** :
1. ❌ QR Code trop petit ou flou
2. ❌ Éclairage insuffisant
3. ❌ Format QR Code incorrect

**Solutions** :
```javascript
// 1. Vérifier la taille du QR Code
// Min 100×100px, recommandé 200×200px

// 2. Améliorer l'éclairage
// Utiliser flash du téléphone

// 3. Saisie manuelle
// Bouton "Saisie Manuelle" → Entrer numéro commande
```

**Logs Debug** :
```
🔍 [Scanner] Camera initialized
📸 [Scanner] Scanning... (attempt 1)
📸 [Scanner] Scanning... (attempt 2)
❌ [Scanner] No QR Code detected after 10s
💡 Suggestion: Use manual entry
```

---

### 7.2 Problème : Validation QR Code Lente (> 2s)

**Symptômes** :
- Validation prend 3-5 secondes
- Performance dégradée

**Causes Possibles** :
1. ❌ Connexion internet lente
2. ❌ Cache non fonctionnel
3. ❌ Base de données surchargée

**Solutions** :
```javascript
// 1. Vérifier la connexion
navigator.onLine  // true/false

// 2. Vider le cache
localStorage.clear()
location.reload()

// 3. Vérifier les indexes DB
// Voir logs serveur
```

**Logs Debug** :
```
🔍 [Validation] Starting...
⏱️ [Validation] DB Query: 1823ms ⚠️ SLOW
⏱️ [Validation] HMAC Verify: 6ms
⏱️ [Validation] Total: 1829ms ⚠️

💡 Suggestion: Check DB indexes
💡 Suggestion: Enable Redis cache
```

---

### 7.3 Problème : Paiement Carte Échoue (Mode Production)

**Symptômes** :
- Error : "Payment processing failed"
- Code : `NETWORK_ERROR` ou `API_ERROR`

**Causes Possibles** :
1. ❌ Credentials OLA ENERGY invalides
2. ❌ API Key expirée
3. ❌ Webhook URL non configurée
4. ❌ Carte de test incorrecte

**Solutions** :
```bash
# 1. Vérifier credentials
echo $VITE_OLA_TPE_API_KEY
# Doit commencer par "sandbox_ola_" ou "live_ola_"

# 2. Tester connexion API
curl -H "Authorization: Bearer $VITE_OLA_TPE_API_KEY" \
  https://sandbox-api.olaenergy.com/v1/status

# 3. Vérifier webhook configuré
# OLA ENERGY Dashboard → Webhooks → URL doit être active
```

**Logs Debug** :
```
📡 [TPE] Calling OLA ENERGY API...
❌ [API] Error 401: Unauthorized
🔑 API Key: sandbox_ola_xxx...xxx (first 10 chars)

💡 Suggestions:
1. Check API Key in .env.local
2. Regenerate key in OLA Dashboard
3. Ensure sandbox mode matches environment
```

---

### 7.4 Problème : Webhook Non Reçu

**Symptômes** :
- Paiement réussi côté TPE
- Mais statut DB reste `pending`
- Aucun email envoyé

**Causes Possibles** :
1. ❌ Webhook endpoint non déployé
2. ❌ URL incorrecte dans OLA Dashboard
3. ❌ Signature invalide (secret incorrect)

**Solutions** :
```bash
# 1. Vérifier endpoint accessible
curl https://your-app.vercel.app/api/webhooks/tpe
# Doit répondre 405 Method Not Allowed (POST requis)

# 2. Tester webhook manuellement
curl -X POST https://your-app.vercel.app/api/webhooks/tpe \
  -H "Content-Type: application/json" \
  -H "X-OLA-Signature: sha256=test" \
  -d '{"event":"test","transaction_id":"TEST"}'

# 3. Vérifier logs serveur (Vercel/Netlify)
vercel logs
```

**Logs Debug** :
```
// Logs serveur (si webhook reçu)
📨 [Webhook] Received event: payment.approved
🔐 [Webhook] Signature: sha256=abc...
✅ [Webhook] Signature valid
💾 [Webhook] Processing...

// Si webhook non reçu
⚠️ No webhook logs = endpoint not called
💡 Check OLA Dashboard webhook configuration
```

---

### 7.5 Problème : Mode Offline Ne Fonctionne Pas

**Symptômes** :
- Connexion coupée
- Transaction échoue au lieu d'être mise en queue

**Causes Possibles** :
1. ❌ localStorage plein ou bloqué
2. ❌ Service Worker non activé
3. ❌ Feature flag désactivée

**Solutions** :
```javascript
// 1. Vérifier localStorage
if (localStorage.getItem('offlineQueue')) {
  console.log('Offline queue exists');
} else {
  console.log('Offline queue not initialized');
}

// 2. Vérifier Service Worker
navigator.serviceWorker.ready.then(reg => {
  console.log('SW active:', reg.active);
});

// 3. Forcer mode offline
// DevTools → Application → Service Workers → Offline
```

---

## 8. Checklist de Certification

### 8.1 Checklist Fonctionnelle

**Validation QR Code** :
- [ ] Scan QR Code < 2s (✅ TARGET)
- [ ] Rejet QR Code expiré (> 48h)
- [ ] Rejet QR Code déjà utilisé
- [ ] Saisie manuelle fonctionne
- [ ] Validation code 4 chiffres

**Paiements** :
- [ ] Carte Visa/Mastercard (simulation)
- [ ] Carte Visa/Mastercard (production)
- [ ] Mobile Money (simulation)
- [ ] Portefeuille prépayé
- [ ] Recharge hybride (top-up)
- [ ] Rejet solde insuffisant

**Reçus** :
- [ ] Génération PDF < 500ms
- [ ] QR Code intégré (40mm×40mm)
- [ ] Téléchargement PDF
- [ ] Impression thermique 80mm
- [ ] Email automatique

**Mode Offline** :
- [ ] Transactions mises en queue
- [ ] Synchronisation automatique
- [ ] Aucune perte de données
- [ ] Disponibilité 99.9%

---

### 8.2 Checklist Sécurité

**HMAC Signature** :
- [ ] QR Code signés (HMAC-SHA256)
- [ ] Rejet QR non signés
- [ ] Rejet signature invalide
- [ ] Expiration 48h enforcée

**Rate Limiting** :
- [ ] 10 tentatives/heure max
- [ ] Blocage temporaire (1 min)
- [ ] Blocage permanent (10 min)
- [ ] Logs sécurité

**Webhook** :
- [ ] Signature vérifiée (HMAC)
- [ ] Idempotency protection
- [ ] Replay attacks bloqués
- [ ] HTTPS uniquement

---

### 8.3 Checklist Performance

**Temps de Réponse** :
- [ ] Validation QR : < 2s ✅
- [ ] Paiement simulation : 2-3s ✅
- [ ] Paiement production : 1.5-3s ✅
- [ ] Webhook processing : < 500ms ✅

**Charge** :
- [ ] 50 req/sec supportées
- [ ] 10 stations simultanées
- [ ] 99% uptime
- [ ] P95 latency < 2s

---

### 8.4 Checklist Production

**Configuration** :
- [ ] Credentials OLA ENERGY valides
- [ ] Webhook endpoint déployé
- [ ] URL webhook configurée
- [ ] Secret webhook vérifié

**Tests** :
- [ ] 10+ transactions sandbox réussies
- [ ] 5+ cartes de test validées
- [ ] 3+ webhooks reçus
- [ ] 0 erreurs en 24h

**Documentation** :
- [ ] Guide opérateur station créé
- [ ] Runbook incidents disponible
- [ ] Contact support défini
- [ ] SLA documenté (< 2s)

---

## 9. Annexes

### 9.1 Codes d'Erreur TPE

| Code | Nom | Description | Action |
|------|-----|-------------|--------|
| `INVALID_QR` | QR Code invalide | Format incorrect | Scanner à nouveau |
| `EXPIRED_QR` | QR Code expiré | > 48 heures | Créer nouvelle commande |
| `ALREADY_USED` | Déjà utilisé | One-time use | Vérifier historique |
| `ORDER_NOT_FOUND` | Commande introuvable | N'existe pas | Vérifier numéro |
| `SIGNATURE_INVALID` | Signature invalide | HMAC échoué | QR Code falsifié |
| `INSUFFICIENT_FUNDS` | Solde insuffisant | Wallet vide | Recharger wallet |
| `PAYMENT_DECLINED` | Paiement refusé | Carte refusée | Essayer autre carte |
| `NETWORK_ERROR` | Erreur réseau | Connexion perdue | Vérifier internet |
| `API_ERROR` | Erreur API | OLA ENERGY down | Réessayer plus tard |
| `TIMEOUT` | Délai dépassé | > 2 minutes | Réessayer |
| `RATE_LIMIT` | Trop de tentatives | > 10/heure | Attendre 1 heure |

---

### 9.2 Contacts Support

**Support Technique Assur'Trans** :
- Email : support@assurtrans.com
- Téléphone : +221 33 XXX XX XX
- Horaires : 7j/7, 24h/24

**Support OLA ENERGY** :
- Email : api-support@olaenergy.com
- Dashboard : https://dashboard.olaenergy.com
- Documentation : https://docs.olaenergy.com

---

### 9.3 Métriques de Succès

**Performance** :
- ⏱️ Validation QR : **< 2s** (TARGET)
- 💳 Paiement : **< 3s** (simulation), **< 4s** (production)
- 📧 Email : **< 5s** (envoi)
- 🔄 Sync offline : **< 10s** (après reconnexion)

**Fiabilité** :
- ✅ Disponibilité : **99.9%**
- 🔒 Sécurité : **100%** (aucune fraude)
- 📊 Taux de succès : **> 95%**

**Qualité** :
- 🎯 Score utilisateur : **> 4.5/5**
- 📞 Tickets support : **< 5/jour**
- ⏱️ Temps résolution : **< 1h**

---

## 📝 Conclusion

Ce guide couvre **100% des scénarios de test** pour le système TPE OLA ENERGY, de la configuration initiale à la certification production.

**Phases de Test Recommandées** :
1. **Phase 1** : Tests simulation (1-2 jours)
2. **Phase 2** : Configuration production (1 semaine)
3. **Phase 3** : Tests sandbox (1 semaine)
4. **Phase 4** : Certification (2-3 jours)
5. **Phase 5** : Go-live progressif (1-2 stations pilotes)

**Estimation Totale** : **2-3 semaines** de la configuration à la production.

**Prochaines Étapes** :
1. ✅ Commencer par les tests simulation (Section 2)
2. ⏳ Obtenir credentials OLA ENERGY (si pas encore fait)
3. ⏳ Déployer webhook endpoint (Section 4.1)
4. ⏳ Exécuter tests production (Section 3)
5. ⏳ Certification finale (Section 8)

**Bonne chance ! 🚀**
