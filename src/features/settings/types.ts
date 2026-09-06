/**
 * Settings Types - System configuration and admin panel types
 */

export type SettingCategory = 
  | 'platform' 
  | 'fuel' 
  | 'insurance' 
  | 'loyalty' 
  | 'payment' 
  | 'security' 
  | 'notification';

export type SettingDataType = 'string' | 'number' | 'boolean' | 'json';

export interface SystemSetting {
  _id: string;
  _uid: string;
  setting_key: string;
  setting_value: string;
  category: SettingCategory;
  data_type: SettingDataType;
  description: string;
  is_public: 'yes' | 'no';
  updated_by: string;
  updated_at: string;
}

export interface SettingFormData {
  setting_key: string;
  setting_value: string;
  category: SettingCategory;
  data_type: SettingDataType;
  description: string;
  is_public: 'yes' | 'no';
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalVehicles: number;
  activePolicies: number;
  pendingClaims: number;
  totalTransactions: number;
}

export interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
  notifications: 'healthy' | 'warning' | 'error';
  payments: 'healthy' | 'warning' | 'error';
}
