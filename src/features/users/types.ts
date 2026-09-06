/**
 * Types pour la gestion des utilisateurs
 * Utilise les nouveaux rôles officiels Assur'Trans
 */
import type { AppRole } from '@/constants/roles';

/**
 * @deprecated Use AppRole from @/constants/roles instead
 * Kept for backward compatibility during migration
 */
export type UserRole = 'admin' | 'agent' | 'petrolier' | 'station' | 'fleet' | 'driver';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  _id: string;
  _uid: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: UserRole; // Legacy: Will be migrated to AppRole
  roles?: AppRole[]; // New: Multi-role support
  status: UserStatus;
  companyName?: string;
  address?: string;
  city?: string;
  country?: string;
  parentId?: string;
  createdBy?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface CreateUserData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  companyName?: string;
  address?: string;
  city?: string;
  country?: string;
  status: string;
}
