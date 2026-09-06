# Assur'Trans© - Guide d'Utilisation

## 🚀 Bienvenue sur Assur'Trans

Plateforme digitale complète de services carburant et d'assurance santé pour les chauffeurs et gestionnaires de flottes africains.

---

## 🎉 NOUVEAU : Création Automatique de Profil

### Plus besoin de seed data pour commencer !

Désormais, lorsque vous vous connectez pour la première fois, la plateforme :

1. **Vérifie votre email** → Envoi du code OTP
2. **Valide le code OTP** → Authentification réussie
3. **Affiche automatiquement le dialogue de sélection de rôle** ✨
4. **Crée votre profil complet** (compte, wallet, points de fidélité selon le rôle)
5. **Vous redirige vers votre dashboard personnalisé**

**Plus d'erreur "Utilisateur non trouvé" !**

---

## 🚀 Guide de Démarrage Rapide (2 minutes)

### Étape 1 : Première Connexion
1. Allez sur la page de **Connexion**
2. Entrez votre adresse email (ex: jean.dupont@gmail.com)
3. Recevez et entrez le code OTP à 6 chiffres
4. **🎉 Le dialogue de sélection de rôle apparaît automatiquement**

### Étape 2 : Choisir Votre Rôle

Sélectionnez parmi 6 options :

| Rôle | Description | Fonctionnalités |
|------|-------------|-----------------|
| 🛡️ **Administrateur** | Gestion complète de la plateforme | Tous les accès + paramètres système |
| 👥 **Agent** | Gestion des pétroliers et revenus | Création de pétroliers, suivi commissions |
| 🏢 **Pétrolier** | Gestion du réseau de stations | Gestion produits, dispatch commandes |
| 🏪 **Station-service** | Gestion des livraisons | Réception commandes, suivi stock |
| 🚛 **Chef de flotte** | Gestion véhicules et chauffeurs | Gestion flotte, commandes carburant |
| 👤 **Chauffeur** | Commandes carburant et assurance | Commandes, fidélité, assurance |

### Étape 3 : Confirmation
1. Cliquez sur une carte de rôle → Elle devient verte ✓
2. Cliquez **"Continuer"**
3. Votre profil est créé automatiquement avec :
   - ✅ Compte utilisateur
   - ✅ Profil étendu
   - ✅ Wallet prépayé (si non-admin)
   - ✅ Points de fidélité (si chauffeur)
4. **Navigation automatique vers votre Dashboard**

### Étape 4 : Profiter de la Plateforme
- ✅ Votre profil est accessible via "Mon Profil"
- ✅ Toutes les fonctionnalités de votre rôle sont activées
- ✅ Vous pouvez commencer à utiliser la plateforme immédiatement

---

## 📚 Test de la Création Automatique

**Pour tester :** Voir le guide complet dans **`README_TESTING.md`**

**Test rapide :**
1. Utilisez un nouvel email (jamais utilisé)
2. Entrez le code OTP
3. Vérifiez que le dialogue de sélection apparaît
4. Choisissez un rôle et continuez
5. Vérifiez que "Mon Profil" fonctionne sans erreur

---

## 🎯 Seed Data (OPTIONNEL)

Le seed data est désormais **optionnel** et sert uniquement à :
- Tester plusieurs rôles avec des données de démonstration
- Créer un environnement de test complet
- Initialiser le catalogue de produits et stations

### Pour Initialiser les Données de Démonstration

1. Connectez-vous en tant qu'**Administrateur**
2. Allez dans **Paramètres > Données de démonstration**
3. Cliquez sur **"Initialiser toutes les données"**

**Cela crée automatiquement :**
- ✅ 5 produits (Essence, Gasoil, Huiles)
- ✅ 3 stations-service (Dakar)
- ✅ 4 plans d'assurance santé
- ✅ 6 prestataires de santé
- ✅ 5 niveaux de fidélité (Bronze → Diamant)

---

## 👥 Gestion des Utilisateurs (Administrateurs)

