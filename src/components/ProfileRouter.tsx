// Profile Router - Route to role-specific profile page

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

// Import all role-specific profile pages
import AdminProfilePage from '@/pages/profiles/AdminProfilePage';
import AgentProfilePage from '@/pages/profiles/AgentProfilePage';
import PetrolierProfilePage from '@/pages/profiles/PetrolierProfilePage';
import StationProfilePage from '@/pages/profiles/StationProfilePage';
import FleetProfilePage from '@/pages/profiles/FleetProfilePage';
import DriverProfilePage from '@/pages/profiles/DriverProfilePage';

export default function ProfileRouter() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#789D9A] mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de votre profil...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Redirect to role selection if no active role
  if (!user.activeRole) {
    navigate('/select-role');
    return null;
  }

  // Route to role-specific profile page based on active role
  switch (user.activeRole) {
    case 'admin':
      return <AdminProfilePage />;
    case 'assur_agent':
      return <AgentProfilePage />;
    case 'fleet_manager':
      return <FleetProfilePage />;
    case 'station_operator':
      return <StationProfilePage />;
    case 'driver':
      return <DriverProfilePage />;
    default:
      // Fallback to driver profile for unknown roles
      return <DriverProfilePage />;
  }
}
