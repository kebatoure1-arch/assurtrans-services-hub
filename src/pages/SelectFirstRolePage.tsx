// src/pages/SelectFirstRolePage.tsx
// Role Selection Page - Multi-profile system
// Offers all available roles or user-specific roles

import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import type { AppRole } from '@/constants/roles';
import { 
  ROLE_LABELS, 
  ROLE_ROUTES, 
  ROLE_DESCRIPTIONS, 
  ROLE_SUBTITLES 
} from '@/constants/roles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Fuel, Users, Shield, Building2, Crown } from 'lucide-react';

export const SelectFirstRolePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setRoleFromSelection = useAuthStore((s) => s.setRoleFromSelection);

  // Security redirections
  useEffect(() => {
    if (!user) {
      console.log('🔒 No user found, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (!user.mustChooseRole) {
      // If no longer needs to choose, redirect to root
      console.log('✅ Role already chosen, redirecting to dashboard');
      navigate('/', { replace: true });
      return;
    }
  }, [user, navigate]);

  if (!user || !user.mustChooseRole) return null;

  /**
   * Roles to offer:
   * - If user.roles is empty → offer all non-admin roles (first-time users, dev, superusers)
   * - If user.roles contains roles → offer only those roles
   */
  const selectableRoles: AppRole[] = useMemo(() => {
    if (!user.roles || user.roles.length === 0) {
      // Offer all roles except admin for new users
      return ['driver', 'fleet_manager', 'assur_agent', 'station_operator'];
    }
    return user.roles;
  }, [user.roles]);

  const handleSelect = (role: AppRole) => {
    console.log('🎯 User selected role:', role);
    setRoleFromSelection(role);

    // Redirect based on selected role
    const route = ROLE_ROUTES[role];
    console.log('🚀 Redirecting to:', route);
    navigate(route, { replace: true });
  };

  // Role metadata with icons
  const roleMeta: Record<AppRole, { icon: React.ElementType; color: string }> = {
    driver: {
      icon: Fuel,
      color: 'bg-blue-100 text-blue-700',
    },
    fleet_manager: {
      icon: Users,
      color: 'bg-green-100 text-green-700',
    },
    assur_agent: {
      icon: Shield,
      color: 'bg-purple-100 text-purple-700',
    },
    station_operator: {
      icon: Building2,
      color: 'bg-orange-100 text-orange-700',
    },
    admin: {
      icon: Crown,
      color: 'bg-red-100 text-red-700',
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl w-full space-y-6 border border-slate-200">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Choisissez votre profil</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Bonjour <span className="font-semibold text-slate-900">{user.email}</span>.
            {' '}Sélectionnez le rôle avec lequel vous souhaitez utiliser Assur'Trans©.
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {selectableRoles.map((role) => {
            const Icon = roleMeta[role].icon;
            const colorClass = roleMeta[role].color;
            
            return (
              <Card
                key={role}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
                onClick={() => handleSelect(role)}
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <div className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{ROLE_LABELS[role]}</CardTitle>
                    <CardDescription className="text-xs">
                      {ROLE_SUBTITLES[role]}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-blue-900">
                Pourquoi choisir un profil ?
              </p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Chaque profil offre des fonctionnalités adaptées à vos besoins. 
                Vous pourrez changer de profil à tout moment depuis vos paramètres si vous avez plusieurs rôles.
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center pt-2">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/login')} 
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Revenir à la page de connexion
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SelectFirstRolePage;
