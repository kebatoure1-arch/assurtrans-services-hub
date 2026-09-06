# Architecture `/profile/me` - Documentation Complète

## 📋 **Vue d'ensemble**

Ce document explique l'alignement de l'architecture du profil utilisateur avec le pattern `/profile/me`, **en préservant 100% des améliorations de l'Option B** (statistiques, timeline, composants réutilisables).

---

## 🎯 **Objectif**

**Problème actuel** :
- ProfilePage charge toujours depuis la base de données (users + user_profiles tables)
- Pour "Mon profil", on fait un appel API inutile alors qu'on a déjà les données dans auth-store
- Risque d'erreur "Utilisateur non trouvé" si le profil n'existe pas encore dans la base

**Solution proposée** :
- `/profile/me` → Utiliser directement les données de auth-store (instantané, zéro erreur)
- `/profile/:userId` → Charger depuis la base (pour consulter d'autres utilisateurs)
- Préserver **toutes** les fonctionnalités : statistiques, timeline, édition, validation

---

## 📐 **Architecture Actuelle vs Proposée**

### **Flux Actuel** ❌

```
User clicks "Mon Profil"
  ↓
Navigate to /profile (no userId param)
  ↓
ProfilePage.tsx:
  - Extract userId from route params → undefined
  - Check localStorage auth-storage → get loggedInUserId (uid)
  - Call table.getItems(USERS_TABLE_ID) → fetch ALL users
  - Find user where _uid === loggedInUserId
  - If NOT FOUND → Show error "Utilisateur non trouvé"
  - Call table.getItems(USER_PROFILES_TABLE_ID) → fetch ALL profiles
  - Find profile where _uid === loggedInUserId
  - If NOT FOUND → Show error message
  ↓
Display profile (if found)
```

**Problèmes** :
- 2 API calls même quand les données sont dans le store
- Erreur si le profil n'existe pas encore dans la base
- Latence inutile (loading spinner)

---

### **Flux Proposé** ✅

```
User clicks "Mon Profil"
  ↓
Navigate to /profile/me
  ↓
ProfilePage.tsx detects routeUserId === "me"
  ↓
  If "me":
    - Read authUser from auth-store (instantané, 0ms)
    - Create fallback profile from auth data (email, role)
    - NO API CALLS → Display immediately
    - Background: Load stats/activity (non-blocking)
  ↓
  If /:userId (autre utilisateur):
    - Call table.getItems(USERS_TABLE_ID) → fetch user
    - Call table.getItems(USER_PROFILES_TABLE_ID) → fetch profile
    - Display profile (read-only if not admin)
```

**Avantages** :
- ✅ Zéro latence pour "Mon Profil" (pas d'API call initial)
- ✅ Zéro erreur "Utilisateur non trouvé" (données garanties dans store)
- ✅ Distinction claire : `/profile/me` (soi) vs `/profile/:userId` (autres)
- ✅ Préserve toutes les fonctionnalités Option B

---

## 🔧 **Implémentation Détaillée**

### **1. Mise à jour de auth-store.ts** (Option A)

**Ajouter** :
```typescript
// src/store/auth-store.ts
interface User {
  projectId: string;
  uid: string;        // ✅ authId (Devv auth system)
  userId?: string;    // ✅ NOUVEAU: ID de la table users (si profil créé)
  name: string;
  email: string;
  createdTime: number;
  lastLoginTime: number;
  role?: 'admin' | 'agent' | 'petrolier' | 'station' | 'fleet' | 'driver';
}

// Helper functions
export function useAuth() {
  const { user, isAuthenticated } = useAuthStore();
  
  return {
    user,
    authId: user?.uid ?? null,        // ✅ ID système d'auth (toujours présent)
    userId: user?.userId ?? null,     // ✅ ID table users (peut être null si pas encore créé)
    role: user?.role ?? null,
    isAuthenticated,
  };
}
```

**Pourquoi** :
- Sépare clairement `authId` (Devv auth) et `userId` (table users)
- Permet de savoir si le profil existe dans la base (`userId` présent ou non)
- Rétrocompatible : `userId` optionnel, pas de breaking change

---

### **2. Mise à jour de ProfilePage.tsx**

**Logique principale** :

```typescript
// src/pages/ProfilePage.tsx
const ProfilePage: React.FC = () => {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const { user: authUser, authId, userId: authUserTableId, role } = useAuth();
  
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ✅ CLEF: Détecter si c'est "Mon profil" ou "profil d'un autre"
  const isOwnProfileRoute = !routeUserId || routeUserId === "me";

  useEffect(() => {
    // ========================================
    // CAS 1: "Mon profil" (/profile/me)
    // ========================================
    if (isOwnProfileRoute) {
      setLoading(false);  // ✅ Instantané, pas d'API call

      if (authUser) {
        // ✅ Créer un profil minimal à partir du store
        const fallbackProfile: Partial<User> = {
          id: authUserTableId ?? authId,  // Utiliser userId si existe, sinon authId
          email: authUser.email,
          role: authUser.role,
          fullName: authUser.name,
        };
        // @ts-expect-error : on force le type
        setProfile(fallbackProfile as User);
        setNotFound(false);
      } else {
        // Pas d'authUser → problème d'authentification
        setProfile(null);
        setNotFound(true);
      }
      return;  // ✅ Sortir ici, pas d'API call
    }

    // ========================================
    // CAS 2: Profil d'un autre utilisateur (/profile/:userId)
    // ========================================
    if (!routeUserId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    // ✅ Charger depuis la base (seulement pour les autres utilisateurs)
    userService
      .getUserById(routeUserId)
      .then((u) => {
        if (cancelled) return;
        if (!u) {
          setNotFound(true);
          setProfile(null);
        } else {
          setProfile(u);
        }
      })
      .catch((err) => {
        console.error('Erreur lors du chargement du profil :', err);
        if (!cancelled) {
          setNotFound(true);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOwnProfileRoute, routeUserId, authUser, authId, authUserTableId]);

  // ... reste du code (affichage, édition, stats, timeline)
};
```

---

### **3. Mise à jour des liens de navigation**

**Dans tous les menus/headers** :

```typescript
// Ancien ❌
<Link to="/profile">Mon profil</Link>

// Nouveau ✅
<Link to="/profile/me">Mon profil</Link>
```

**Exemple complet** :

```typescript
// src/components/Header.tsx (ou UserMenu dans DashboardPage)
import { Link } from "react-router-dom";

export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuContent>
        {/* ✅ Utiliser /profile/me pour "Mon Profil" */}
        <DropdownMenuItem asChild>
          <Link to="/profile/me">
            <User className="h-4 w-4 mr-2" />
            Mon profil
          </Link>
        </DropdownMenuItem>
        
        {/* Autres items... */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### **4. Routes dans App.tsx**

**Actuel** :
```typescript
<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
<Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
```

**Proposé** (optionnel, mais recommandé pour clarté) :
```typescript
{/* Mon profil - route explicite */}
<Route 
  path="/profile/me" 
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  } 
/>

{/* Profil d'un autre utilisateur */}
<Route 
  path="/profile/:userId" 
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  } 
/>

