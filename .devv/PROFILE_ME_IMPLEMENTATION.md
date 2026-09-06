# Implémentation `/profile/me` - Guide Pas-à-Pas

## 🎯 **Vue d'ensemble**

Ce guide fournit le code exact pour implémenter l'architecture `/profile/me` **en préservant 100% des fonctionnalités existantes**.

**Temps estimé** : 30 minutes  
**Risque** : Très faible (changements additifs uniquement)  
**Fonctionnalités préservées** : Statistiques, timeline, édition, validation, tout !

---

## 📋 **Étapes d'Implémentation**

### **Étape 1 : Mise à jour `auth-store.ts`** (10 lignes)

**Fichier** : `src/store/auth-store.ts`

**Changement 1 : Ajouter `userId` dans l'interface `User`**

```typescript
// AVANT
interface User {
  projectId: string;
  uid: string;
  name: string;
  email: string;
  createdTime: number;
  lastLoginTime: number;
  role?: 'admin' | 'agent' | 'petrolier' | 'station' | 'fleet' | 'driver';
}

// APRÈS
interface User {
  projectId: string;
  uid: string;        // ✅ authId (ID système d'auth Devv)
  userId?: string;    // ✅ NOUVEAU: ID de la table users (optionnel)
  name: string;
  email: string;
  createdTime: number;
  lastLoginTime: number;
  role?: 'admin' | 'agent' | 'petrolier' | 'station' | 'fleet' | 'driver';
}
```

**Changement 2 : Ajouter helper `useAuth()` avec `authId` et `userId`**

```typescript
// Ajouter APRÈS la définition du store (ligne ~109)

/**
 * Hook helper pour accéder facilement à l'auth state
 * avec distinction claire entre authId (Devv) et userId (table users)
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading } = useAuthStore(state => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
  }));

  return {
    user,
    authId: user?.uid ?? null,        // ✅ ID système d'auth (toujours présent si connecté)
    userId: user?.userId ?? null,     // ✅ ID table users (peut être null si profil pas créé)
    role: user?.role ?? null,
    isAuthenticated,
    isLoading,
  };
}
```

**Fichier complet après modification** :

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth } from '@devvai/devv-code-backend';

interface User {
  projectId: string;
  uid: string;        // ✅ authId (ID système d'auth Devv)
  userId?: string;    // ✅ NOUVEAU: ID de la table users (optionnel)
  name: string;
  email: string;
  createdTime: number;
  lastLoginTime: number;
  role?: 'admin' | 'agent' | 'petrolier' | 'station' | 'fleet' | 'driver';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  sendOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      sendOTP: async (email: string) => {
        set({ isLoading: true });
        try {
          await auth.sendOTP(email);
        } finally {
          set({ isLoading: false });
        }
      },

