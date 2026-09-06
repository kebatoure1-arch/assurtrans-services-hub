import { table } from '@devvai/devv-code-backend';

/**
 * Profile Statistics Service
 * Provides user statistics and activity metrics across different modules
 */

export interface ProfileStats {
  // Orders & Spending
  totalOrders?: number;
  totalSpent?: number;
  pendingOrders?: number;
  completedOrders?: number;
  
  // Loyalty
  loyaltyPoints?: number;
  loyaltyTier?: string;
  tierProgress?: number;
  
  // Fleet Management
  vehiclesCount?: number;
  activeVehicles?: number;
  maintenanceAlerts?: number;
  
  // Insurance
  activePolicies?: number;
  pendingClaims?: number;
  totalPremiumPaid?: number;
  
  // Activity
  lastActivity?: string;
  joinedDate?: string;
  totalTransactions?: number;
  
  // Wallet
  walletBalance?: number;
}

class ProfileStatsService {
  /**
   * Get comprehensive user statistics
   */
  async getUserStats(userId: string, userRole: string): Promise<ProfileStats> {
    const stats: ProfileStats = {};

    try {
      // Load different stats based on role
      await Promise.allSettled([
        this.loadOrderStats(userId, userRole, stats),
        this.loadLoyaltyStats(userId, userRole, stats),
        this.loadVehicleStats(userId, userRole, stats),
        this.loadInsuranceStats(userId, userRole, stats),
        this.loadWalletStats(userId, userRole, stats),
      ]);

      return stats;
    } catch (error) {
      console.error('Failed to load user stats:', error);
      return stats;
    }
  }

  /**
   * Load order statistics
   */
  private async loadOrderStats(
    userId: string, 
    role: string, 
    stats: ProfileStats
  ): Promise<void> {
    if (role !== 'fleet_manager' && role !== 'driver') return;

    try {
      const ordersResult = await table.getItems('f4f186q7i03l'); // orders table (CORRECT ID)
      const orders = ((ordersResult as any).items || []).filter(
        (order: any) => order._uid === userId
      );
      
      stats.totalOrders = orders.length;
      stats.pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
      stats.completedOrders = orders.filter((o: any) => o.status === 'completed').length;
      stats.totalSpent = orders.reduce((sum: number, order: any) => {
        return sum + (parseFloat(order.totalAmount) || 0);
      }, 0);
      
      if (orders.length > 0) {
        stats.lastActivity = new Date(
          Math.max(...orders.map((o: any) => new Date(o.createdAt).getTime()))
        ).toISOString();
      }
    } catch (err: any) {
      console.warn('Failed to load order stats (graceful fallback):', err.message);
      
      // Specific handling for table not found
      if (
        typeof err?.message === 'string' &&
        err.message.includes('project table') &&
        err.message.includes('not found')
      ) {
        console.log('ℹ️ Orders table not yet initialized - this is normal for new users');
        return;
      }
    }
  }

  /**
   * Load loyalty statistics
   */
  private async loadLoyaltyStats(
    userId: string, 
    role: string, 
    stats: ProfileStats
  ): Promise<void> {
    if (role !== 'driver') return;

    try {
      const loyaltyResult = await table.getItems('f4f6sysp3gn4'); // loyalty_accounts table
      const loyalty = ((loyaltyResult as any).items || []).find(
        (l: any) => l._uid === userId
      );
      
      if (loyalty) {
        stats.loyaltyPoints = loyalty.available_points || 0;
        stats.loyaltyTier = loyalty.tier || 'bronze';
        
        // Use tier_progress from loyalty account
        stats.tierProgress = loyalty.tier_progress || 0;
      }
    } catch (err) {
      console.warn('Failed to load loyalty stats:', err);
    }
  }