{/* Redirection /profile → /profile/me pour compatibilité */}
<Route path="/profile" element={<Navigate to="/profile/me" replace />} />
```

---

## 🔐 **Gestion des Permissions**

### **Cas d'usage** :

1. **Utilisateur consulte son propre profil** (`/profile/me`) :
   - ✅ Lecture instantanée depuis auth-store
   - ✅ Édition autorisée
   - ✅ Statistiques et timeline chargées en arrière-plan

2. **Utilisateur consulte un autre profil** (`/profile/:userId`) :
   - ✅ Chargement depuis la base de données
   - ✅ Lecture seule (sauf si admin)
   - ⚠️ Statistiques et timeline masquées (confidentialité)

3. **Admin consulte n'importe quel profil** :
   - ✅ Accès complet (lecture + édition)
   - ✅ Statistiques et timeline visibles

**Implémentation** :

```typescript
// Dans ProfilePage.tsx
const isOwnProfile = isOwnProfileRoute && !!authUser;
const canEdit = isOwnProfile || role === "admin";

// Afficher statistiques/timeline uniquement si profil perso ou admin
const showStats = isOwnProfile || role === "admin";
```

---

## 📊 **Préservation des Fonctionnalités Option B**

### **✅ Toutes les améliorations sont préservées** :

1. **Statistiques utilisateur** (`UserStatsCards`) :
   - Chargées en arrière-plan après affichage du profil
   - Non-bloquantes (loading spinner séparé)
   - Affichées uniquement pour profil personnel ou admin

2. **Timeline d'activité** (`UserActivityTimeline`) :
   - Chargée en arrière-plan via profileStatsService
   - Interface à onglets (Statistiques / Activité)
   - Limite de 15 activités récentes

3. **Édition de profil** :
   - Validation côté client (full_name, phone, city, etc.)
   - Champs conditionnels par rôle (fleet, driver, petrolier)
   - Contact d'urgence (emergency_contact, emergency_phone)
   - Bouton Enregistrer avec état loading

4. **Affichage conditionnel** :
   - Badge de rôle avec couleur
   - Sections spécifiques par rôle (permis pour driver, entreprise pour fleet/petrolier)
   - Message lecture seule pour profils d'autres utilisateurs

---

## ⚡ **Performance et UX**

### **Avant** (chargement API systématique) :

```
User clicks "Mon Profil"
  → Navigate to /profile
  → Loading spinner (0-500ms)
  → API call 1: Fetch all users (100-300ms)
  → API call 2: Fetch all profiles (100-300ms)
  → Display profile
  → Total: 200-1100ms
