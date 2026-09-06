# 📱 Guide de Configuration SMS/WhatsApp — Assur'Trans©

## 🎯 Vue d'ensemble

Ce guide vous aide à configurer l'envoi de SMS et WhatsApp pour les codes OTP (Sprint 3+ Implementation).

**Date de création** : 2 décembre 2025  
**Sprint** : Sprint 3+ (Real SMS/WhatsApp Integration)  
**Durée estimée** : 30-60 minutes (première fois)

---

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Choix du fournisseur SMS](#choix-du-fournisseur-sms)
3. [Configuration Twilio (Recommandé)](#configuration-twilio)
4. [Configuration Africa's Talking (Marché Africain)](#configuration-africas-talking)
5. [Configuration Vonage](#configuration-vonage)
6. [Configuration Termii](#configuration-termii)
7. [WhatsApp Business API](#whatsapp-business-api)
8. [Variables d'environnement](#variables-denvironnement)
9. [Tests et validation](#tests-et-validation)
10. [Dépannage](#dépannage)

---

## ✅ Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ Un compte chez un fournisseur SMS (Twilio, Africa's Talking, etc.)
- ✅ Un numéro de téléphone dédié (ou sandbox pour tests)
- ✅ Une carte de crédit pour recharger le compte (0.01-0.05 USD/SMS)
- ✅ Accès aux paramètres du projet Devv (Custom API)

---

## 🎯 Choix du fournisseur SMS

### Comparaison des fournisseurs

| Fournisseur | Couverture | Prix/SMS | Avantages | Inconvénients |
|-------------|-----------|----------|-----------|---------------|
| **Twilio** | Mondiale | 0.04 USD | Fiabilité 99.95%, WhatsApp intégré | Plus cher |
| **Africa's Talking** | Afrique | 0.01-0.03 USD | Optimisé Afrique, moins cher | Afrique uniquement |
| **Vonage** | Mondiale | 0.03 USD | Bonne couverture Europe/Afrique | Configuration complexe |
| **Termii** | Afrique de l'Ouest | 0.02 USD | Spécialisé Nigeria/Ghana | Couverture limitée |

### Recommandations par marché

- 🌍 **Mali, Sénégal, Burkina Faso** → **Africa's Talking** (meilleur rapport qualité/prix)
- 🌎 **International / Multi-pays** → **Twilio** (couverture mondiale)
- 🇳🇬 **Nigeria, Ghana** → **Termii** (spécialisé, moins cher)
- 🇪🇺 **Europe + Afrique** → **Vonage** (bon compromis)

---

## 🚀 Configuration Twilio (Recommandé)

### Étape 1 : Créer un compte Twilio

1. Allez sur [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Créez un compte (email + mot de passe)
3. Vérifiez votre numéro de téléphone
4. Vous recevez **15 USD de crédit gratuit** 🎉

### Étape 2 : Obtenir vos identifiants

1. Accédez à votre [Console Twilio](https://console.twilio.com)
2. Notez ces informations :
   - **Account SID** : `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token** : (cliquez sur "Show" pour afficher)

### Étape 3 : Obtenir un numéro de téléphone

#### **Mode Sandbox (Gratuit, limité à 5 numéros)**
1. Dans la console, allez à **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Ajoutez votre numéro de test
3. Vérifiez via SMS (code à 6 chiffres)
4. Numéro Twilio par défaut : `+15005550006` (sandbox)

#### **Mode Production (Payant, illimité)**
1. Rechargez votre compte (minimum 20 USD)
2. Allez à **Phone Numbers** → **Buy a Number**
3. Choisissez un pays (Mali : +223, Sénégal : +221)
4. Sélectionnez un numéro avec capacité **SMS**
5. Coût : ~1-3 USD/mois + 0.04 USD/SMS

### Étape 4 : Configuration dans Assur'Trans©

**Méthode 1 : Variables d'environnement** (Développement)
```bash
# Copiez .env.example vers .env
cp .env.example .env

# Éditez .env et ajoutez :
VITE_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_TWILIO_AUTH_TOKEN=your_auth_token_here
VITE_TWILIO_PHONE_NUMBER=+15005550006  # Votre numéro Twilio
```

**Méthode 2 : Custom API Settings** (Production - Recommandé)
1. Ouvrez votre projet Devv
2. Allez dans **Settings** → **Custom API**
3. Ajoutez un nouveau service :
   - **Service Name** : `twilio`
   - **Base URL** : `https://api.twilio.com/2010-04-01`
   - **Auth Type** : `Basic Auth`
   - **Username** : Votre `Account SID`
   - **Password** : Votre `Auth Token`

### Étape 5 : Test rapide

```typescript
// Dans la console développeur (F12)
import { sendSMS } from '@/services/sms-notification-service';

await sendSMS('+22377123456', 'Test SMS Assur\'Trans', 'twilio');
// ✅ Vous devriez recevoir le SMS
```

---

## 🌍 Configuration Africa's Talking (Marché Africain)

### Pourquoi Africa's Talking ?

- ✅ **70% moins cher** que Twilio pour l'Afrique
- ✅ Couverture optimale : Mali, Sénégal, Burkina Faso, Côte d'Ivoire, etc.
- ✅ Latence réduite (serveurs en Afrique)
- ✅ Support local en français
- ❌ Afrique uniquement (pas d'Europe/Amérique)

### Étape 1 : Créer un compte

1. Allez sur [https://account.africastalking.com/auth/register](https://account.africastalking.com/auth/register)
2. Créez un compte (email + mot de passe)
3. Vérifiez votre email
4. Vous recevez **100 SMS gratuits** en mode sandbox 🎉

### Étape 2 : Obtenir vos identifiants

1. Connectez-vous à votre [Dashboard](https://account.africastalking.com)
2. Allez dans **Settings** → **API Key**
3. Générez une nouvelle clé API
4. Notez :
   - **Username** : `sandbox` (ou votre nom d'app en production)
   - **API Key** : `atsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Étape 3 : Mode Production (Optionnel)

1. Allez dans **Settings** → **Go Live**
2. Remplissez le formulaire de vérification (nom entreprise, adresse, etc.)
3. Approuvé en 24-48h
4. Rechargez votre compte (minimum 10 USD)
5. Nouveau username : `AssurTrans` (ou votre nom d'app)

### Étape 4 : Configuration dans Assur'Trans©

```bash
# Dans .env
VITE_AFRICAS_TALKING_API_KEY=atsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AFRICAS_TALKING_USERNAME=sandbox  # ou 'AssurTrans' en production
```

### Étape 5 : Test rapide

```typescript
await sendSMS('+22377123456', 'Test SMS Africa\'s Talking', 'africas-talking');
```

---

## 📱 WhatsApp Business API

### Option 1 : Via Twilio (Plus simple)

1. Dans votre console Twilio, allez à **Messaging** → **Try it out** → **Try WhatsApp**
2. Suivez le guide de configuration (5 minutes)
3. Activez le sandbox WhatsApp :
   - Envoyez `join <code>` au numéro Twilio WhatsApp
   - Exemple : `join agree-stone` à `+1 415 523 8886`
4. Votre numéro est maintenant whitelisté

**Configuration** :
```bash
VITE_TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Numéro sandbox
```

**Mode Production** :
- Demandez l'approbation WhatsApp (processus 2-4 semaines)
- Coût : 1 USD/mois + 0.005 USD/message (90% moins cher que SMS!)

### Option 2 : WhatsApp Business API Direct (Avancé)

1. Créez un compte [Meta Business](https://business.facebook.com)
2. Demandez l'accès à l'API WhatsApp Business
3. Approuvé après vérification (2-4 semaines)
4. Coût : 0.005 USD/message

---

## 🔧 Variables d'environnement

### Fichier `.env` complet

Copiez `.env.example` vers `.env` et remplissez vos valeurs :

```bash
# === TWILIO ===
VITE_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_TWILIO_AUTH_TOKEN=your_auth_token_here
VITE_TWILIO_PHONE_NUMBER=+15005550006
VITE_TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# === AFRICA'S TALKING ===
VITE_AFRICAS_TALKING_API_KEY=atsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AFRICAS_TALKING_USERNAME=sandbox

# === DEFAULT PROVIDER ===
VITE_DEFAULT_SMS_PROVIDER=twilio  # ou 'africas-talking'
VITE_DEFAULT_COUNTRY_CODE=223     # Mali (223), Senegal (221)
```

### Sécurité : Custom API (Production)

⚠️ **IMPORTANT** : En production, configurez les clés API via **Devv Custom API Settings** au lieu de `.env` pour éviter l'exposition côté client.

---

## ✅ Tests et validation

### Test 1 : Envoi SMS simple

```typescript
import { sendSMS } from '@/services/sms-notification-service';

// Test avec votre numéro
const result = await sendSMS(
  '+22377123456',  // Votre numéro au format +[code][numéro]
  'Test SMS Assur\'Trans - Si vous recevez ceci, tout fonctionne!',
  'twilio'  // ou 'africas-talking'
);

console.log(result);
// ✅ { success: true, messageId: 'SMxxx...', message: 'SMS envoyé...' }
```

### Test 2 : Envoi OTP complet

```typescript
import { sendOTPNotification } from '@/services/sms-notification-service';

const result = await sendOTPNotification(
  '+22377123456',
  '123456',  // Code OTP
  'CMD-2024-001',  // Numéro de commande
  { preferWhatsApp: true, provider: 'twilio' }
);

console.log(result);
// ✅ Vous recevez SMS/WhatsApp avec "Votre code OTP... est: 123456"
```

### Test 3 : Workflow OTP complet

1. Ouvrez l'app → Fuel Ordering → Nouvelle commande
2. Entrez votre numéro de téléphone
3. Cliquez sur "Scanner QR Code"
4. Cliquez sur "Utiliser OTP à la place"
5. Le dialog OTP s'ouvre et génère un OTP
6. ✅ Vous recevez le SMS/WhatsApp
7. Entrez le code à 6 chiffres
8. ✅ Validation réussie

---

## 🛠️ Dépannage

### Problème 1 : "SMS not sent" (Erreur 21211)

**Cause** : Numéro de téléphone invalide

**Solutions** :
- Vérifiez le format E.164 : `+[code pays][numéro]`
  - ✅ Bon : `+22377123456` (Mali)
  - ❌ Mauvais : `77123456`, `0077123456`, `223-77-123456`
- Utilisez la fonction `formatPhoneNumber()` :
  ```typescript
  import { formatPhoneNumber } from '@/services/sms-notification-service';
  const formatted = formatPhoneNumber('77123456', '223');
  // → '+22377123456'
  ```

### Problème 2 : "Insufficient funds" (21614)

**Cause** : Crédit insuffisant sur votre compte

**Solutions** :
- Twilio : Rechargez minimum 20 USD
- Africa's Talking : Rechargez minimum 10 USD
- Mode sandbox : Limitez les tests aux numéros vérifiés

### Problème 3 : WhatsApp "Template not approved"

**Cause** : Message non conforme aux politiques WhatsApp

**Solutions** :
- Utilisez des templates pré-approuvés pour la production
- En sandbox, envoyez d'abord `join <code>` depuis votre téléphone
- Vérifiez que le numéro est whitelisté dans la console Twilio

### Problème 4 : "Custom API not configured"

**Cause** : Clés API non configurées ou incorrectes

**Solutions** :
1. Vérifiez que `.env` existe et contient les clés
2. Redémarrez le serveur de développement (`npm run dev`)
3. En production, vérifiez Custom API Settings dans Devv
4. Testez les clés directement via Postman/curl

### Problème 5 : SMS reçu après 30+ secondes

**Cause** : Latence réseau ou saturation opérateur

**Solutions** :
- Africa's Talking : Passez en mode production (serveurs en Afrique)
- Twilio : Vérifiez le statut du message dans la console (delivered/failed)
- Vérifiez la qualité réseau du destinataire

---

## 📊 Monitoring et Analytics

### Twilio Console

1. Allez à **Monitor** → **Logs** → **Messaging**
2. Voir tous les SMS envoyés avec statut (delivered, failed, etc.)
3. Filtrer par date, numéro, statut

### Africa's Talking Dashboard

1. Allez à **SMS** → **Sent Messages**
2. Voir l'historique complet avec détails
3. Export CSV pour analyse

### Assur'Trans© Logs

```typescript
// Activer les logs détaillés
localStorage.setItem('debug', 'sms:*');

// Voir les logs dans la console (F12)
// ✅ 📱 Sending SMS via twilio to +22377123456
// ✅ ✅ Twilio SMS sent successfully: SMxxx...
```

---

## 💰 Estimation des coûts

### Scénario Mali (1000 commandes/mois)

**Option 1 : Twilio**
- SMS : 1000 × 0.04 USD = **40 USD/mois**
- WhatsApp : 1000 × 0.005 USD = **5 USD/mois** (87% économie!)
- Numéro : 3 USD/mois
- **Total** : 43 USD/mois (SMS) ou **8 USD/mois** (WhatsApp)

**Option 2 : Africa's Talking**
- SMS : 1000 × 0.02 USD = **20 USD/mois**
- Pas de frais mensuels
- **Total** : **20 USD/mois** (53% économie vs Twilio SMS)

### ROI Business

- **Taux de réussite transaction** : 85% → 99% (+14%)
- **Transactions sauvées** : 140/mois
- **Revenu additionnel** : 140 × 20 USD = **2,800 USD/mois**
- **Coût SMS** : 20-40 USD/mois
- **ROI net** : **2,760 USD/mois** 🚀

---

## 🎯 Prochaines étapes

Après avoir configuré SMS/WhatsApp :

1. ✅ **Test en staging** : Vérifiez que tout fonctionne (5-10 tests)
2. ✅ **Mode Production** : Passez du sandbox au compte live
3. ✅ **Monitoring** : Configurez des alertes pour échecs SMS
4. ✅ **Optimisation** : Privilégiez WhatsApp (90% moins cher que SMS)
5. ✅ **Scaling** : Configurez auto-scaling si > 10,000 SMS/mois

---

## 📚 Ressources supplémentaires

### Documentation officielle

- **Twilio SMS** : [https://www.twilio.com/docs/sms](https://www.twilio.com/docs/sms)
- **Twilio WhatsApp** : [https://www.twilio.com/docs/whatsapp](https://www.twilio.com/docs/whatsapp)
- **Africa's Talking** : [https://developers.africastalking.com/docs/sms/overview](https://developers.africastalking.com/docs/sms/overview)
- **Vonage SMS** : [https://developer.vonage.com/messaging/sms/overview](https://developer.vonage.com/messaging/sms/overview)
- **Termii** : [https://developers.termii.com/](https://developers.termii.com/)

### Support

- **Twilio Support** : [https://support.twilio.com](https://support.twilio.com)
- **Africa's Talking Support** : support@africastalking.com
- **Assur'Trans©** : Consultez `.devv/SPRINT3_OTP_FALLBACK_SYSTEM.md`

---

## ✅ Checklist de configuration

Cochez après avoir complété chaque étape :

- [ ] Compte créé chez un fournisseur SMS (Twilio/Africa's Talking)
- [ ] Identifiants API obtenus (Account SID, Auth Token, etc.)
- [ ] Numéro de téléphone configuré (sandbox ou production)
- [ ] Variables d'environnement ajoutées dans `.env`
- [ ] Test SMS simple réussi (`sendSMS()`)
- [ ] Test OTP complet réussi (`sendOTPNotification()`)
- [ ] WhatsApp configuré (si applicable)
- [ ] Monitoring activé (logs Twilio/Africa's Talking)
- [ ] Mode production activé (comptes rechargés)
- [ ] Documentation équipe complétée

---

**Date de dernière mise à jour** : 2 décembre 2025  
**Version** : 1.0.0  
**Auteur** : Devv Code Assistant  
**Sprint** : Sprint 3+ (Real SMS/WhatsApp Integration)