### Créer des Utilisateurs pour Différents Rôles

Après avoir initialisé les données, vous pouvez créer manuellement des comptes pour chaque rôle via l'interface Admin :

1. **Dashboard Admin** → **Gestion des utilisateurs**
2. Cliquez sur **"Créer un utilisateur"**
3. Sélectionnez le rôle désiré :
   - Administrateur
   - Agent
   - Pétrolier
   - Station-service
   - Gestionnaire de flotte
   - Chauffeur

### Option B : Connexion avec les Comptes de Test

Vous pouvez également créer manuellement des comptes via l'interface :

#### 1. 👨‍💼 Compte Administrateur (Admin)
**Fonctionnalités :**
- Gestion complète des utilisateurs (tous rôles)
- Analytics et rapports complets
- Configuration système
- Accès à toutes les fonctionnalités

**Dashboard :**
- Statistiques plateforme complète
- Gestion des utilisateurs
- Analytics avancés
- Paramètres système

---

#### 2. 👔 Compte Agent
**Fonctionnalités :**
- Gérer les Pétroliers assignés
- Voir les commissions
- Statistiques de ventes par pétrolier

**Dashboard :**
- Liste des pétroliers gérés
- Suivi des commissions
- Statistiques de performance

---

#### 3. 🏭 Compte Pétrolier
**Fonctionnalités :**
- Gérer le réseau de stations
- Catalogue de produits (carburants, huiles, fluides)
- Dispatcher les commandes aux stations
- Statistiques de ventes

**Dashboard :**
- Gestion du réseau de stations
- Catalogue produits
- Dispatch des commandes
- Revenus et statistiques

---

#### 4. ⛽ Compte Station-service
**Fonctionnalités :**
- Voir les livraisons en attente
- Tracker les revenus journaliers
- Gérer les stocks de produits

**Dashboard :**
- Livraisons en attente
- Stock disponible
- Revenus du jour
- Historique des transactions

---

#### 5. 🚛 Compte Gestionnaire de Flotte
**Fonctionnalités :**
- Gérer les véhicules de la flotte
- Assigner des chauffeurs aux véhicules
- Commander du carburant en gros
- Suivre les alertes de maintenance
- Gérer l'assurance santé de l'équipe

**Dashboard :**
- Vue d'ensemble de la flotte
- Liste des véhicules
- Gestion des chauffeurs
- Alertes de maintenance
- Wallet prépayé

---

#### 6. 🚗 Compte Chauffeur (Driver)
**Fonctionnalités :**
- Voir le véhicule assigné
- Consulter les points de fidélité
- Gérer l'assurance santé personnelle
- Historique de carburant

**Dashboard :**
- Véhicule assigné
- Points de fidélité et récompenses
- Assurance santé
- Activité récente

---

## 🔐 Procédure de Connexion

Pour **tout compte** créé dans le système :

1. **Page de connexion** : Cliquez sur "Connexion" depuis la homepage
2. **Entrez l'email** du compte
3. **Recevez le code OTP** par email (vérifiez spam/courrier indésirable)
4. **Entrez le code** à 6 chiffres
5. **Accédez au dashboard** correspondant à votre rôle

---

## 🏗️ Architecture des Rôles

```
Admin
  ├── Agent
  │   └── Pétrolier
  │       └── Station-service
  │
  └── Gestionnaire de Flotte
      └── Chauffeur
```

### Hiérarchie :
- **Admin** : Gère TOUT
- **Agent** : Gère les Pétroliers
- **Pétrolier** : Gère les Stations
- **Station** : Exécute les livraisons
- **Fleet Manager** : Gère les véhicules et chauffeurs
- **Chauffeur** : Utilise les services

---

## 📱 Modules de la Plateforme

### 1. 🔐 Authentification
- Connexion sécurisée par Email + OTP
- Pas de mot de passe à retenir
- Session persistante

### 2. ⛽ Gestion Carburant
- Wallet prépayé
- Commandes en gros
- Suivi des livraisons
- Catalogue produits

