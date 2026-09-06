# 🚀 Guide de démarrage rapide - Assur'Trans©

## ✨ Nouveau flux de connexion automatique

### Pour les nouveaux utilisateurs

Vous pouvez maintenant créer votre compte en **3 étapes simples** :

#### 1️⃣ Entrez votre email
- Accédez à la page de connexion
- Entrez votre adresse email (ex: `prenom.nom@exemple.com`)
- Cliquez sur **"Recevoir le code"**

#### 2️⃣ Vérifiez votre code OTP
- Consultez votre boîte mail
- Entrez le code à 6 chiffres
- Cliquez sur **"Se connecter"**

#### 3️⃣ Choisissez votre rôle ✨ NOUVEAU
**Un dialogue s'affiche automatiquement** avec 6 options :

| Rôle | Description | Fonctionnalités principales |
|------|-------------|----------------------------|
| 🛡️ **Administrateur** | Gestion complète de la plateforme | Tous les modules, analytics, settings |
| 👥 **Agent** | Gestion des pétroliers et revenus | Création pétroliers, commissions |
| 🏢 **Pétrolier** | Gestion du réseau de stations | Stations, produits, dispatch |
| 🏪 **Station-service** | Gestion des livraisons | Commandes, livraisons |
| 🚛 **Chef de flotte** | Gestion de véhicules et chauffeurs | Véhicules, maintenance, chauffeurs |
| 👤 **Chauffeur** | Commandes carburant et assurance | Commandes, assurance, fidélité |

**C'est tout !** Votre profil est créé automatiquement et vous êtes redirigé vers votre tableau de bord.

---

## 🎯 Ce qui est créé automatiquement

### Lors de la sélection du rôle :

1. **Profil utilisateur** dans la table `users`
   - Nom et prénom extraits de votre email
   - Rôle sélectionné
   - Statut actif

2. **Profil étendu** dans la table `user_profiles`
   - Champs personnalisables (bio, contact d'urgence)
   - Champs spécifiques au rôle (licence, véhicule, etc.)

3. **Portefeuille prépayé** (si vous n'êtes pas admin)
   - Balance initiale : 0 XOF
   - Prêt pour les recharges

4. **Points de fidélité** (si vous êtes chauffeur)
   - Points initiaux : 0
   - Niveau : Bronze
   - Prêt pour gagner des points

---

## 📋 Exemples d'emails et extraction de noms

Notre système extrait automatiquement votre nom depuis votre email :

| Email | Prénom | Nom |
|-------|--------|-----|
| `jean.dupont@mail.com` | Jean | Dupont |
| `marie_martin@exemple.fr` | Marie | Martin |
| `ahmed-diallo@test.com` | Ahmed | Diallo |
| `fatou.sow@email.sn` | Fatou | Sow |

**Note** : Vous pourrez modifier votre nom dans "Mon Profil" après connexion.

---

## ❓ FAQ

### Q : Puis-je changer mon rôle après ?
**R** : Actuellement, seul un administrateur peut modifier les rôles. Choisissez soigneusement !

### Q : Que se passe-t-il si je ferme le navigateur pendant la sélection ?
**R** : Pas de problème ! Le dialogue réapparaîtra à votre prochaine connexion.

### Q : Je vois toujours "Utilisateur non trouvé" ?
**R** : Ce problème est maintenant résolu. Si vous le voyez encore :
1. Déconnectez-vous
2. Reconnectez-vous avec votre email
3. Le dialogue de rôle devrait apparaître

### Q : Puis-je créer plusieurs comptes ?
**R** : Oui, utilisez simplement des emails différents. Chaque email = 1 compte.

### Q : Le seed data est-il toujours nécessaire ?
**R** : **NON** ! Le seed data est maintenant optionnel. Utilisez-le uniquement pour :
- Créer un compte admin démo (admin@assurtrans.com)
- Tester avec plusieurs rôles différents
- Générer des données de démonstration (produits, stations, etc.)

---

## 🔧 Résolution de problèmes

### Problème : Le dialogue de rôle n'apparaît pas
**Solutions** :
1. Vérifiez votre connexion internet
2. Ouvrez la console du navigateur (F12) pour voir les erreurs
3. Essayez de vous déconnecter et reconnecter
4. Videz le cache du navigateur et réessayez

### Problème : Erreur lors de la création du profil
**Solutions** :
1. Vérifiez votre connexion internet
2. Le bouton "Continuer" devient réactif, réessayez
3. Si l'erreur persiste, contactez le support

### Problème : Je ne reçois pas le code OTP
**Solutions** :
1. Vérifiez vos spams
2. Attendez 1-2 minutes (délai d'envoi)
3. Cliquez sur "Renvoyer le code"
4. Vérifiez que l'email est correct

---

## 🎓 Pour aller plus loin

### Après votre première connexion :

1. **Complétez votre profil**
   - Cliquez sur votre nom en haut à droite
   - Sélectionnez "Mon Profil"
   - Ajoutez votre bio, contact d'urgence, etc.

2. **Explorez votre tableau de bord**
   - Chaque rôle a un dashboard adapté
   - Statistiques en temps réel
   - Actions rapides disponibles

3. **Testez les fonctionnalités**
   - Chef de flotte → Gérez vos véhicules
   - Chauffeur → Commandez du carburant
   - Admin → Accédez aux analytics

---

## 🚨 Important à savoir

- ✅ **Pas besoin de seed data** pour commencer
- ✅ **Profil créé automatiquement** après OTP
- ✅ **Nom extrait de l'email** automatiquement
- ✅ **Wallet créé** pour tous (sauf admin)
- ✅ **Points de fidélité** pour les chauffeurs
- ✅ **Impossible de fermer** le dialogue de rôle (sélection obligatoire)

---

## 📞 Besoin d'aide ?

Si vous rencontrez des problèmes :
1. Consultez la documentation complète : `.devv/TEST_LOGIN_FLOW.md`
2. Vérifiez la console du navigateur pour les erreurs
3. Contactez le support technique

---

**Bon démarrage avec Assur'Trans© ! 🎉**