  /**
   * Load vehicle statistics
   */
  private async loadVehicleStats(
    userId: string, 
    role: string, 
    stats: ProfileStats
  ): Promise<void> {
    if (role !== 'fleet') return;

    try {
      const vehiclesResult = await table.getItems('f4f06zbgkav4'); // vehicles table
      const vehicles = ((vehiclesResult as any).items || []).filter(
        (v: any) => v._uid === userId
      );
      
      stats.vehiclesCount = vehicles.length;
      stats.activeVehicles = vehicles.filter(
        (v: any) => v.status === 'active'
      ).length;
      stats.maintenanceAlerts = vehicles.filter((v: any) => {
        const nextService = new Date(v.next_service_date);
        const now = new Date();
        const daysUntil = Math.floor((nextService.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30 && daysUntil >= 0;
      }).length;
    } catch (err) {
      console.warn('Failed to load vehicle stats:', err);
    }
  }

  /**
   * Load insurance statistics
   */
  private async loadInsuranceStats(
    userId: string, 
    role: string, 
    stats: ProfileStats
  ): Promise<void> {
    if (role !== 'driver' && role !== 'fleet') return;

    try {
      // Load policies
      const policiesResult = await table.getItems('f4f4hkyix7up'); // insurance_policies table
      const policies = ((policiesResult as any).items || []).filter(
        (p: any) => p._uid === userId
      );
      
      stats.activePolicies = policies.filter(
        (p: any) => p.status === 'active'
      ).length;
      stats.totalPremiumPaid = policies.reduce((sum: number, policy: any) => {
        return sum + (parseFloat(policy.premium_amount) || 0);
      }, 0);

      // Load claims
      const claimsResult = await table.getItems('f4f4hkylexvk'); // insurance_claims table
      const claims = ((claimsResult as any).items || []).filter(
        (c: any) => c._uid === userId
      );
      
      stats.pendingClaims = claims.filter(
        (c: any) => c.status === 'pending' || c.status === 'in_review'
      ).length;
    } catch (err) {
      console.warn('Failed to load insurance stats:', err);
    }
  }

  /**
   * Load wallet statistics
   */
  private async loadWalletStats(
    userId: string, 
    role: string, 
    stats: ProfileStats
  ): Promise<void> {
    if (role === 'admin') return; // Admins don't have wallets

    try {
      const walletsResult = await table.getItems('f4f186q7i03k'); // wallets table
      const wallet = ((walletsResult as any).items || []).find(
        (w: any) => w._uid === userId
      );
      
      if (wallet) {
        stats.walletBalance = parseFloat(wallet.balance) || 0;
      }

      // Load transaction count
      const transactionsResult = await table.getItems('f4f186qchmgw'); // transactions table
      const transactions = ((transactionsResult as any).items || []).filter(
        (t: any) => t._uid === userId
      );
      
      stats.totalTransactions = transactions.length;
    } catch (err) {
      console.warn('Failed to load wallet stats:', err);
    }
  }

  /**
   * Get quick stats for dashboard cards
   */
  async getQuickStats(userId: string, userRole: string): Promise<{
    label: string;
    value: string | number;
    icon: string;
    trend?: number;
  }[]> {
    const stats = await this.getUserStats(userId, userRole);
    const quickStats: any[] = [];

    // Role-specific quick stats
    if (userRole === 'fleet_manager' || userRole === 'driver') {
      if (stats.totalOrders !== undefined) {
        quickStats.push({
          label: 'Commandes',
          value: stats.totalOrders,
          icon: 'Activity',
          trend: stats.pendingOrders || 0,
        });
      }
      if (stats.totalSpent !== undefined) {
        quickStats.push({
          label: 'Dépenses',
          value: `${stats.totalSpent.toLocaleString('fr-FR')} FCFA`,
          icon: 'DollarSign',
        });
      }
    }

    if (userRole === 'driver') {
      if (stats.loyaltyPoints !== undefined) {
        quickStats.push({
          label: 'Points Fidélité',
          value: stats.loyaltyPoints,
          icon: 'Award',
        });
      }
    }

    if (userRole === 'fleet_manager') {
      if (stats.vehiclesCount !== undefined) {
        quickStats.push({
          label: 'Véhicules',
          value: stats.vehiclesCount,
          icon: 'TrendingUp',
        });
      }
    }

    return quickStats;
  }
}

export const profileStatsService = new ProfileStatsService();
