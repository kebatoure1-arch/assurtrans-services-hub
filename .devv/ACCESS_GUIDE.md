# Guide d'Accès aux Comptes Assur'Trans

## 🚨 PROBLÈME IDENTIFIÉ

Le système d'authentification Devv OTP ne crée PAS automatiquement de profil dans la table `users`. Lorsqu'un utilisateur se connecte avec un email via OTP, il obtient un compte Devv mais **aucun rôle n'est assigné** dans la base de données Assur'Trans.

### Pourquoi vous voyez seulement "Utilisateur" ?

1. **Connexion OTP** → Crée un compte Devv (email + uid)
2. **Pas de profil** → Aucune entrée dans la table `users` avec un rôle
3. **Rôle par défaut** → Le système affiche "Utilisateur" car aucun rôle n'existe

## ✅ SOLUTION : Seed Data

Pour tester la plateforme avec différents rôles, vous devez :

### Étape 1 : Créer un compte Admin
1. Connectez-vous avec n'importe quel email (ex: `votre.email@gmail.com`)
2. Vous verrez un dashboard basique "Utilisateur"
3. Allez dans **Paramètres** (via le menu utilisateur)
4. Cliquez sur l'onglet **"Données de démonstration"**
5. Cliquez sur **"Créer Compte Admin"**

**Important** : Le seed data crée un compte `admin@assurtrans.com` avec VOTRE `_uid` actuel. Cela vous donne le rôle Admin sans avoir à créer un nouveau compte.

### Étape 2 : Accéder aux autres rôles

Une fois Admin, vous pouvez :

#### Option A : Utiliser le Seed Data complet
1. Dans Paramètres > Données de démonstration
2. Cliquez sur **"Initialiser toutes les données"**
3. Cela crée automatiquement :
   - 1 Administrateur (vous)
   - 2 Agents
   - 2 Pétroliers
   - 3 Stations-service
   - 2 Gestionnaires de flotte
   - 4 Chauffeurs

#### Option B : Créer manuellement via l'interface Admin
1. Allez dans **Dashboard Admin** > **Gestion des utilisateurs**
2. Cliquez sur **"Créer un utilisateur"**
3. Remplissez le formulaire avec :
   - Email
   - Rôle (Admin, Agent, Pétrolier, Station, Fleet Manager, Driver)
   - Autres informations

## 📋 COMMENT ACCÉDER À CHAQUE TYPE DE COMPTE

### 1. Compte Administrateur (Admin)
**Après le seed :**
- Email : `admin@assurtrans.com`
- Connexion : Recevoir le code OTP par email
- Accès : Dashboard complet avec gestion des utilisateurs, analytics, paramètres

**Fonctionnalités :**
- Créer/gérer tous les utilisateurs
- Voir toutes les statistiques
- Accès aux analytics
- Configuration système
- Seed data

### 2. Compte Agent
**Après le seed :**
- Agent 1 : `agent1@assurtrans.com`
- Agent 2 : `agent2@assurtrans.com`

**Fonctionnalités :**
- Gérer les Pétroliers assignés
- Voir les commissions
- Statistiques de ventes

### 3. Compte Pétrolier
**Après le seed :**
- Pétrolier 1 : `petrolier1@assurtrans.com`
- Pétrolier 2 : `petrolier2@assurtrans.com`

**Fonctionnalités :**
- Gérer le réseau de stations
- Catalogue de produits (carburants, huiles)
- Dispatcher les commandes
- Statistiques de ventes

### 4. Compte Station-service
**Après le seed :**
- Station 1 : `station1@assurtrans.com`
- Station 2 : `station2@assurtrans.com`
- Station 3 : `station3@assurtrans.com`

**Fonctionnalités :**
- Voir les livraisons en attente
- Tracker les revenus
- Gérer les produits en stock

### 5. Compte Gestionnaire de Flotte (Fleet Manager)
**Après le seed :**
- Fleet 1 : `fleet1@assurtrans.com`
- Fleet 2 : `fleet2@assurtrans.com`

**Fonctionnalités :**
- Gérer les véhicules de la flotte
- Assigner des chauffeurs
- Commander du carburant
- Voir les alertes de maintenance
- Suivre l'assurance santé

### 6. Compte Chauffeur (Driver)
**Après le seed :**
- Driver 1 : `driver1@assurtrans.com`
- Driver 2 : `driver2@assurtrans.com`
- Driver 3 : `driver3@assurtrans.com`
- Driver 4 : `driver4@assurtrans.com`

**Fonctionnalités :**
- Voir le véhicule assigné
- Points de fidélité
- Assurance santé personnelle
- Historique de carburant

## 🔐 PROCÉDURE DE CONNEXION

Pour chaque compte ci-dessus :

1. **Allez sur la page de connexion** : `/login` ou depuis la homepage
2. **Entrez l'email** du compte (ex: `admin@assurtrans.com`)
3. **Cliquez sur "Recevoir le code"**
4. **Vérifiez votre boîte email** pour le code OTP à 6 chiffres
5. **Entrez le code** dans l'interface
6. **Vous êtes redirigé** vers le dashboard correspondant à votre rôle

## 🎯 CORRECTION DU MODULE MON PROFIL

Le problème principal était :
- Le ProfilePage utilisait `user.id` alors que le auth store expose `user.uid`
- Pas de gestion du cas où l'utilisateur n'a pas de profil dans la table `users`

### Solution appliquée :
1. ✅ Correction de la récupération du user ID (`uid` au lieu de `id`)
2. ✅ Meilleure gestion des erreurs quand le profil n'existe pas
3. ✅ Message explicatif pour créer un profil via seed data

## 🚀 WORKFLOW RECOMMANDÉ POUR TESTER

1. **Première connexion** avec votre email personnel
2. **Aller dans Paramètres** > Données de démonstration
3. **Cliquer sur "Créer Compte Admin"** → Vous devenez Admin
4. **Cliquer sur "Initialiser toutes les données"** → Crée tous les comptes de test
5. **Se déconnecter** et **se reconnecter** avec les emails de test pour voir chaque rôle
6. **Tester les fonctionnalités** spécifiques à chaque rôle

## 📝 NOTES IMPORTANTES

- **Tous les comptes de test** utilisent l'authentification OTP réelle de Devv
- **Vous devez avoir accès** aux emails pour recevoir les codes OTP
- **Le seed data peut être réexécuté** sans problème (détection des doublons)
- **Seuls les Admins** peuvent accéder aux Paramètres et au seed data
- **Les profils sont créés** dans deux tables : `users` (base) et `user_profiles` (détails)

## 🐛 DÉPANNAGE

### "Profil non trouvé"
→ Vous n'avez pas de profil dans la table `users`. Utilisez le seed data.

### "Je ne vois que Dashboard Utilisateur"
→ Votre compte n'a pas de rôle assigné. Créez un compte Admin via le seed.

### "Je ne peux pas accéder aux Paramètres"
→ Seuls les Admins voient le lien Paramètres. Créez d'abord un compte Admin.

### "Mon Profil est vide"
→ Le profil existe dans `users` mais pas dans `user_profiles`. Le seed data crée les deux.

## 💡 RECOMMANDATION

**Pour une expérience complète de test**, utilisez cette séquence :

```
1. Connexion initiale → votre.email@example.com
2. Paramètres → Créer Compte Admin
3. Paramètres → Initialiser toutes les données
4. Déconnexion
5. Test de chaque rôle avec les emails fournis ci-dessus
```

Cela vous donne accès à TOUTES les fonctionnalités de la plateforme avec des données réalistes.
