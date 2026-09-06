/**
 * Types for analytics and reporting
 */

export type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';

export interface AnalyticsStats {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  totalVehicles: number;
  activeDrivers: number;
  activeFleets: number;
  totalInsurancePolicies: number;
  totalClaims: number;
  averageOrderValue: number;
  conversionRate: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  fuel: number;
  insurance: number;
}

export interface OrderTrendData {
  date: string;
  pending: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
}

export interface UserGrowthData {
  date: string;
  drivers: number;
  fleets: number;
  stations: number;
  petroliers: number;
  agents: number;
}

export interface ProductPerformanceData {
  productName: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export interface StationPerformanceData {
  stationName: string;
  orders: number;
  revenue: number;
  rating: number;
}

export interface InsuranceData {
  date: string;
  policies: number;
  claims: number;
  claimsAmount: number;
  premiumsCollected: number;
}

export interface LoyaltyData {
  tier: string;
  members: number;
  pointsEarned: number;
  pointsRedeemed: number;
}

export interface AnalyticsSummary {
  stats: AnalyticsStats;
  revenueData: RevenueData[];
  orderTrends: OrderTrendData[];
  userGrowth: UserGrowthData[];
  productPerformance: ProductPerformanceData[];
  stationPerformance: StationPerformanceData[];
  insuranceData: InsuranceData[];
  loyaltyData: LoyaltyData[];
}
