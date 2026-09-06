/**
 * Settings Service - System settings management and configuration
 */

import { table } from '@devvai/devv-code-backend';
import type { SystemSetting, SettingFormData, SettingCategory, PlatformStats, SystemHealth } from '../types';

const SETTINGS_TABLE_ID = 'f4fba5pzpuyo';
const USERS_TABLE_ID = 'f4eyoj5l0wzk';
const ORDERS_TABLE_ID = 'f4f186q7i03l';
const VEHICLES_TABLE_ID = 'f4f06zbgkav4';
const POLICIES_TABLE_ID = 'f4f4hkyix7up';
const CLAIMS_TABLE_ID = 'f4f4hkylexvk';
const TRANSACTIONS_TABLE_ID = 'f4f186qchmgw';

/**
 * Get all system settings
 */
export async function getAllSettings(): Promise<SystemSetting[]> {
  try {
    const response = await table.getItems(SETTINGS_TABLE_ID);
    return response.items as SystemSetting[];
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }
}

/**
 * Get settings by category
 */
export async function getSettingsByCategory(category: SettingCategory): Promise<SystemSetting[]> {
  try {
    const allSettings = await getAllSettings();
    return allSettings.filter(s => s.category === category);
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    throw error;
  }
}

/**
 * Get a single setting by key
 */
export async function getSettingByKey(key: string): Promise<SystemSetting | null> {
  try {
    const allSettings = await getAllSettings();
    return allSettings.find(s => s.setting_key === key) || null;
  } catch (error) {
    console.error('Error fetching setting by key:', error);
    throw error;
  }
}

/**
 * Create or update a setting
 */
