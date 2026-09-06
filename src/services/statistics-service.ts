/**
 * Statistics Service
 * Provides real-time statistics for different user roles
 * 
 * ✅ UPDATED: Uses correct Devv Table API (Dec 1, 2025)
 * - table.getItems(tableId, { query }) instead of table(tableId).getItems()
 * - Graceful error handling for missing tables
 * - Type-safe with proper interfaces
 */

import { table } from '@devvai/devv-code-backend';

// Table IDs
const TABLES = {
  users: 'f4eyoj5l0wzk',
  vehicles: 'f4f06zbgkav4',
  stations: 'f4f5fpwkqagg',
  orders: 'f4f186q7i03l',
  transactions: 'f4f186qchmgw',
  wallets: 'f4f186q7i03k',
  insurance_policies: 'f4f4hkyix7up',
  loyalty_accounts: 'f4f6sysp3gn4',
};

export interface AdminStats {
  totalUsers: number;
  totalTransactions: number;
  totalStations: number;
  totalVehicles: number;
  userGrowth: number;
  transactionGrowth: number;
}

export interface AgentStats {
  petrolierCount: number;
  monthlyRevenue: number;
  commissions: number;
  monthlyGoalProgress: number;
}

export interface StationStats {
  pendingOrders: number;
  todayDeliveries: number;
  todayRevenue: number;
  stockLevel: number;
}

export interface DriverStats {
  // Fuel Orders
  totalOrders?: number;
  pendingOrders?: number;
  completedOrders?: number;
  totalFuelVolume?: number;
  totalSpent?: number;
  
  // Loyalty
  loyaltyPoints?: number;
  loyaltyTier?: string;
  tierProgress?: number;
  
  // Wallet
  walletBalance?: number;
  
  // Vehicle
  vehicleRegistration?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  
  // Activity
  lastOrderDate?: string;
  
  // Legacy fields (for backward compatibility)
  vehicleAssigned?: string | null;
  insuranceStatus?: string;
  monthlyOrders?: number;
}

export interface FleetStats {
  totalVehicles: number;
  totalDrivers: number;
  activeVehicles: number;
  maintenanceAlerts: number;
}

/**
 * Helpers
 */
const isTableNotFound = (err: any): boolean =>
  typeof err?.message === 'string' &&
  err.message.includes('project table') &&
  err.message.includes('not found');

/**
 * Get admin dashboard statistics
 * ✅ FIXED: Uses correct table.getItems(tableId, { query }) API
 */
export async function getAdminStats(): Promise<AdminStats> {
  try {
    const [usersResponse, transactionsResponse, stationsResponse, vehiclesResponse] =
      await Promise.all([
        table.getItems(TABLES.users, { query: { limit: 1000 } }),
        table.getItems(TABLES.transactions, { query: { limit: 1000 } }),
        table.getItems(TABLES.stations, { query: { limit: 1000 } }),
        table.getItems(TABLES.vehicles, { query: { limit: 1000 } }),
      ]);

    const totalUsers = usersResponse.items?.length || 0;
    const totalTransactions = transactionsResponse.items?.length || 0;
    const totalStations = stationsResponse.items?.length || 0;
    const totalVehicles = vehiclesResponse.items?.length || 0;

    // Calcul de croissance (mock for now)
    const userGrowth = totalUsers > 0 ? 12 : 0;
    const transactionGrowth = totalTransactions > 0 ? 8 : 0;

    return {
      totalUsers,
      totalTransactions,
      totalStations,
      totalVehicles,
      userGrowth,
      transactionGrowth,
    };
  } catch (error: any) {
    console.error('❌ Error fetching admin stats:', error?.message);
    if (isTableNotFound(error)) {
      console.log('ℹ️ Admin stats tables not fully initialized - returning defaults');
    }
    return {
      totalUsers: 0,
      totalTransactions: 0,
      totalStations: 0,
      totalVehicles: 0,
      userGrowth: 0,
      transactionGrowth: 0,
    };
  }
}

/**
 * Get agent dashboard statistics
 * ✅ FIXED: Uses correct table.getItems(tableId, { query }) API
 */