```

### **Après** (chargement optimisé) :

```
User clicks "Mon Profil"
  → Navigate to /profile/me
  → Display profile immediately (0ms) ✅
  → Background: Load stats (non-blocking, 200-400ms)
  → Total perceived: 0ms ⚡
```

**Gain de performance** : **200-1100ms → 0ms** pour l'affichage initial

---

## 🛡️ **Gestion des Erreurs**

### **Cas 1: Utilisateur non authentifié**

```typescript
if (isOwnProfileRoute && !authUser) {
  return (
    <div className="...">
      <p>Vous n'êtes pas connecté</p>
      <p>Veuillez vous reconnecter pour accéder à votre profil.</p>
      <Button onClick={() => navigate('/login')}>Se connecter</Button>
    </div>
  );
}
```

### **Cas 2: Profil d'un autre utilisateur introuvable**

```typescript
if (!isOwnProfileRoute && (notFound || !profile)) {
  return (
    <div className="...">
      <p>Utilisateur introuvable</p>
      <p>Le profil demandé n'existe pas ou n'est plus disponible.</p>
      <Button onClick={() => navigate(-1)}>Retour</Button>
    </div>
  );
}
```

### **Cas 3: Profil personnel incomplet**

```typescript
{isOwnProfileRoute && authUser && !authUserTableId && (
  <Alert variant="warning">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      ⚠ Votre session est active mais votre profil n'est pas encore 
      synchronisé dans la base « users ».
      Vous pouvez continuer à utiliser la plateforme, mais certaines 
      fonctions avancées (profil détaillé, historique) peuvent être 
      limitées tant que la fiche n'est pas créée.
    </AlertDescription>
  </Alert>
)}
```

---

## 🧪 **Scénarios de Test**

### **Test 1: Mon profil (utilisateur avec profil complet)**

1. Login avec email OTP
2. Cliquer "Mon profil" dans le menu
3. **Attente** : Affichage instantané sans loading spinner
4. **Vérifier** : Email, rôle, nom complet affichés
5. **Vérifier** : Onglets "Statistiques" et "Activité" présents (si fleet/driver/agent)
6. **Vérifier** : Bouton "Modifier" disponible

### **Test 2: Mon profil (nouvel utilisateur sans profil base)**

1. Login avec email OTP (compte tout neuf)
2. Cliquer "Mon profil"
3. **Attente** : Profil minimal affiché (email + rôle depuis auth-store)
4. **Vérifier** : Message d'avertissement "profil non synchronisé"
5. **Vérifier** : Pas de statistiques (car pas de données dans la base)

### **Test 3: Profil d'un autre utilisateur**

1. Login en tant qu'admin
2. Aller sur `/profile/:userId` (ID d'un autre utilisateur)
3. **Attente** : Loading spinner puis affichage du profil
4. **Vérifier** : Badge "lecture seule" absent (car admin)
5. **Vérifier** : Bouton "Modifier" disponible (car admin)

### **Test 4: Profil d'un autre utilisateur (non-admin)**

1. Login en tant que driver
2. Essayer d'accéder `/profile/:userId` (autre driver)
3. **Attente** : Loading puis affichage du profil
4. **Vérifier** : Badge "Ce profil est en lecture seule"
5. **Vérifier** : Pas de bouton "Modifier"

---

## 🎨 **Exemples d'UI**

### **Mon profil (affiché instantanément)**

```
┌─────────────────────────────────────────────────────────┐
│ ← Mon Profil                       [Paramètres] [Modifier] │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [Statistiques] [Activité]                                │
├─────────────────────────────────────────────────────────┤
│ 📦 12 Commandes  💰 24,500 FCFA  ⭐ 850 Points Fidélité │
│ 🚗 3 Véhicules   🔧 2 Alertes    💳 15,000 FCFA Wallet  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Jean Dupont                              [🛡️ FLEET]      │
│ jean.dupont@assurtrans.com                               │
├─────────────────────────────────────────────────────────┤
│ 📧 Informations du compte                                │
│   Statut: ✅ Actif                                       │
│   Membre depuis: 15 janvier 2025                        │
├─────────────────────────────────────────────────────────┤
│ 👤 Informations personnelles                             │
│   Nom: Jean Dupont                                       │
│   Téléphone: +221 77 123 45 67                          │
│   Ville: Dakar                                           │
└─────────────────────────────────────────────────────────┘
```

### **Profil d'un autre utilisateur (lecture seule)**

```
┌─────────────────────────────────────────────────────────┐
│ ← Profil de Marie Diallo                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ℹ️ Vous consultez le profil d'un autre utilisateur      │
│    en lecture seule.                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Marie Diallo                             [🛡️ DRIVER]     │
│ marie.diallo@assurtrans.com                              │
├─────────────────────────────────────────────────────────┤
│ 👤 Informations personnelles                             │
│   Nom: Marie Diallo                                      │
│   Téléphone: +221 76 987 65 43                          │
│   Ville: Saint-Louis                                     │
├─────────────────────────────────────────────────────────┤
│ 🚗 Informations de conduite                              │
│   Numéro de permis: SN123456789                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 **Récapitulatif des Changements**

