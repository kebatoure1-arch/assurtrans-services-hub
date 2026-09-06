import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import type { AppRole } from '@/constants/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { ROLE_LABELS } from '@/constants/roles';

interface RequireRoleProps {
  allowedRoles: AppRole[];
  children: React.ReactElement;
}

/**
 * Composant de protection de route basé sur le rôle actif
 * 
 * - Redirige vers /login si pas authentifié
 * - Redirige vers /select-role si aucun rôle actif sélectionné
 * - Affiche une page d'erreur si le rôle actif n'est pas autorisé
 */
export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);

  // Pas d'utilisateur → Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Pas de rôle actif sélectionné → Sélection de profil
  if (!user.activeRole) {
    return <Navigate to="/select-role" replace />;
  }

  // Vérifier si le rôle actif est autorisé
  if (!allowedRoles.includes(user.activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            Vous n'avez pas les droits nécessaires pour accéder à cette section avec votre profil actuel.
          </p>

          {/* Info Box */}
          <div className="bg-slate-100 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Votre profil actuel :</strong> {ROLE_LABELS[user.activeRole]}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Profils requis :</strong> {allowedRoles.map((r) => ROLE_LABELS[r]).join(', ')}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {user.roles.length > 1 && (
              <Button 
                onClick={() => window.location.href = '/select-role'} 
                className="w-full"
              >
                Changer de profil
              </Button>
            )}
            <Button 
              onClick={() => window.history.back()} 
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Rôle autorisé → Afficher le contenu
  return children;
}