export async function getAgentStats(agentId: string): Promise<AgentStats> {
  try {
    const [usersResponse, transactionsResponse] = await Promise.all([
      table.getItems(TABLES.users, { query: { limit: 1000 } }),
      table.getItems(TABLES.transactions, { query: { limit: 1000 } }),
    ]);

    const petroliers =
      usersResponse.items?.filter(
        (user: any) =>
          (user.role === 'petrolier' || user.role === 'station_operator') &&
          user.parent_user_id === agentId
      ) || [];

    // Revenus mensuels & commissions
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTransactions =
      transactionsResponse.items?.filter((txn: any) => {
        const txnDate = new Date(txn.created_at || txn.createdAt);
        return txnDate >= firstDayOfMonth;
      }) || [];

    const monthlyRevenue = monthlyTransactions.reduce((sum: number, txn: any) => {
      return sum + (txn.amount || txn.total_amount || 0);
    }, 0);

    const commissions = monthlyRevenue * 0.05; // 5%
    const monthlyGoal = 1_000_000; // 1M FCFA
    const monthlyGoalProgress =
      monthlyGoal > 0 ? Math.min((monthlyRevenue / monthlyGoal) * 100, 100) : 0;

    return {
      petrolierCount: petroliers.length,
      monthlyRevenue,
      commissions,
      monthlyGoalProgress,
    };
  } catch (error: any) {
    console.error('❌ Error fetching agent stats:', error?.message);
    if (isTableNotFound(error)) {
      console.log('ℹ️ Agent stats tables not fully initialized - returning defaults');
    }
    return {
      petrolierCount: 0,
      monthlyRevenue: 0,
      commissions: 0,
      monthlyGoalProgress: 0,
    };
  }
}

/**
 * Get station dashboard statistics
 * ✅ FIXED: Uses correct table.getItems(tableId, { query }) API
 */
export async function getStationStats(stationId: string): Promise<StationStats> {
  try {
    const ordersResponse = await table.getItems(TABLES.orders, { query: { limit: 1000 } });
    const allOrders = ordersResponse.items || [];

    const stationOrders = allOrders.filter(
      (order: any) => order.station_id === stationId || order.stationId === stationId
    );

    const pendingOrders = stationOrders.filter(
      (order: any) => order.status === 'dispatched' || order.status === 'pending'
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = (d: any) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    };

    const todayCompleted = stationOrders.filter(
      (order: any) =>
        (order.status === 'completed' || order.status === 'done') &&
        isToday(order.updated_at || order.updatedAt)
    );

    const todayDeliveries = todayCompleted.length;
    const todayRevenue = todayCompleted.reduce(
      (sum: number, order: any) => sum + (order.total_amount || order.totalAmount || 0),
      0
    );

    // Stock = mock for now
    const stockLevel = 100;

    return {
      pendingOrders,
      todayDeliveries,
      todayRevenue,
      stockLevel,
    };
  } catch (error: any) {
    console.error('❌ Error fetching station stats:', error?.message);
    if (isTableNotFound(error)) {
      console.log('ℹ️ Station stats tables not fully initialized - returning defaults');
    }
    return {
      pendingOrders: 0,
      todayDeliveries: 0,
      todayRevenue: 0,
      stockLevel: 100,
    };
  }
}

/**
 * Get driver dashboard statistics (legacy version)
 * ✅ FIXED: Uses correct table.getItems(tableId, { query }) API
 */
