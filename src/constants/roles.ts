// src/constants/roles.ts
// Role Type Definitions and Mapping Utilities for Assur'Trans
// Eliminates default 'driver' role, forces user role selection

export type AppRole =
  | 'driver'           // Chauffeur
  | 'fleet_manager'    // Gestionnaire / Manager de flotte
  | 'assur_agent'      // Agent Assur'Trans
  | 'station_operator' // Pompiste / Station
  | 'admin';           // Admin plateforme

/**
 * Human-readable labels for each role
 */
export const ROLE_LABELS: Record<AppRole, string> = {
  driver: 'Chauffeur',
  fleet_manager: 'Gestionnaire de flottes',
  assur_agent: 'Agent Assur\'Trans',
  station_operator: 'Station-service / Pompiste',
  admin: 'Administrateur',
};

/**
 * Map legacy backend role strings to new AppRole type
 * Returns null if the role cannot be mapped
 */
export const mapBackendRole = (backendRole: string): AppRole | null => {
  const r = backendRole?.toLowerCase();
  
  // Driver mappings
  if (r === 'user' || r === 'driver') return 'driver';
  
  // Fleet manager mappings
  if (r === 'fleet' || r === 'manager' || r === 'fleet_manager') return 'fleet_manager';
  
  // Agent mappings
  if (r === 'agent' || r === 'assur_agent') return 'assur_agent';
  
  // Station operator mappings
  if (r === 'station' || r === 'station_operator' || r === 'petrolier') return 'station_operator';
  
  // Admin mapping
  if (r === 'admin') return 'admin';
  
  return null;
};

/**
 * Get dashboard route for a given role
 */
export const ROLE_ROUTES: Record<AppRole, string> = {
  driver: '/dashboard/driver',
  fleet_manager: '/fleet/dashboard',
  assur_agent: '/dashboard/agent',
  station_operator: '/dashboard/station',
  admin: '/dashboard',
};

/**
 * Get icon name for a given role (for UI display)
 */
export const ROLE_ICONS: Record<AppRole, string> = {
  driver: 'Fuel',
  fleet_manager: 'Users',
  assur_agent: 'Shield',
  station_operator: 'Building2',
  admin: 'Crown',
};

/**
 * Get description for a given role
 */
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  driver: "Passer des commandes carburant, suivre mon historique et mon portefeuille.",
  fleet_manager: "Gérer ma flotte, allouer le carburant et suivre les chauffeurs.",
  assur_agent: "Accompagner les clients, gérer les comptes et la relation Assur'Trans.",
  station_operator: "Scanner les QR codes, valider les livraisons en station.",
  admin: "Administrer l'ensemble de la plateforme (accès complet).",
};

/**
 * Get subtitle for a given role (for cards)
 */
export const ROLE_SUBTITLES: Record<AppRole, string> = {
  driver: 'Profil utilisateur chauffeur',
  fleet_manager: 'Profil gestionnaire de flotte',
  assur_agent: 'Profil agent Assur\'Trans',
  station_operator: 'Profil station / pompiste',
  admin: 'Profil administrateur',
};
