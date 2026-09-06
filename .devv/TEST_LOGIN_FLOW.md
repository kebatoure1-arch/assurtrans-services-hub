# Test du flux de connexion complet

## 🎯 Objectif du test
Vérifier que le dialogue de sélection de rôle apparaît automatiquement après la première connexion OTP et que le profil utilisateur est créé correctement.

## ✅ Ce qui est déjà implémenté

### 1. LoginPage.tsx (lignes 66-106)
```typescript
// Après vérification OTP réussie :
const uid = parsed?.state?.user?.uid;
const profileExists = await profileCreationService.checkProfileExists(uid);

if (!profileExists) {
  // Nouvel utilisateur → Affiche sélection de rôle
  setIsNewUser(true);
  setShowRoleSelection(true);
} else {
  // Utilisateur existant → Va au dashboard
  navigate('/dashboard');
}
```

### 2. RoleSelectionDialog.tsx
- 6 options de rôles avec icônes et descriptions
- Design moderne avec animations
- Dialogue non-fermable (l'utilisateur DOIT choisir un rôle)
- État de chargement pendant la création du profil

### 3. ProfileCreationService
- Vérifie l'existence du profil via `checkProfileExists(uid)`
- Crée automatiquement :
  - Entrée dans table `users` (compte principal)
  - Entrée dans table `user_profiles` (infos étendues)
  - Wallet pour non-admins (balance 0 XOF)
  - Points de fidélité pour chauffeurs (tier Bronze)
- Extraction intelligente du nom depuis l'email

## 🧪 Scénarios de test

### Test 1 : Nouvel utilisateur (PRIORITAIRE)
**Email de test :** `jean.dupont@testmail.com`

**Étapes attendues :**
1. ✅ Entrer l'email → Bouton "Recevoir le code"
2. ✅ Recevoir OTP par email → Entrer le code à 6 chiffres
3. ✅ Vérification OTP réussie
4. ✅ **DIALOGUE DE SÉLECTION DE RÔLE APPARAÎT AUTOMATIQUEMENT**
5. ✅ Choisir un rôle parmi les 6 options :
   - 🛡️ Administrateur (violet)
   - 👥 Agent (bleu)
   - 🏢 Pétrolier (émeraude)
   - 🏪 Station-service (orange)
   - 🚛 Chef de flotte (indigo)
   - 👤 Chauffeur (teal)
6. ✅ Cliquer "Continuer" → Affiche "Création du profil..."
7. ✅ Navigation automatique vers `/dashboard`
8. ✅ Message de succès : "✨ Profil créé avec succès ! Bienvenue Jean, votre compte [rôle] est prêt"

**Résultat attendu :**
- Profil créé dans table `users` avec :
  - `_uid` : ID Devv
  - `email` : jean.dupont@testmail.com
  - `firstName` : Jean
  - `lastName` : Dupont
  - `role` : [rôle choisi]
  - `status` : active
- Profil étendu créé dans table `user_profiles`
- Wallet créé si rôle ≠ admin
- Points de fidélité créés si rôle = driver

### Test 2 : Extraction de nom depuis email
**Emails à tester :**
- `marie.claire@mail.com` → Marie Claire
- `ahmed_barry@mail.com` → Ahmed Barry
- `fatou-sow@mail.com` → Fatou Sow
- `mamadou@mail.com` → Mamadou [vide]

### Test 3 : Utilisateur existant
**Email de test :** Un email déjà utilisé

**Étapes attendues :**
1. ✅ Entrer l'email existant → Recevoir OTP
2. ✅ Entrer le code OTP → Vérification
3. ✅ **PAS DE DIALOGUE DE SÉLECTION**
4. ✅ Navigation directe vers `/dashboard`
5. ✅ Message : "🎉 Connexion réussie ! Bienvenue sur Assur'Trans"

### Test 4 : Création de profil pour chaque rôle
Tester la création de profil pour chaque type de rôle :

| Rôle | Email test | Wallet créé ? | Loyalty créé ? |
|------|------------|---------------|----------------|
| Admin | admin.test@mail.com | ❌ Non | ❌ Non |
| Agent | agent.test@mail.com | ✅ Oui | ❌ Non |
| Pétrolier | petrolier.test@mail.com | ✅ Oui | ❌ Non |
| Station | station.test@mail.com | ✅ Oui | ❌ Non |
| Fleet | fleet.test@mail.com | ✅ Oui | ❌ Non |
| Driver | driver.test@mail.com | ✅ Oui | ✅ Oui (Bronze) |

### Test 5 : Gestion des erreurs
**Cas d'erreur à vérifier :**
1. ✅ Échec de création du profil → Message d'erreur + Dialogue reste ouvert
2. ✅ OTP invalide → Message "Code invalide"
3. ✅ OTP expiré → Message "Code expiré"
4. ✅ Email invalide → Message "Email invalide"

## 🔍 Points de vérification techniques

### Vérifier dans le code
✅ **LoginPage.tsx ligne 358-361** : `RoleSelectionDialog` est bien rendu dans le JSX
```tsx
<RoleSelectionDialog
  open={showRoleSelection}
  onComplete={handleRoleSelection}
/>
```

✅ **LoginPage.tsx ligne 84** : Utilise `profileCreationService.checkProfileExists(uid)`

✅ **RoleSelectionDialog.tsx ligne 104** : `onOpenChange={() => {}}` empêche la fermeture

✅ **RoleSelectionDialog.tsx ligne 105** : `[&>button]:hidden` cache le bouton X

### Vérifier dans la base de données
Après création d'un nouveau compte, vérifier :

1. **Table `users` (f4eyoj5l0wzk)** :
   ```
   _uid: [ID Devv]
   email: [email test]
   firstName: [prénom extrait]
   lastName: [nom extrait]
   role: [rôle choisi]
   status: "active"
   createdAt: [timestamp]
   lastLogin: [timestamp]
   ```

2. **Table `user_profiles` (f4eyoj561clc)** :
   ```
   _uid: [ID Devv]
   userId: [ID Devv]
   bio: ""
   profilePicture: ""
   emergencyContact: ""
   [autres champs vides par défaut]
   ```

3. **Table `wallets` (f4f186q7i03k)** - Si non-admin :
   ```
   _uid: [ID Devv]
   userId: [ID Devv]
   balance: 0
   currency: "XOF"
   status: "active"
   ```

4. **Table `loyalty_points` (f4fb4hcl1vvk)** - Si driver :
   ```
   _uid: [ID Devv]
   userId: [ID Devv]
   points: 0
   tier: "bronze"
   lifetimePoints: 0
   status: "active"
   ```

## 🎨 Expérience utilisateur attendue

### Design du dialogue
- ✅ Titre : "Bienvenue sur Assur'Trans !" avec icône Sparkles animée
- ✅ Description claire : "Pour personnaliser votre expérience..."
- ✅ 6 cartes de rôle avec :
  - Icône distinctive et colorée
  - Nom du rôle en gras
  - Description courte
  - Radio button pour sélection
  - Animation de sélection (bordure verte, badge check)
- ✅ Message d'information : "Vous pourrez modifier votre profil plus tard"
- ✅ Bouton "Continuer" désactivé si aucun rôle sélectionné
- ✅ État de chargement : "Création du profil..." avec spinner

### Animations et transitions
- ✅ Apparition du dialogue avec effet scale-in
- ✅ Sélection de carte avec bordure animée
- ✅ Badge CheckCircle2 apparaît avec animation
- ✅ Icône Sparkles avec effet pulse
- ✅ Bouton avec hover et active states

## 📊 Résultats attendus

### ✅ Succès complet si :
1. Dialogue apparaît automatiquement après OTP pour nouveaux utilisateurs
2. 6 rôles sont affichés avec design correct
3. Sélection visuelle fonctionne (bordure verte + badge check)
4. Bouton "Continuer" crée le profil sans erreur
5. Navigation vers dashboard réussie
6. Toast de succès affiché avec nom extrait
7. Profil trouvable via "Mon Profil" immédiatement après
8. Données créées correctement dans toutes les tables

### ❌ Échec si :
1. Dialogue ne s'affiche pas après OTP
2. Message "Utilisateur non trouvé" apparaît après création
3. Erreur lors de la création du profil
4. Navigation échoue
5. Données manquantes dans les tables
6. Wallet ou loyalty points non créés selon le rôle

## 🚀 Commandes de test rapide

### Test manuel
1. Ouvrir l'application
2. Aller à `/login`
3. Entrer un NOUVEL email (jamais utilisé)
4. Recevoir et entrer le code OTP
5. **Vérifier que le dialogue de sélection apparaît automatiquement**
6. Choisir un rôle et continuer
7. Vérifier la navigation vers le dashboard
8. Cliquer sur "Mon Profil" → Devrait fonctionner sans erreur

### Vérification console navigateur
Ouvrir DevTools Console et chercher :
```
✅ User profile created in users table
✅ User profile created in user_profiles table
✅ Wallet created for user (si non-admin)
✅ Loyalty points created for driver (si driver)
```

## 🐛 Debugging en cas de problème

### Problème : Dialogue ne s'affiche pas
**Vérifier :**
1. `showRoleSelection` est bien `true` dans le state
2. `RoleSelectionDialog` est rendu dans le JSX (ligne 358)
3. Pas d'erreur dans la console navigateur
4. `profileCreationService.checkProfileExists()` retourne bien `false`

### Problème : "Utilisateur non trouvé" après création
**Vérifier :**
1. `user.uid` est bien utilisé (pas `user.id`)
2. Profil créé avec le bon `_uid`
3. Pas d'erreur lors de `table.addItem()`
4. Refresh de la page pour forcer le rechargement

### Problème : Erreur lors de la création
**Vérifier :**
1. Tables existent avec les bons IDs
2. Permissions des tables sont correctes
3. Tous les champs requis sont fournis
4. Pas de conflit de clé primaire

## ✨ Améliorations futures possibles
- [ ] Ajouter photo de profil pendant l'onboarding
- [ ] Quiz pour déterminer le rôle automatiquement
- [ ] Tutoriel interactif après création du compte
- [ ] Email de bienvenue avec guide du rôle
- [ ] Vérification d'identité pour rôles critiques (admin, pétrolier)