### 3. 🏥 Assurance Santé
- 4 plans (Basic → Famille)
- Souscription en ligne
- Suivi des sinistres
- Réseau de 6 types de prestataires

### 4. 🎁 Programme de Fidélité
- 5 niveaux (Bronze → Diamant)
- Points sur achats carburant et assurance
- Catalogue de récompenses
- Avantages exclusifs

### 5. 💳 Paiements Mobile Money
- MTN Money
- Orange Money
- Wave
- Historique complet

### 6. 📊 Analytics (Admin uniquement)
- Tendances des revenus
- Performance des produits
- Croissance utilisateurs
- Statistiques d'assurance
- Exports CSV

---

## 🐛 Dépannage

### ❌ "Profil non trouvé"
**Cause :** Votre compte OTP n'a pas de profil dans la base de données.

**Solution :**
1. Allez dans **Paramètres**
2. Cliquez sur **"Créer Compte Admin"**
3. Puis **"Initialiser toutes les données"**

---

### ❌ "Je ne peux pas accéder aux Paramètres"
**Cause :** Seuls les Admins ont accès aux Paramètres.

**Solution :**
1. Si vous voyez le menu Paramètres → créez d'abord le compte Admin
2. Si vous n'êtes pas Admin → demandez à un Admin de vous créer un profil

---

### ❌ "Mon Profil est vide"
**Cause :** Le profil existe dans la table `users` mais pas dans `user_profiles`.

**Solution :**
- Utilisez l'interface Admin pour créer un profil complet
- Ou réinitialisez avec le seed data

---

### ❌ "Je ne reçois pas le code OTP"
**Solutions :**
1. Vérifiez votre dossier **spam/courrier indésirable**
2. Attendez 1-2 minutes (délai d'envoi possible)
3. Cliquez sur **"Renvoyer le code"**
4. Vérifiez l'orthographe de votre email

---

## 🎯 Workflow Recommandé pour Tester

```
1. Connexion initiale avec votre email
   ↓
2. Paramètres → Créer Compte Admin
   ↓
3. Paramètres → Initialiser toutes les données
   ↓
4. Dashboard Admin → Créer des utilisateurs de test
   ↓
5. Déconnexion
   ↓
6. Reconnexion avec différents rôles pour tester
```

---

## 💡 Conseils d'Utilisation

### Pour les Tests
- Créez d'abord le compte Admin
- Utilisez les données de seed pour une démo complète
- Testez chaque rôle pour voir les différentes interfaces

### Pour la Production
- Créez manuellement chaque utilisateur via l'interface Admin
- Assignez les rôles selon la hiérarchie de votre organisation
- Configurez les produits et stations selon vos besoins réels

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Consultez le fichier `.devv/ACCESS_GUIDE.md` pour plus de détails
2. Vérifiez la console du navigateur pour les erreurs
3. Assurez-vous d'avoir bien suivi toutes les étapes de configuration

---

## 🌍 Langues

Interface en **Français** 🇫🇷

---

## 🎨 Design

- **Couleur principale :** Sage Green (#789D9A)
- **Style :** Moderne Minimaliste avec touches culturelles africaines
- **Responsive :** Mobile-first, optimisé pour tous les écrans
- **Animations :** Fluides et subtiles

---

## 🔒 Sécurité

- Authentification Email OTP (pas de mots de passe)
- Routes protégées par rôle
- Validation côté client et serveur
- Sessions sécurisées

---

## 📝 Notes Techniques

- **Framework :** React 18 + TypeScript + Vite
- **UI :** Tailwind CSS + shadcn/ui
- **Backend :** Devv Table Database (NoSQL)
- **Auth :** Devv Authentication (Email OTP)
- **State :** Zustand avec persistence localStorage

---

**Construit avec ❤️ pour les chauffeurs et gestionnaires de flottes africains**

🚀 **Assur'Trans** - Votre partenaire de confiance pour le carburant et l'assurance santé
