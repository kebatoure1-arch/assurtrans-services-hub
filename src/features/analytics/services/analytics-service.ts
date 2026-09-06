/**
 * Analytics Service - Provides comprehensive data analytics and reporting
 */

import { table } from '@devvai/devv-code-backend';
import type {
  AnalyticsSummary,
  DateRange,
  RevenueData,
  OrderTrendData,
  UserGrowthData,
  ProductPerformanceData,
  StationPerformanceData,
  InsuranceData,
  LoyaltyData,
} from '../types';

/**
 * Get date filter based on date range
 */
function getDateFilter(range: DateRange): number {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  switch (range) {
    case '7d':
      return now - (7 * day);
    case '30d':
      return now - (30 * day);
    case '90d':
      return now - (90 * day);
    case '1y':
      return now - (365 * day);
    case 'all':
      return 0;
    default:
      return now - (30 * day);
  }
}

/**
 * Get analytics summary for admin dashboard
 */
export async function getAnalyticsSummary(range: DateRange = '30d'): Promise<AnalyticsSummary> {
  try {
    const dateFilter = getDateFilter(range);

    // Fetch all data in parallel
    const [
      ordersData,
      usersData,
      vehiclesData,
      transactionsData,
      policiesData,
      claimsData,
      productsData,
      stationsData,
      loyaltyPointsData,
      loyaltyTiersData,
    ] = await Promise.all([
      table.getItems('f4f186q7i03l'),
      table.getItems('f4eyoj5l0wzk'),
      table.getItems('f4f06zbgkav4'),
      table.getItems('f4f186qchmgw'),
      table.getItems('f4f4hkyix7up'),
      table.getItems('f4f4hkylexvk'),
      table.getItems('f4f186q7i03m'),
      table.getItems('f4f5fpwkqagg'),
      table.getItems('f4f6sysp3gn4'), // loyalty_accounts
      table.getItems('f4fb4hcprsvk'),
    ]);

    // Filter by date range
    const filteredOrders = ordersData.items.filter((order: any) => 
      new Date(order.createdAt).getTime() >= dateFilter
    );

    const filteredTransactions = transactionsData.items.filter((tx: any) => 
      new Date(tx.createdAt).getTime() >= dateFilter
    );

    const filteredPolicies = policiesData.items.filter((policy: any) => 
      new Date(policy.enrollmentDate).getTime() >= dateFilter
    );

    const filteredClaims = claimsData.items.filter((claim: any) => 
      new Date(claim.submittedAt).getTime() >= dateFilter
    );

    // Calculate stats
    const totalRevenue = filteredTransactions.reduce((sum: number, tx: any) => 
      sum + (tx.amount || 0), 0
    );

    const totalOrders = filteredOrders.length;
    const totalUsers = usersData.items.length;
    const totalVehicles = vehiclesData.items.length;
    const activeDrivers = usersData.items.filter((u: any) => u.role === 'driver').length;
    const activeFleets = usersData.items.filter((u: any) => u.role === 'fleet_manager').length;
    const totalInsurancePolicies = filteredPolicies.length;
    const totalClaims = filteredClaims.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = totalUsers > 0 ? (totalOrders / totalUsers) * 100 : 0;

    // Revenue data by date
    const revenueData = generateRevenueData(filteredOrders, filteredTransactions, range);

    // Order trends
    const orderTrends = generateOrderTrends(filteredOrders, range);

    // User growth
    const userGrowth = generateUserGrowth(usersData.items, range);

    // Product performance
    const productPerformance = generateProductPerformance(filteredOrders, productsData.items);

    // Station performance
    const stationPerformance = generateStationPerformance(filteredOrders, stationsData.items);

    // Insurance data
    const insuranceData = generateInsuranceData(filteredPolicies, filteredClaims, range);

    // Loyalty data
    const loyaltyData = generateLoyaltyData(loyaltyPointsData.items, loyaltyTiersData.items);

    return {
      stats: {
        totalRevenue,
        totalOrders,
        totalUsers,
        totalVehicles,
        activeDrivers,
        activeFleets,
        totalInsurancePolicies,
        totalClaims,
        averageOrderValue,
        conversionRate,
      },
      revenueData,
      orderTrends,
      userGrowth,
      productPerformance,
      stationPerformance,
      insuranceData,
      loyaltyData,
    };
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    throw error;
  }
}

function generateRevenueData(orders: any[], transactions: any[], range: DateRange): RevenueData[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const data: RevenueData[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOrders = orders.filter((o: any) => 
      o.createdAt?.startsWith(dateStr)
    );
    
    const dayTransactions = transactions.filter((t: any) => 
      t.createdAt?.startsWith(dateStr)
    );
    
    const revenue = dayTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    const fuelRevenue = dayOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    
    data.push({
      date: dateStr,
      revenue,
      orders: dayOrders.length,
      fuel: fuelRevenue,
      insurance: revenue - fuelRevenue,
    });
  }
  
  return data;
}

