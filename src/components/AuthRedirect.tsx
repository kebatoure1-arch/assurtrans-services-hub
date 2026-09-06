import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { ROLE_ROUTES } from '@/constants/roles';

/**
 * Composant de redirection automatique basé sur l'état d'authentification
 * 
 * Logique de redirection :
 * 1. Si pas authentifié → /login
 * 2. Si authentifié mais mustChooseRole → /select-role
 * 3. Si authentifié avec rôle actif → dashboard selon rôle
 * 
 * À monter sur la route racine "/" pour gérer l'entrée dans l'app
 */
export const AuthRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Pas connecté → login
    if (!isAuthenticated || !user) {
      console.log('🔒 Not authenticated → redirecting to /login');
      navigate('/login', { replace: true });
      return;
    }

    // Première connexion → choix Chauffeur / Gestionnaire
    if (user.mustChooseRole) {
      console.log('🎭 User must choose role → redirecting to /select-role');
      navigate('/select-role', { replace: true });
      return;
    }

    // Vérification que l'utilisateur a un rôle actif
    if (!user.activeRole) {
      console.warn('⚠️ No active role set, redirecting to /select-role');
      navigate('/select-role', { replace: true });
      return;
    }

    // Redirection selon le rôle actif
    const route = ROLE_ROUTES[user.activeRole];
    console.log('✅ Authenticated with role:', user.activeRole, '→ redirecting to', route);
    
    // Vérification de sécurité
    if (!route) {
      console.error('❌ Invalid activeRole:', user.activeRole);
      navigate('/dashboard', { replace: true });
      return;
    }
    
    navigate(route, { replace: true });
  }, [user, isAuthenticated, navigate]);

  // Composant invisible, juste pour la logique de redirection
  return null;
};
