// src/store/auth-store.ts
// Authentication Store - NO DEFAULT ROLE, forces user role selection
// Uses new AppRole type system with multi-role support

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth } from '@devvai/devv-code-backend';
import type { AppRole } from '@/constants/roles';
import { mapBackendRole } from '@/constants/roles';

/**
 * User interface - Multi-role system without defaults
 */
interface AuthUser {
  id: string;
  uid: string;             // Alias for id (for backward compatibility)
  email: string;
  name?: string;
  roles: AppRole[];        // Available roles for this user
  activeRole?: AppRole;    // Currently active role (undefined if not chosen yet)
  mustChooseRole: boolean; // true = must display role selection screen
  createdTime?: number;    // User creation timestamp
  lastLoginTime?: number;  // Last login timestamp
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  sendOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  setUserFromBackend: (payload: any) => void;
  setRoleFromSelection: (role: AppRole) => void;
  setActiveRole: (role: AppRole) => void;
  logout: () => Promise<void>;
  checkAuth: () => void;
}

/**
 * Normalize roles from backend response
 * Returns array of valid AppRole values
 */
const normalizeRoles = (backendRoles: string[] | string | null | undefined): AppRole[] => {
  if (!backendRoles) return [];
  
  const rolesArray = Array.isArray(backendRoles) ? backendRoles : [backendRoles];
  
  const mapped = rolesArray
    .map((r) => mapBackendRole(r))
    .filter((r): r is AppRole => r !== null);
  
  // Remove duplicates
  return Array.from(new Set(mapped));
};

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
          
          // Get user from backend response
          const backendUser = response.user as any;
          const rawRoles = backendUser.roles || backendUser.role || backendUser.profiles || [];
          
          const roles = normalizeRoles(rawRoles);
          const hasRoles = roles.length > 0;
          
          console.log('🔐 Login successful:', {
            email: backendUser.email,
            rawRoles,
            normalizedRoles: roles,
            hasRoles,
          });
          
          const userId = backendUser.uid || backendUser.id || backendUser._uid;
          
          set({
            user: {
              id: userId,
              uid: userId, // Alias for backward compatibility
              email: backendUser.email,
              name: backendUser.name || backendUser.firstName || undefined,
              roles,
              // If only one role → activate it directly
              activeRole: hasRoles && roles.length === 1 ? roles[0] : undefined,
              // If no roles OR multiple roles → force role selection screen
              mustChooseRole: !hasRoles || roles.length > 1,
              createdTime: backendUser.createdTime || Date.now(),
              lastLoginTime: backendUser.lastLoginTime || Date.now(),
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      /**
       * Set user from backend payload (after login or profile check)
       * NO DEFAULT ROLE - forces role selection if needed
       */
      setUserFromBackend: (payload: any) => {
        const rawRoles = payload.roles || payload.role || payload.profiles || payload.user_roles || [];
        
        const roles = normalizeRoles(rawRoles);
        const hasRoles = roles.length > 0;
        
        console.log('👤 User set from backend:', {
          email: payload.email,
          rawRoles,
          normalizedRoles: roles,
          hasRoles,
        });
        
        const userId = payload.id || payload.uid || payload._uid;
        
        set({
          user: {
            id: userId,
            uid: userId, // Alias for backward compatibility
            email: payload.email,
            name: payload.name || payload.firstName || undefined,
            roles,
            // If only one role → activate it directly
            activeRole: hasRoles && roles.length === 1 ? roles[0] : undefined,
            // If no roles OR multiple roles → force role selection
            mustChooseRole: !hasRoles || roles.length > 1,
            createdTime: payload.createdTime || Date.now(),
            lastLoginTime: payload.lastLoginTime || Date.now(),
          },
          isAuthenticated: true,
        });
      },

      /**
       * Called when user selects a role on the SelectFirstRolePage
       * Activates the role and removes mustChooseRole flag
       */
      setRoleFromSelection: (role: AppRole) => {
        set((state) => {
          if (!state.user) return state;
          
          // Add role to roles array if not present
          const roles = state.user.roles.length
            ? Array.from(new Set([...state.user.roles, role]))
            : [role];
          
          console.log('🎭 Role selected:', role);
          
          return {
            user: {
              ...state.user,
              roles,
              activeRole: role,
              mustChooseRole: false, // ✅ Remove the flag
            },
          };
        });
      },

      /**
       * Change active role (for users with multiple roles)
       */
      setActiveRole: (role: AppRole) => {
        set((state) => {
          if (!state.user) return state;
          
          // Verify user has this role
          if (!state.user.roles.includes(role)) {
            console.error('❌ Attempted to set invalid role:', role, 'Available:', state.user.roles);
            return state;
          }
          
          console.log('🎭 Active role changed:', role);
          
          return {
            user: {
              ...state.user,
              activeRole: role,
              mustChooseRole: false,
            },
          };
        });
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

      /**
       * Check authentication status from localStorage
       */
      checkAuth: () => {
        const sid = localStorage.getItem('DEVV_CODE_SID');
        const storedUser = localStorage.getItem('auth-storage');
        
        if (sid && storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed.state?.user) {
              const user = parsed.state.user;
              
              // Normalize roles from stored data
              const normalizedRoles = normalizeRoles(user.roles || user.role);
              const hasRoles = normalizedRoles.length > 0;
              
              // If activeRole is set and valid, keep it
              const activeRole = user.activeRole && normalizedRoles.includes(user.activeRole)
                ? user.activeRole
                : (hasRoles && normalizedRoles.length === 1 ? normalizedRoles[0] : undefined);
              
              // Recalculate mustChooseRole
              const needsRoleChoice = user.mustChooseRole !== undefined
                ? user.mustChooseRole
                : (!hasRoles || normalizedRoles.length > 1);
              
              console.log('🔄 Auth check from storage:', {
                email: user.email,
                roles: normalizedRoles,
                activeRole,
                mustChooseRole: needsRoleChoice,
              });
              
              set({
                user: {
                  ...user,
                  uid: user.uid || user.id, // Ensure uid is set
                  roles: normalizedRoles,
                  activeRole,
                  mustChooseRole: needsRoleChoice,
                },
                isAuthenticated: true,
              });
            }
          } catch (error) {
            console.error('❌ Failed to parse stored auth:', error);
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
