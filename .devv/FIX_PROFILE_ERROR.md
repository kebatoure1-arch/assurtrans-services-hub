# Comment corriger l'erreur "Utilisateur non trouvé"

## 🔍 Pourquoi ce message apparaît-il ?

Lorsque vous vous connectez avec l'authentification OTP de Devv, le système crée une **session d'authentification** mais **NE CRÉE PAS** automatiquement un profil utilisateur dans la base de données Assur'Trans.

C'est normal ! Vous devez créer votre profil manuellement la première fois.

---

## ✅ Solution rapide (3 étapes)

### Étape 1 : Accédez aux Paramètres
Depuis n'importe quelle page, cliquez sur votre avatar en haut à droite, puis **"Paramètres"**.

Ou si vous êtes sur la page d'erreur du profil, cliquez simplement sur **"Aller aux Paramètres"**.

### Étape 2 : Ouvrez l'onglet "Données démo"
Dans la page Paramètres, vous verrez plusieurs onglets en haut. Cliquez sur l'onglet **"Données démo"** (avec l'icône de base de données 💾).

### Étape 3 : Créez votre compte admin
1. Cliquez sur **"Créer Admin"** pour créer un compte administrateur avec vos identifiants actuels
2. Puis cliquez sur **"Tout initialiser"** pour créer toutes les données de démonstration

---

## 🎉 Résultat

Après ces 3 étapes, vous aurez :

✅ Un compte administrateur fonctionnel  
✅ Un profil utilisateur complet dans la base de données  
✅ Des données de démonstration pour tester toutes les fonctionnalités :
   - Catalogue de produits (carburants, huiles)
   - Réseau de stations-service (3 stations à Dakar)
   - Plans d'assurance santé (4 formules)
   - Prestataires de santé (6 types)
   - Niveaux de fidélité (Bronze à Diamant)

---

## 🔄 Accès direct

Si vous recevez l'erreur "Utilisateur non trouvé" :

1. **Cliquez sur "Aller aux Paramètres"** dans le message d'erreur
2. L'onglet "Données démo" s'ouvrira automatiquement
3. Suivez les instructions à l'écran

---

## 💡 Détails techniques

### Pourquoi cette approche ?

Le système d'authentification Devv est **découplé** de votre base de données application :

- **Devv Auth** → Gère uniquement la connexion (email + OTP)
- **Table users** → Stocke vos données métier (rôle, profil, etc.)

Cela vous donne plus de flexibilité pour gérer vos utilisateurs selon vos besoins spécifiques.

### Comment ça fonctionne ?

1. Connexion OTP → Crée une session avec `user.uid`
2. Seed data → Crée une entrée dans `users` table avec ce `user.uid`
3. Profil → Maintenant le système peut charger votre profil correctement

---

## ❓ Questions fréquentes

**Q : Dois-je faire ça à chaque connexion ?**  
Non, une seule fois suffit. Après avoir créé votre profil, il sera permanent.

**Q : Puis-je utiliser un autre email ?**  
Oui, le compte admin créé utilise `admin@assurtrans.com`. Vous pouvez vous reconnecter avec cet email et recevoir un nouveau code OTP.

**Q : Les données de démo sont-elles obligatoires ?**  
Non, mais elles sont très utiles pour tester la plateforme. Vous pouvez créer seulement le compte admin si vous préférez.

**Q : Que faire si l'erreur persiste ?**  
Vérifiez que vous avez bien cliqué sur "Créer Admin" ET "Tout initialiser". Si le problème persiste, supprimez les données et recommencez.

---

## 🚀 Étapes suivantes

Après avoir créé votre profil :

1. ✅ Allez dans **Mon Profil** pour personnaliser vos informations
2. 🎯 Explorez le **Dashboard** avec vos nouvelles données
3. 👥 Créez d'autres utilisateurs avec différents rôles
4. 🚗 Testez les fonctionnalités de gestion de flotte
5. 💳 Explorez les commandes de carburant et l'assurance santé

Bon test ! 🎊