      verifyOTP: async (email: string, code: string) => {
        set({ isLoading: true });
        try {
          const response = await auth.verifyOTP(email, code);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await auth.logout();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      checkAuth: () => {
        const sid = localStorage.getItem('DEVV_CODE_SID');
        const storedUser = localStorage.getItem('auth-storage');
        
        if (sid && storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed.state?.user) {
              set({
                user: parsed.state.user,
                isAuthenticated: true,
              });
            }
          } catch (error) {
            console.error('Failed to parse stored auth:', error);
            set({
              user: null,
              isAuthenticated: false,
            });
          }
        } else {
          set({
            user: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Hook helper pour accéder facilement à l'auth state
 * avec distinction claire entre authId (Devv) et userId (table users)
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading } = useAuthStore(state => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
  }));

  return {
    user,
    authId: user?.uid ?? null,        // ✅ ID système d'auth (toujours présent si connecté)
    userId: user?.userId ?? null,     // ✅ ID table users (peut être null si profil pas créé)
    role: user?.role ?? null,
    isAuthenticated,
    isLoading,
  };
}
```

---

### **Étape 2 : Mise à jour `ProfilePage.tsx`** (40 lignes)

**Fichier** : `src/pages/ProfilePage.tsx`

**Changements à appliquer** :

1. **Importer le nouveau hook `useAuth`** (ligne ~2)
2. **Ajouter logique conditionnelle** pour `/profile/me` (ligne ~96-162)
3. **Conserver tout le reste** (statistiques, timeline, édition, validation)

**Code à remplacer** (lignes 77-163) :

```typescript
// AVANT (lignes 77-163)
export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Check if viewing own profile or someone else's
  const isOwnProfile = !userId || userId === currentUserId;

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) {
        navigate('/login');
        return;
      }

      const { state } = JSON.parse(authStorage);
      const loggedInUserId = state.user?.uid; // Fixed: use uid instead of id

      if (!loggedInUserId) {
        navigate('/login');
        return;
      }

      setCurrentUserId(loggedInUserId);

      // Determine which user profile to load
      const targetUserId = userId || loggedInUserId;

      // Load user data
      const usersResult = await table.getItems(USERS_TABLE_ID);
      const users = ((usersResult as any).items || []) as UserData[];
      const user = users.find(u => u._uid === targetUserId);
      
      if (user) {
        setUserData(user);
      } else {
        toast({
          title: 'Erreur',
          description: 'Utilisateur non trouvé',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      // Load user profile
      const profilesResult = await table.getItems(USER_PROFILES_TABLE_ID);
      const profiles = ((profilesResult as any).items || []) as UserProfile[];
      const userProfile = profiles.find(p => p._uid === targetUserId);
      
      if (userProfile) {
        setProfile(userProfile);
        setEditedProfile(userProfile);
      }

      // Load user statistics (non-blocking)
      loadUserStats(targetUserId).catch(err => {
        console.warn('Failed to load user stats:', err);
      });
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données du profil',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
```

**APRÈS (nouveau code avec logique `/profile/me`)** :

```typescript
export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { toast } = useToast();
  const { user: authUser, authId, userId: authUserTableId, role: currentUserRole } = useAuth();  // ✅ Utiliser nouveau hook
  
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [notFound, setNotFound] = useState(false);
  
  // ✅ CLEF: Détecter si c'est "Mon profil" ou "profil d'un autre"
  const isOwnProfileRoute = !routeUserId || routeUserId === "me";
  const isOwnProfile = isOwnProfileRoute && !!authUser;

  useEffect(() => {
    loadUserData();
  }, [routeUserId]);  // ✅ Dépendre de routeUserId, pas userId

  const loadUserData = async () => {
    // ========================================
    // CAS 1: "Mon profil" (/profile/me)
    // ========================================
    if (isOwnProfileRoute) {
      setLoading(false);  // ✅ Instantané, pas d'API call initial

      if (authUser) {
        // ✅ Créer un profil minimal à partir du store
        const fallbackUserData: UserData = {
          _id: authUserTableId || authId!,
          _uid: authId!,
          email: authUser.email,
          role: authUser.role || 'driver',
          status: 'active',
          created_at: new Date(authUser.createdTime).toISOString(),
        };
        
        const fallbackProfile: UserProfile = {
          _id: authUserTableId || authId!,
          _uid: authId!,
          full_name: authUser.name || authUser.email.split('@')[0],
          phone: '',
          address: '',
          city: '',
        };

        setUserData(fallbackUserData);
        setProfile(fallbackProfile);
        setEditedProfile(fallbackProfile);
        setNotFound(false);

        // ✅ Charger les statistiques en arrière-plan (non-bloquant)
        if (authId) {
          loadUserStats(authId).catch(err => {
            console.warn('Failed to load user stats:', err);
          });
        }
      } else {
        // Pas d'authUser → problème d'authentification
        setUserData(null);
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

    setLoading(true);
    setNotFound(false);

    try {
      // ✅ Charger depuis la base (seulement pour les autres utilisateurs)
      const usersResult = await table.getItems(USERS_TABLE_ID);
      const users = ((usersResult as any).items || []) as UserData[];
      const user = users.find(u => u._uid === routeUserId);
      
      if (user) {
        setUserData(user);
      } else {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Load user profile
      const profilesResult = await table.getItems(USER_PROFILES_TABLE_ID);
      const profiles = ((profilesResult as any).items || []) as UserProfile[];
      const userProfile = profiles.find(p => p._uid === routeUserId);
      
      if (userProfile) {
        setProfile(userProfile);
        setEditedProfile(userProfile);
      } else {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Load user statistics (non-blocking) - only for admin viewing others
      if (currentUserRole === 'admin') {
        loadUserStats(routeUserId).catch(err => {
          console.warn('Failed to load user stats:', err);
        });
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données du profil',
        variant: 'destructive',
      });
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };
```

**Note importante** : Le reste du fichier ProfilePage.tsx reste **exactement identique** :
- `validateProfile()` fonction
- `handleSave()` fonction
- `handleCancel()` fonction
- `loadUserStats()` fonction
- `getRoleLabel()` et `getRoleBadgeVariant()` fonctions
- Tout le JSX (affichage, édition, statistiques, timeline)

**Seule modification dans le JSX** (ligne ~421) :

```typescript
// AVANT
{!isOwnProfile && (
  <Card className="border-blue-200 bg-blue-50">
    <CardContent className="p-4">
      <p className="text-sm text-blue-800 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Vous consultez le profil d'un autre utilisateur en lecture seule.
      </p>
    </CardContent>
  </Card>
)}

// APRÈS
{!isOwnProfile && routeUserId !== "me" && (
  <Card className="border-blue-200 bg-blue-50">
    <CardContent className="p-4">
      <p className="text-sm text-blue-800 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Vous consultez le profil d'un autre utilisateur en lecture seule.
      </p>
    </CardContent>
  </Card>
)}
```

---

### **Étape 3 : Mise à jour des liens de navigation** (recherche/remplacement)

**Fichiers à modifier** : Tous les composants avec liens vers le profil

**Commande de recherche** : Chercher `to="/profile"` dans tout le projet

**Fichiers concernés** :
- `src/pages/DashboardPage.tsx` (menu dropdown)
- `src/pages/AgentDashboardPage.tsx` (menu dropdown)
- `src/pages/StationDashboardPage.tsx` (menu dropdown)
- `src/pages/DriverDashboardPage.tsx` (menu dropdown)
- `src/pages/FleetManagementPage.tsx` (menu dropdown)
- `src/pages/FuelManagementPage.tsx` (menu dropdown)
- Tout autre fichier avec menu utilisateur

**Changement à appliquer** :

```typescript
// AVANT ❌
<Link to="/profile">
  <User className="h-4 w-4 mr-2" />
  Mon profil
</Link>

// APRÈS ✅
<Link to="/profile/me">
  <User className="h-4 w-4 mr-2" />
  Mon profil
</Link>
```

**Exemple complet dans DashboardPage** :

```typescript
// src/pages/DashboardPage.tsx (vers ligne 60-70)
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="rounded-full">
      <User className="h-5 w-5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel>{currentUser?.email}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    
    {/* ✅ Changer ici */}
    <DropdownMenuItem asChild>
      <Link to="/profile/me" className="cursor-pointer">
        <User className="h-4 w-4 mr-2" />
        Mon profil
      </Link>
    </DropdownMenuItem>
    
    {currentUser?.role === 'admin' && (
      <DropdownMenuItem asChild>
        <Link to="/settings" className="cursor-pointer">
          <Settings className="h-4 w-4 mr-2" />
          Paramètres
        </Link>
      </DropdownMenuItem>
    )}
    
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
      <LogOut className="h-4 w-4 mr-2" />
      Déconnexion
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Répéter ce changement dans tous les dashboards** (6 fichiers au total).

---

### **Étape 4 : Mise à jour `App.tsx`** (optionnel mais recommandé)

**Fichier** : `src/App.tsx`

**Changement** : Ajouter redirection `/profile` → `/profile/me` pour compatibilité

```typescript
// AVANT (lignes 146-160)
<Route
  path="/profile"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>
<Route
  path="/profile/:userId"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>

// APRÈS
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

## 🧪 **Tests de Vérification**

Après implémentation, tester ces 5 scénarios :

### **Test 1: Mon profil s'affiche instantanément** ✅

1. Login avec email OTP
2. Cliquer "Mon profil" dans le menu
3. **Attente** : Profil s'affiche en 0ms (pas de loading spinner)
4. **Vérifier** : Email, rôle, nom affichés correctement

### **Test 2: Statistiques et timeline fonctionnent** ✅

1. Sur "Mon profil"
2. **Vérifier** : Onglets "Statistiques" et "Activité" présents (si fleet/driver/agent)
3. Cliquer sur "Statistiques"
4. **Vérifier** : Cartes de stats chargées (loading puis affichage)
5. Cliquer sur "Activité"
6. **Vérifier** : Timeline affichée avec activités récentes

### **Test 3: Édition de profil fonctionne** ✅

1. Sur "Mon profil"
2. Cliquer "Modifier"
3. **Vérifier** : Formulaire d'édition activé
4. Modifier le nom, téléphone, ville
5. Cliquer "Enregistrer"
6. **Vérifier** : Toast de succès + données mises à jour

### **Test 4: Profil d'un autre utilisateur (lecture seule)** ✅

1. Login en tant que driver
2. Aller sur `/profile/:userId` (ID d'un autre driver)
3. **Attente** : Loading spinner puis affichage
4. **Vérifier** : Badge "Ce profil est en lecture seule"
5. **Vérifier** : Pas de bouton "Modifier"
6. **Vérifier** : Pas d'onglets statistiques/activité (confidentialité)

### **Test 5: Admin voit tout** ✅

1. Login en tant qu'admin
2. Aller sur `/profile/:userId` (ID d'un driver)
3. **Vérifier** : Pas de badge "lecture seule"
4. **Vérifier** : Bouton "Modifier" disponible
5. **Vérifier** : Statistiques et timeline visibles

---

## 📊 **Récapitulatif des Fichiers Modifiés**

| Fichier | Lignes modifiées | Description |
|---------|------------------|-------------|
| `auth-store.ts` | +15 lignes | Ajouter `userId` + helper `useAuth()` |
| `ProfilePage.tsx` | ~40 lignes | Logique conditionnelle `/profile/me` |
| `DashboardPage.tsx` | 1 ligne | Lien `/profile` → `/profile/me` |
| `AgentDashboardPage.tsx` | 1 ligne | Lien `/profile` → `/profile/me` |
| `StationDashboardPage.tsx` | 1 ligne | Lien `/profile` → `/profile/me` |
| `DriverDashboardPage.tsx` | 1 ligne | Lien `/profile` → `/profile/me` |
| `FleetManagementPage.tsx` | 1 ligne | Lien `/profile` → `/profile/me` |
| `FuelManagementPage.tsx` | 1 ligne | Lien `/profile` → `/profile/me` |
| `App.tsx` | +3 lignes | Redirection `/profile` → `/profile/me` |

**Total** : ~70 lignes modifiées sur 9 fichiers

---

## ✅ **Checklist Finale**

- [ ] Étape 1: `auth-store.ts` modifié (interface User + hook useAuth)
- [ ] Étape 2: `ProfilePage.tsx` modifié (logique conditionnelle)
- [ ] Étape 3: Tous les liens `/profile` → `/profile/me` (6 dashboards)
- [ ] Étape 4: `App.tsx` modifié (redirection)
- [ ] Test 1: Mon profil instantané ✓
- [ ] Test 2: Statistiques/timeline ✓
- [ ] Test 3: Édition fonctionne ✓
- [ ] Test 4: Lecture seule autres ✓
- [ ] Test 5: Admin voit tout ✓
- [ ] Build réussi sans erreurs
- [ ] Documentation STRUCTURE.md mise à jour

---

## 🎯 **Prêt à Implémenter**

Confirmez et je procède avec ces 4 étapes en ordre :

1. **Étape 1** : Modifier `auth-store.ts`
2. **Étape 2** : Modifier `ProfilePage.tsx`
3. **Étape 3** : Modifier tous les liens de navigation
4. **Étape 4** : Modifier `App.tsx` + Build + Tests

**Temps total estimé** : 30 minutes
**Risque** : Très faible ✅