export async function saveSetting(data: SettingFormData, userId: string): Promise<void> {
  try {
    const existing = await getSettingByKey(data.setting_key);
    
    if (existing) {
      // Update existing setting
      await table.updateItem(SETTINGS_TABLE_ID, {
        _uid: existing._uid,
        _id: existing._id,
        setting_value: data.setting_value,
        category: data.category,
        data_type: data.data_type,
        description: data.description,
        is_public: data.is_public,
        updated_by: userId,
        updated_at: new Date().toISOString()
      });
    } else {
      // Create new setting
      await table.addItem(SETTINGS_TABLE_ID, {
        _uid: userId,
        ...data,
        updated_by: userId,
        updated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error saving setting:', error);
    throw error;
  }
}

/**
 * Delete a setting
 */
export async function deleteSetting(settingId: string, userId: string): Promise<void> {
  try {
    await table.deleteItem(SETTINGS_TABLE_ID, {
      _uid: userId,
      _id: settingId
    });
  } catch (error) {
    console.error('Error deleting setting:', error);
    throw error;
  }
}

/**
 * Get platform statistics
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const [usersResp, ordersResp, vehiclesResp, policiesResp, claimsResp, transactionsResp] = await Promise.all([
      table.getItems(USERS_TABLE_ID),
      table.getItems(ORDERS_TABLE_ID),
      table.getItems(VEHICLES_TABLE_ID),
      table.getItems(POLICIES_TABLE_ID),
      table.getItems(CLAIMS_TABLE_ID),
      table.getItems(TRANSACTIONS_TABLE_ID)
    ]);

    const users = usersResp.items as any[];
    const orders = ordersResp.items as any[];
    const vehicles = vehiclesResp.items as any[];
    const policies = policiesResp.items as any[];
    const claims = claimsResp.items as any[];
    const transactions = transactionsResp.items as any[];

    // Calculate active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = users.filter(u => 
      u.lastLogin && new Date(u.lastLogin) > thirtyDaysAgo
    ).length;

    // Calculate total revenue from completed orders
    const totalRevenue = orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Count active policies
    const activePolicies = policies.filter(p => p.status === 'active').length;

    // Count pending claims
    const pendingClaims = claims.filter(c => 
      c.status === 'submitted' || c.status === 'under_review'
    ).length;

    return {
      totalUsers: users.length,
      activeUsers,
      totalOrders: orders.length,
      totalRevenue,
      totalVehicles: vehicles.length,
      activePolicies,
      pendingClaims,
      totalTransactions: transactions.length
    };
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalVehicles: 0,
      activePolicies: 0,
      pendingClaims: 0,
      totalTransactions: 0
    };
  }
}

/**
 * Check system health status
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  try {
    // Simple health checks - in production, these would be more sophisticated
    const checks = await Promise.allSettled([
      table.getItems(SETTINGS_TABLE_ID),
      table.getItems(USERS_TABLE_ID),
      table.getItems(ORDERS_TABLE_ID),
    ]);

    const dbHealthy = checks.every(c => c.status === 'fulfilled');

    return {
      database: dbHealthy ? 'healthy' : 'error',
      storage: 'healthy',
      notifications: 'healthy',
      payments: 'healthy'
    };
  } catch (error) {
    console.error('Error checking system health:', error);
    return {
      database: 'error',
      storage: 'warning',
      notifications: 'warning',
      payments: 'warning'
    };
  }
}

/**
 * Initialize default settings if they don't exist
 */
export async function initializeDefaultSettings(userId: string): Promise<void> {
  const defaultSettings: SettingFormData[] = [
    // Platform settings
    {
      setting_key: 'platform.name',
      setting_value: 'Assur\'Trans©',
      category: 'platform',
      data_type: 'string',
      description: 'Nom de la plateforme',
      is_public: 'yes'
    },
    {
      setting_key: 'platform.currency',
      setting_value: 'XOF',
      category: 'platform',
      data_type: 'string',
      description: 'Code de devise par défaut',
      is_public: 'yes'
    },
    {
      setting_key: 'platform.country',
      setting_value: 'Sénégal',
      category: 'platform',
      data_type: 'string',
      description: 'Pays par défaut',
      is_public: 'yes'
    },
    {
      setting_key: 'platform.language',
      setting_value: 'fr',
      category: 'platform',
      data_type: 'string',
      description: 'Langue par défaut',
      is_public: 'yes'
    },
    // Fuel settings
    {
      setting_key: 'fuel.commission_rate',
      setting_value: '5',
      category: 'fuel',
      data_type: 'number',
      description: 'Taux de commission sur les ventes de carburant (%)',
      is_public: 'no'
    },
    {
      setting_key: 'fuel.min_order_amount',
      setting_value: '5000',
      category: 'fuel',
      data_type: 'number',
      description: 'Montant minimum de commande en XOF',
      is_public: 'yes'
    },
    {
      setting_key: 'fuel.max_order_amount',
      setting_value: '500000',
      category: 'fuel',
      data_type: 'number',
      description: 'Montant maximum de commande en XOF',
      is_public: 'yes'
    },
    // Insurance settings
    {
      setting_key: 'insurance.grace_period_days',
      setting_value: '30',
      category: 'insurance',
      data_type: 'number',
      description: 'Période de grâce pour paiement de prime (jours)',
      is_public: 'no'
    },
    {
      setting_key: 'insurance.claim_processing_days',
      setting_value: '7',
      category: 'insurance',
      data_type: 'number',
      description: 'Délai de traitement des réclamations (jours)',
      is_public: 'yes'
    },
    // Loyalty settings
    {
      setting_key: 'loyalty.points_per_xof',
      setting_value: '0.01',
      category: 'loyalty',
      data_type: 'number',
      description: 'Points gagnés par XOF dépensé',
      is_public: 'yes'
    },
    {
      setting_key: 'loyalty.points_expiry_days',
      setting_value: '365',
      category: 'loyalty',
      data_type: 'number',
      description: 'Durée de validité des points (jours)',
      is_public: 'yes'
    },
    // Payment settings
    {
      setting_key: 'payment.transaction_fee',
      setting_value: '100',
      category: 'payment',
      data_type: 'number',
      description: 'Frais de transaction Mobile Money (XOF)',
      is_public: 'yes'
    },
    {
      setting_key: 'payment.min_deposit',
      setting_value: '1000',
      category: 'payment',
      data_type: 'number',
      description: 'Dépôt minimum (XOF)',
      is_public: 'yes'
    },
    // Security settings
    {
      setting_key: 'security.otp_expiry_minutes',
      setting_value: '10',
      category: 'security',
      data_type: 'number',
      description: 'Durée de validité du code OTP (minutes)',
      is_public: 'no'
    },
    {
      setting_key: 'security.session_timeout_hours',
      setting_value: '24',
      category: 'security',
      data_type: 'number',
      description: 'Délai d\'expiration de session (heures)',
      is_public: 'no'
    },
    // Notification settings
    {
      setting_key: 'notification.email_enabled',
      setting_value: 'false',
      category: 'notification',
      data_type: 'boolean',
      description: 'Activer les notifications par email',
      is_public: 'no'
    },
    {
      setting_key: 'notification.sms_enabled',
      setting_value: 'false',
      category: 'notification',
      data_type: 'boolean',
      description: 'Activer les notifications par SMS',
      is_public: 'no'
    }
  ];

  try {
    for (const setting of defaultSettings) {
      const exists = await getSettingByKey(setting.setting_key);
      if (!exists) {
        await saveSetting(setting, userId);
      }
    }
  } catch (error) {
    console.error('Error initializing default settings:', error);
    throw error;
  }
}