export async function getDriverStats(driverId: string): Promise<DriverStats> {
  try {
    const [vehiclesResponse, loyaltyResponse, insuranceResponse, ordersResponse] =
      await Promise.allSettled([
        table.getItems(TABLES.vehicles, { query: { limit: 1000 } }),
        table.getItems(TABLES.loyalty_accounts, { query: { limit: 1000 } }),
        table.getItems(TABLES.insurance_policies, { query: { limit: 1000 } }),
        table.getItems(TABLES.orders, { query: { limit: 1000 } }),
      ]);

    // Extract data with graceful error handling
    const vehicles =
      vehiclesResponse.status === 'fulfilled' ? vehiclesResponse.value.items || [] : [];
    const loyalty =
      loyaltyResponse.status === 'fulfilled' ? loyaltyResponse.value.items || [] : [];
    const insurance =
      insuranceResponse.status === 'fulfilled' ? insuranceResponse.value.items || [] : [];
    const orders =
      ordersResponse.status === 'fulfilled' ? ordersResponse.value.items || [] : [];

    // Vehicle data
    const driverVehicle = vehicles.find(
      (v: any) => v.assigned_driver_id === driverId || v.driverId === driverId
    );

    // Loyalty data
    const loyaltyData = loyalty.find(
      (lp: any) => lp._uid === driverId || lp.user_id === driverId
    );
    const loyaltyPoints = loyaltyData?.available_points || 0;
    const loyaltyTier = loyaltyData?.tier || 'bronze';

    // Insurance data
    const activeInsurance = insurance.find(
      (policy: any) =>
        (policy.driver_id === driverId || policy.driverId === driverId) &&
        policy.status === 'active'
    );
    const insuranceStatus = activeInsurance ? 'Active' : 'Inactive';

    // Orders data
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyOrders = orders.filter((order: any) => {
      const orderDate = new Date(order.created_at || order.createdAt);
      return (
        (order.user_id === driverId || order.driverId === driverId) &&
        orderDate >= firstDayOfMonth
      );
    }).length;

    return {
      vehicleAssigned: driverVehicle?.plate_number || driverVehicle?.registration || null,
      vehicleBrand: driverVehicle
        ? `${driverVehicle.brand || ''} ${driverVehicle.model || ''}`.trim() || null
        : null,
      loyaltyPoints,
      loyaltyTier,
      insuranceStatus,
      monthlyOrders,
    };
  } catch (error: any) {
    console.error('❌ Error fetching driver stats:', error?.message);
    if (isTableNotFound(error)) {
      console.log('ℹ️ Driver stats tables not fully initialized - returning defaults');
    }
    return {
      vehicleAssigned: null,
      vehicleBrand: null,
      loyaltyPoints: 0,
      loyaltyTier: 'Bronze',
      insuranceStatus: 'Inactive',
      monthlyOrders: 0,
    };
  }
}

/**
 * Get fleet manager dashboard statistics
 * ✅ FIXED: Uses correct table.getItems(tableId, { query }) API
 */
export async function getFleetStats(fleetManagerId: string): Promise<FleetStats> {
  try {
    const vehiclesResponse = await table.getItems(TABLES.vehicles, { query: { limit: 1000 } });

    const fleetVehicles =
      vehiclesResponse.items?.filter(
        (v: any) =>
          v.fleet_manager_id === fleetManagerId || v.fleetManagerId === fleetManagerId
      ) || [];

    const totalVehicles = fleetVehicles.length;

    const assignedDrivers = new Set(
      fleetVehicles
        .filter((v: any) => v.assigned_driver_id || v.driverId)
        .map((v: any) => v.assigned_driver_id || v.driverId)
    );
    const totalDrivers = assignedDrivers.size;

    const activeVehicles = fleetVehicles.filter(
      (v: any) => v.assigned_driver_id || v.driverId
    ).length;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const maintenanceAlerts = fleetVehicles.filter((v: any) => {
      if (!v.next_service_date && !v.nextServiceDate) return false;
      const serviceDate = new Date(v.next_service_date || v.nextServiceDate);
      return serviceDate <= thirtyDaysFromNow;
    }).length;

    return {
      totalVehicles,
      totalDrivers,
      activeVehicles,
      maintenanceAlerts,
    };
  } catch (error: any) {
    console.error('❌ Error fetching fleet stats:', error?.message);
    if (isTableNotFound(error)) {
      console.log('ℹ️ Fleet stats tables not fully initialized - returning defaults');
    }
    return {
      totalVehicles: 0,
      totalDrivers: 0,
      activeVehicles: 0,
      maintenanceAlerts: 0,
    };
  }
}