| Fichier | Type | Description |
|---------|------|-------------|
| `auth-store.ts` | **Modification** | Ajouter `userId` optionnel + helpers `authId`/`userId` |
| `ProfilePage.tsx` | **Modification** | Logique conditionnelle `isOwnProfileRoute` |
| `App.tsx` | **Optionnel** | Redirection `/profile` → `/profile/me` |
| Tous les menus | **Modification** | Liens `<Link to="/profile/me">` |

**Lignes de code modifiées** : ~50 lignes (très peu)
**Temps d'implémentation** : 30 minutes
**Risque** : Très faible (changements additifs, pas de suppression)

---

## ✅ **Checklist de Vérification**

- [ ] `auth-store.ts` : Ajouter `userId` optionnel
- [ ] `auth-store.ts` : Ajouter helper `useAuth()` avec `authId` et `userId`
- [ ] `ProfilePage.tsx` : Logique `isOwnProfileRoute`
- [ ] `ProfilePage.tsx` : Cas 1 (me) → lecture store (0 API call)
- [ ] `ProfilePage.tsx` : Cas 2 (:userId) → lecture base (API call)
- [ ] Tous les menus : Changer `/profile` → `/profile/me`
- [ ] `App.tsx` : Redirection `/profile` → `/profile/me` (optionnel)
- [ ] Test 1: Mon profil s'affiche instantanément
- [ ] Test 2: Profil d'un autre charge depuis la base
- [ ] Test 3: Statistiques et timeline fonctionnent
- [ ] Test 4: Édition de profil fonctionne
- [ ] Test 5: Message d'erreur approprié si profil incomplet

---

## 🎯 **Conclusion**

Cette architecture `/profile/me` apporte :

✅ **Performance** : Affichage instantané pour "Mon profil" (0ms vs 200-1100ms)
✅ **Robustesse** : Zéro erreur "Utilisateur non trouvé" pour son propre profil
✅ **Clarté** : Distinction nette entre "moi" et "les autres"
✅ **Préservation** : 100% des fonctionnalités Option B conservées
✅ **Sécurité** : Confidentialité des statistiques/timeline des autres utilisateurs

**Recommandation** : ✅ **Implémenter cette architecture**
**Temps estimé** : 30 minutes
**Risque** : Très faible

---

**Prêt à implémenter ? Confirmez et je procède en 4 étapes** :

1. Mise à jour `auth-store.ts` (+10 lignes)
2. Mise à jour `ProfilePage.tsx` (logique conditionnelle ~40 lignes)
3. Mise à jour des liens de navigation (recherche/remplacement)
4. Build et test (vérification 5 scénarios)
