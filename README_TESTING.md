# 🎯 Guide de test : Création automatique de profil

## 🚀 Test rapide (2 minutes)

### Étape 1 : Connexion avec un nouvel email

1. Ouvrir l'application
2. Cliquer sur "Se connecter" ou aller sur `/login`
3. Entrer un **nouvel email** (jamais utilisé avant) :
   ```
   test.utilisateur@gmail.com
   ```
4. Cliquer "Recevoir le code"
5. Vérifier votre boîte mail et entrer le code OTP (6 chiffres)

### Étape 2 : Sélection du rôle

**✨ Le dialogue de sélection apparaît automatiquement !**

Vous verrez 6 options de rôle :

| Rôle | Icône | Couleur | Description |
|------|-------|---------|-------------|
| 🛡️ Administrateur | Shield | Violet | Gestion complète de la plateforme |
| 👥 Agent | Users | Bleu | Gestion des pétroliers et revenus |
| 🏢 Pétrolier | Building | Vert | Gestion du réseau de stations |
| 🏪 Station-service | Store | Orange | Gestion des livraisons |
| 🚛 Chef de flotte | Truck | Indigo | Gestion véhicules et chauffeurs |
| 👤 Chauffeur | User | Turquoise | Commandes carburant et assurance |

### Étape 3 : Confirmer et continuer

1. Cliquer sur une carte de rôle → Elle devient verte avec un badge ✓
2. Cliquer "Continuer"
3. Voir "Création du profil..." avec spinner
4. **Navigation automatique vers le Dashboard**
5. Message de succès : "✨ Profil créé avec succès ! Bienvenue [Prénom], votre compte [rôle] est prêt"

### Étape 4 : Vérifier le profil

1. Cliquer sur votre avatar en haut à droite du Dashboard
2. Cliquer "Mon Profil"
3. **✅ Vous devriez voir votre profil sans erreur**

---

## 🎨 Ce qui est créé automatiquement

### Pour tous les rôles :
✅ Compte utilisateur (table `users`)  
✅ Profil étendu (table `user_profiles`)  
✅ Extraction du nom depuis l'email (ex: jean.dupont@mail.com → Jean Dupont)

### Pour non-admins :
✅ Wallet prépayé (balance : 0 XOF)

### Pour chauffeurs uniquement :
✅ Wallet prépayé (balance : 0 XOF)  
✅ Points de fidélité (tier : Bronze, points : 0)

---

## 🔍 Vérification technique

### Console du navigateur (F12)

Après la création du profil, vous devriez voir ces messages :

```
✅ User profile created in users table
✅ User profile created in user_profiles table
✅ Wallet created for user          (si non-admin)
✅ Loyalty points created for driver (si chauffeur)
```

### Base de données

Vérifier que les entrées ont été créées dans les tables :

1. **Table users** (f4eyoj5l0wzk)
   - Champ `_uid` : ID Devv de l'utilisateur
   - Champ `email` : Email de connexion
   - Champ `role` : Rôle choisi
   - Champ `firstName` et `lastName` : Nom extrait de l'email

2. **Table user_profiles** (f4eyoj561clc)
   - Champ `_uid` : ID Devv de l'utilisateur
   - Champ `userId` : Référence au user

3. **Table wallets** (f4f186q7i03k) - Si non-admin
   - Champ `balance` : 0
   - Champ `currency` : XOF

4. **Table loyalty_points** (f4fb4hcl1vvk) - Si chauffeur
   - Champ `points` : 0
   - Champ `tier` : bronze

---

## 🧪 Scénarios de test avancés

### Test 1 : Utilisateur existant (reconnexion)

**Email :** Un email déjà utilisé

**Résultat attendu :**
- ❌ PAS de dialogue de sélection de rôle
- ✅ Navigation directe vers le Dashboard
- ✅ Message : "🎉 Connexion réussie ! Bienvenue sur Assur'Trans"

### Test 2 : Extraction de nom depuis différents formats d'email

| Email | Prénom attendu | Nom attendu |
|-------|---------------|-------------|
| jean.dupont@mail.com | Jean | Dupont |
| marie_claire@mail.com | Marie | Claire |
| ahmed-barry@mail.com | Ahmed | Barry |
| fatou@mail.com | Fatou | [vide] |
| mohamed.ali.sow@mail.com | Mohamed | Ali Sow |

### Test 3 : Création pour chaque type de rôle

Tester avec des emails différents pour chaque rôle :

