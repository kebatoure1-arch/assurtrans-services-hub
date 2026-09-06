/**
 * Role Compatibility Layer
 * Provides helpers for migrating from old role system to new AppRole system
 * 
 * Use this temporarily during migration period
 */

import type { AppRole } from '@/constants/roles';

/**
 * Map old role strings to new AppRole types
 */
export const mapLegacyRole = (oldRole: string): AppRole | null => {
  const mapping: Record<string, AppRole> = {
    'user': 'driver',
    'driver': 'driver',
    'fleet': 'fleet_manager',
    'agent': 'assur_agent',
    'petrolier': 'assur_agent',
    'station': 'station_operator',
    'admin': 'admin',
  };
  
  return mapping[oldRole] || null;
};

/**
 * Check if user's active role matches one of the allowed roles
 * Supports both old and new role strings for backward compatibility
 */
export const hasRole = (activeRole: AppRole | string | undefined | null, allowedRoles: (AppRole | string)[]): boolean => {
  if (!activeRole) return false;
  
  // Direct match
  if (allowedRoles.includes(activeRole)) return true;
  
  // Try mapping if old role
  const mapped = mapLegacyRole(activeRole);
  if (mapped && allowedRoles.includes(mapped)) return true;
  
  // Try mapping allowed roles if they're old
  const mappedAllowed = allowedRoles.map(r => mapLegacyRole(r as string)).filter(Boolean);
  return mappedAllowed.includes(activeRole as AppRole);
};

/**
 * Get role label (works with both old and new roles)
 */
export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    // New roles
    'driver': 'Chauffeur',
    'fleet_manager': 'Client Flotte',
    'assur_agent': "Agent Assur'Trans",
    'station_operator': 'Pompiste / Station OLA',
    'admin': 'Administrateur',
    // Old roles (for backward compatibility)
    'fleet': 'Client Flotte',
    'agent': "Agent Assur'Trans",
    'petrolier': "Agent Assur'Trans",
    'station': 'Pompiste / Station OLA',
    'user': 'Chauffeur',
  };
  
  return labels[role] || role;
};
