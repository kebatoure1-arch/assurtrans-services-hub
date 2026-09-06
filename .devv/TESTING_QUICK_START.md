# 🧪 Test rapide du flux de connexion

## 🆕 NOUVELLES AMÉLIORATIONS (Juste appliquées !)

**Dernières corrections :**
- ✅ Délai de synchronisation augmenté à 1 seconde (au lieu de 500ms)
- ✅ Logs de console détaillés étape par étape (Étapes 1-6)
- ✅ Vérification de profil améliorée avec logs API complets
- ✅ Messages clairs "NOUVEL UTILISATEUR" dans la console

**Problème ?** → Voir **QUICK_FIX_GUIDE.md** (dépannage en 2 minutes)

---

## ⚡ Comment tester en 2 minutes

### 1. Tester avec un nouvel email

```
1. Ouvrir l'application → Cliquer "Se connecter"
2. Entrer un NOUVEL email : test.user@mail.com
3. Cliquer "Recevoir le code"
4. Vérifier votre boîte mail → Entrer le code à 6 chiffres
5. ✨ LE DIALOGUE DE SÉLECTION DE RÔLE DOIT APPARAÎTRE
```

### 2. Ce que vous devez voir

**Dialogue de sélection de rôle :**
- 🛡️ Administrateur (violet)
- 👥 Agent (bleu)
- 🏢 Pétrolier (vert)
- 🏪 Station-service (orange)
- 🚛 Chef de flotte (indigo)
- 👤 Chauffeur (turquoise)

### 3. Choisir un rôle et continuer

```
1. Cliquer sur une carte de rôle
2. Vérifier que la bordure devient verte avec badge ✓
3. Cliquer "Continuer"
4. Voir "Création du profil..."
5. Navigation automatique vers le Dashboard
6. ✅ SUCCESS : Message "Profil créé avec succès !"
```

### 4. Vérifier que tout fonctionne

```
1. Cliquer sur votre avatar en haut à droite
2. Cliquer "Mon Profil"
3. ✅ Vous devriez voir votre profil (PAS d'erreur "Utilisateur non trouvé")
```

## 🎯 Résultat attendu

### ✅ Test réussi si :
- Le dialogue apparaît automatiquement après OTP
- 6 rôles sont affichés avec icônes
- Sélection visuelle fonctionne
- Navigation vers dashboard réussie
- "Mon Profil" fonctionne sans erreur

### ❌ Test échoué si :
- Dialogue ne s'affiche pas
- Message "Utilisateur non trouvé"
- Erreur lors de la création
- Blocage quelque part

## 🔍 Emails de test recommandés

```
jean.dupont@testmail.com    → Jean Dupont
marie.claire@testmail.com   → Marie Claire
ahmed.barry@testmail.com    → Ahmed Barry
fatou.sow@testmail.com      → Fatou Sow
```

## 📝 Notes importantes

1. **Chaque email ne peut être utilisé qu'UNE SEULE FOIS**
2. **Le dialogue n'apparaît QUE pour les NOUVEAUX utilisateurs**
3. **Les utilisateurs existants vont directement au dashboard**
4. **Le profil est créé automatiquement, pas besoin de seed data**

## 🐛 Si ça ne marche pas

1. **Ouvrir la console du navigateur (F12)**
2. **Chercher les messages suivants :**
   ```
   ✅ User profile created in users table
   ✅ User profile created in user_profiles table
   ✅ Wallet created for user
   ```
3. **Si ces messages n'apparaissent pas, il y a un problème**

## 📚 Documentation complète

Pour plus de détails, voir :
- **HOW_TO_TEST_ROLE_SELECTION.md** - Guide étape par étape avec console logs
- **TEST_LOGIN_FLOW.md** - Scénarios de test complets (18+ tests)
- **DEBUG_ROLE_SELECTION.md** - Troubleshooting et résolution de problèmes
- **STRUCTURE.md** - Architecture et flux technique
- **FIX_PROFILE_BUG.md** - Historique des corrections

## 🚀 Test de tous les rôles

Pour tester chaque rôle, utiliser des emails différents :

```bash
# Admin
admin.test.001@mail.com

# Agent
agent.test.001@mail.com

# Pétrolier
petrolier.test.001@mail.com

# Station
station.test.001@mail.com

# Fleet Manager
fleet.test.001@mail.com

# Chauffeur (créé avec wallet + loyalty points)
driver.test.001@mail.com
```

## ✨ Ce qui est créé automatiquement

### Pour tous les rôles :
- ✅ Profil utilisateur (table users)
- ✅ Profil étendu (table user_profiles)

### Pour non-admins :
- ✅ Wallet avec balance 0 XOF

### Pour chauffeurs uniquement :
- ✅ Wallet avec balance 0 XOF
- ✅ Points de fidélité (tier Bronze)

---

**Temps estimé du test complet : 2-3 minutes par rôle**