```
admin.test@mail.com       → Administrateur (wallet: NON, loyalty: NON)
agent.test@mail.com       → Agent (wallet: OUI, loyalty: NON)
petrolier.test@mail.com   → Pétrolier (wallet: OUI, loyalty: NON)
station.test@mail.com     → Station (wallet: OUI, loyalty: NON)
fleet.test@mail.com       → Fleet Manager (wallet: OUI, loyalty: NON)
driver.test@mail.com      → Chauffeur (wallet: OUI, loyalty: OUI)
```

### Test 4 : Gestion des erreurs

**Test de code OTP invalide :**
- Entrer un mauvais code → Message "Code invalide"
- Dialogue de sélection NE DOIT PAS apparaître

**Test d'échec de création de profil :**
- Si erreur réseau → Message d'erreur
- Dialogue reste ouvert pour réessayer
- Bouton "Continuer" redevient cliquable

---

## ✅ Critères de succès

Le test est réussi si **TOUS** les points suivants sont validés :

- [ ] Le dialogue de sélection apparaît après OTP pour nouveaux utilisateurs
- [ ] Les 6 rôles sont affichés avec icônes et couleurs correctes
- [ ] La sélection visuelle fonctionne (bordure verte + badge ✓)
- [ ] Le bouton "Continuer" est désactivé tant qu'aucun rôle n'est sélectionné
- [ ] La création du profil se fait sans erreur
- [ ] La navigation vers le dashboard est automatique
- [ ] Le message de succès contient le prénom et le rôle
- [ ] "Mon Profil" fonctionne immédiatement sans erreur "Utilisateur non trouvé"
- [ ] Le wallet est créé pour les non-admins
- [ ] Les points de fidélité sont créés pour les chauffeurs
- [ ] Les utilisateurs existants vont directement au dashboard

---

## 🐛 Problèmes possibles et solutions

### Problème : Le dialogue ne s'affiche pas

**Causes possibles :**
1. L'email a déjà été utilisé → Essayer avec un nouvel email
2. Erreur JavaScript → Vérifier la console (F12)
3. Problème de vérification OTP → Vérifier que l'OTP est correct

**Solution :**
- Utiliser un email complètement nouveau
- Vérifier qu'il n'y a pas d'erreur dans la console
- Rafraîchir la page et réessayer

### Problème : "Utilisateur non trouvé" après création

**Causes possibles :**
1. Erreur lors de la création dans la table `users`
2. Problème de connexion réseau

**Solution :**
- Vérifier les logs dans la console (devrait afficher ✅ messages)
- Rafraîchir la page
- Se reconnecter avec le même email

### Problème : Erreur pendant la création

**Causes possibles :**
1. Problème de connexion réseau
2. Tables manquantes ou permissions incorrectes

**Solution :**
- Vérifier que les tables existent (voir STRUCTURE.md)
- Réessayer en cliquant à nouveau "Continuer"
- Vérifier les messages d'erreur dans la console

---

## 📊 Temps estimés

| Action | Temps estimé |
|--------|--------------|
| Test basique (1 rôle) | 2-3 minutes |
| Test de tous les rôles (6) | 12-18 minutes |
| Test avec vérification BD | 5-10 minutes |
| Test complet (tous scénarios) | 30-45 minutes |

---

## 📚 Documentation complémentaire

Pour plus de détails techniques :

1. **`.devv/TEST_LOGIN_FLOW.md`** - Scénarios de test détaillés (18+ tests)
2. **`.devv/TESTING_QUICK_START.md`** - Guide ultra-rapide (2 minutes)
3. **`.devv/IMPLEMENTATION_STATUS.md`** - État complet de l'implémentation
4. **`.devv/STRUCTURE.md`** - Architecture technique de la plateforme

---

## 🎉 Résultat final

**Avec cette implémentation :**
- ✅ Plus besoin de seed data pour créer son profil
- ✅ Plus d'erreur "Utilisateur non trouvé"
- ✅ Onboarding fluide en 3 étapes (Email → OTP → Rôle)
- ✅ Expérience utilisateur professionnelle et polie
- ✅ Création automatique de toutes les données nécessaires

**Le workflow est maintenant :**
```
Nouvel utilisateur → Email → OTP → Choix du rôle → Dashboard ✅
Utilisateur existant → Email → OTP → Dashboard ✅
```

Simple. Rapide. Efficace. 🚀

---

**Date de création :** 18 novembre 2025  
**Version de la plateforme :** Assur'Trans© 1.0  
**Statut :** Production Ready ✅
