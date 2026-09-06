// src/lib/driver-stats.ts
// Driver Statistics Service - lecture des stats chauffeur avec fallback

import { table } from '@devvai/devv-code-backend';

// IDs Devv (déjà vérifiés)
const ORDERS_TABLE_ID = 'f4f186q7i03l';
const LOYALTY_ACCOUNTS_TABLE_ID = 'f4f6sysp3gn4';
const WALLETS_TABLE_ID = 'f4f186q7i03k';
const VEHICLES_TABLE_ID = 'f4f06zbgkav4';

export interface DriverStats {
  // Commandes carburant
  totalOrders?: number;
  pendingOrders?: number;
  completedOrders?: number;
  totalFuelVolume?: number;
  totalSpent?: number;

  // Fidélité
  loyaltyPoints?: number;
  loyaltyTier?: string;
  tierProgress?: number;

  // Portefeuille
  walletBalance?: number;

  // Véhicule
  vehicleRegistration?: string;
  vehicleBrand?: string;
  vehicleModel?: string;

  // Activité
  lastOrderDate?: string;
}

/**
 * Fetch driver statistics with graceful error handling
 * Retourne null si aucune stat → le profil affiche le message "Bienvenue…"
 */
export async function fetchDriverStats(userId: string): Promise<DriverStats | null> {
  try {
    const stats: DriverStats = {};

    await Promise.allSettled([
      loadOrderStats(userId, stats),
      loadLoyaltyStats(userId, stats),
      loadWalletStats(userId, stats),
      loadVehicleStats(userId, stats),
    ]);

    const hasAnyStats = Object.keys(stats).length > 0;

    if (!hasAnyStats) {
      console.log('ℹ️ No driver stats available yet for user:', userId);
      return null;
    }

    return stats;
  } catch (err: any) {
    console.error('❌ Unexpected error fetching driver stats:', err);

    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Stats tables not found - acceptable on fresh env');
      return null;
    }

    return null;
  }
}

/**
 * Commandes carburant
 */
async function loadOrderStats(userId: string, stats: DriverStats): Promise<void> {
  try {
    const ordersResult = await table.getItems(ORDERS_TABLE_ID, {
      query: { _uid: userId },
    });

    const orders = (ordersResult as any).items || [];

    if (orders.length === 0) return;

    stats.totalOrders = orders.length;
    stats.pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
    stats.completedOrders = orders.filter((o: any) => o.status === 'completed').length;

    stats.totalSpent = orders.reduce((sum: number, order: any) => {
      return sum + (parseFloat(order.totalAmount) || 0);
    }, 0);

    stats.totalFuelVolume = orders.reduce((sum: number, order: any) => {
      return sum + (parseFloat(order.quantity) || 0);
    }, 0);

    const sortedOrders = [...orders].sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    stats.lastOrderDate = sortedOrders[0].createdAt;
  } catch (err: any) {
    console.warn('⚠️ Could not load order stats (graceful fallback):', err?.message);

    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Orders table not yet initialized');
    }
  }
}

/**
 * Points de fidélité
 */
async function loadLoyaltyStats(userId: string, stats: DriverStats): Promise<void> {
  try {
    const loyaltyResult = await table.getItems(LOYALTY_ACCOUNTS_TABLE_ID, {
      query: { user_id: userId },
      limit: 1,
    });

    const loyalty = ((loyaltyResult as any).items || [])[0];

    if (loyalty) {
      stats.loyaltyPoints = loyalty.available_points || 0;
      stats.loyaltyTier = loyalty.tier || 'bronze';
      stats.tierProgress = loyalty.tier_progress || 0;
    }
  } catch (err: any) {
    console.warn('⚠️ Could not load loyalty stats (graceful fallback):', err?.message);

    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Loyalty table not yet initialized');
    }
  }
}

/**
 * Portefeuille
 */
async function loadWalletStats(userId: string, stats: DriverStats): Promise<void> {
  try {
    const walletsResult = await table.getItems(WALLETS_TABLE_ID, {
      query: { userId },
      limit: 1,
    });

    const wallet = ((walletsResult as any).items || [])[0];

    if (wallet) {
      stats.walletBalance = parseFloat(wallet.balance) || 0;
    }
  } catch (err: any) {
    console.warn('⚠️ Could not load wallet stats (graceful fallback):', err?.message);

    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Wallet table not yet initialized');
    }
  }
}

/**
 * Véhicule
 */
async function loadVehicleStats(userId: string, stats: DriverStats): Promise<void> {
  try {
    const vehiclesResult = await table.getItems(VEHICLES_TABLE_ID, {
      query: { driverId: userId }, // ⚠️ Doit correspondre EXACTEMENT au champ de ta table
      limit: 1,
    });

    const vehicle = ((vehiclesResult as any).items || [])[0];

    if (vehicle) {
      stats.vehicleRegistration = vehicle.registration;
      stats.vehicleBrand = vehicle.brand;
      stats.vehicleModel = vehicle.model;
    }
  } catch (err: any) {
    console.warn('⚠️ Could not load vehicle stats (graceful fallback):', err?.message);

    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Vehicle table not yet initialized');
    }
  }
}
