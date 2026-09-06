/**
 * @deprecated Use RequireRole component instead
 * This component is kept for backward compatibility
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'admin' | 'agent' | 'petrolier' | 'station' | 'fleet' | 'driver'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to role selection if no active role
  if (!user?.activeRole) {
    return <Navigate to="/select-role" replace />;
  }

  // ✅ ADMIN has unrestricted access to ALL routes
  if (user?.activeRole === 'admin') {
    return <>{children}</>;
  }

  // Check role-based access for other roles (backward compatibility)
  if (allowedRoles && allowedRoles.length > 0) {
    // Map old roles to new roles for compatibility
    const roleMapping: Record<string, string> = {
      agent: 'assur_agent',
      fleet: 'fleet_manager',
      station: 'station_operator',
      driver: 'driver',
      admin: 'admin',
    };
    
    const mappedRoles = allowedRoles.map(r => roleMapping[r] || r);
    
    if (!mappedRoles.includes(user.activeRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