function generateOrderTrends(orders: any[], range: DateRange): OrderTrendData[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const data: OrderTrendData[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOrders = orders.filter((o: any) => 
      o.createdAt?.startsWith(dateStr)
    );
    
    data.push({
      date: dateStr,
      pending: dayOrders.filter((o: any) => o.status === 'pending').length,
      confirmed: dayOrders.filter((o: any) => o.status === 'confirmed').length,
      delivered: dayOrders.filter((o: any) => o.status === 'delivered').length,
      cancelled: dayOrders.filter((o: any) => o.status === 'cancelled').length,
    });
  }
  
  return data;
}

function generateUserGrowth(users: any[], range: DateRange): UserGrowthData[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const data: UserGrowthData[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayUsers = users.filter((u: any) => 
      u.createdAt?.startsWith(dateStr)
    );
    
    data.push({
      date: dateStr,
      drivers: dayUsers.filter((u: any) => u.role === 'driver').length,
      fleets: dayUsers.filter((u: any) => u.role === 'fleet_manager').length,
      stations: dayUsers.filter((u: any) => u.role === 'station').length,
      petroliers: dayUsers.filter((u: any) => u.role === 'petrolier').length,
      agents: dayUsers.filter((u: any) => u.role === 'agent').length,
    });
  }
  
  return data;
}

function generateProductPerformance(orders: any[], products: any[]): ProductPerformanceData[] {
  const productMap = new Map<string, { quantity: number; revenue: number; orders: number }>();
  
  orders.forEach((order: any) => {
    order.items?.forEach((item: any) => {
      const existing = productMap.get(item.productId) || { quantity: 0, revenue: 0, orders: 0 };
      productMap.set(item.productId, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.price * item.quantity),
        orders: existing.orders + 1,
      });
    });
  });
  
  return Array.from(productMap.entries())
    .map(([productId, data]) => {
      const product = products.find((p: any) => p._id === productId);
      return {
        productName: product?.name || 'Produit inconnu',
        ...data,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function generateStationPerformance(orders: any[], stations: any[]): StationPerformanceData[] {
  const stationMap = new Map<string, { orders: number; revenue: number }>();
  
  orders.forEach((order: any) => {
    if (order.assignedStationId) {
      const existing = stationMap.get(order.assignedStationId) || { orders: 0, revenue: 0 };
      stationMap.set(order.assignedStationId, {
        orders: existing.orders + 1,
        revenue: existing.revenue + (order.totalAmount || 0),
      });
    }
  });
  
  return Array.from(stationMap.entries())
    .map(([stationId, data]) => {
      const station = stations.find((s: any) => s._id === stationId);
      return {
        stationName: station?.name || 'Station inconnue',
        ...data,
        rating: station?.rating || 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function generateInsuranceData(policies: any[], claims: any[], range: DateRange): InsuranceData[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const data: InsuranceData[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayPolicies = policies.filter((p: any) => 
      p.enrollmentDate?.startsWith(dateStr)
    );
    
    const dayClaims = claims.filter((c: any) => 
      c.submittedAt?.startsWith(dateStr)
    );
    
    const premiums = dayPolicies.reduce((sum: number, p: any) => sum + (p.premium || 0), 0);
    const claimsAmount = dayClaims.reduce((sum: number, c: any) => sum + (c.claimAmount || 0), 0);
    
    data.push({
      date: dateStr,
      policies: dayPolicies.length,
      claims: dayClaims.length,
      claimsAmount,
      premiumsCollected: premiums,
    });
  }
  
  return data;
}

function generateLoyaltyData(points: any[], tiers: any[]): LoyaltyData[] {
  const tierMap = new Map<string, { members: number; pointsEarned: number; pointsRedeemed: number }>();
  
  points.forEach((point: any) => {
    const tier = point.currentTier || 'Bronze';
    const existing = tierMap.get(tier) || { members: 0, pointsEarned: 0, pointsRedeemed: 0 };
    tierMap.set(tier, {
      members: existing.members + 1,
      pointsEarned: existing.pointsEarned + (point.totalEarned || 0),
      pointsRedeemed: existing.pointsRedeemed + (point.totalRedeemed || 0),
    });
  });
  
  return tiers.map((tier: any) => ({
    tier: tier.name,
    ...(tierMap.get(tier.name) || { members: 0, pointsEarned: 0, pointsRedeemed: 0 }),
  }));
}

/**
 * Export analytics data to CSV
 */
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(val => 
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',')
  );
  
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
