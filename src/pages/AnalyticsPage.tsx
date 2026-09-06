/**
 * Analytics Dashboard Page - Comprehensive analytics and reporting
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { 
  TrendingUp, 
  Download, 
  Calendar,
  DollarSign,
  ShoppingCart,
  Users,
  Car,
  Shield,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import RevenueChart from '@/features/analytics/components/RevenueChart';
import OrderTrendsChart from '@/features/analytics/components/OrderTrendsChart';
import UserGrowthChart from '@/features/analytics/components/UserGrowthChart';
import ProductPerformanceChart from '@/features/analytics/components/ProductPerformanceChart';
import InsuranceAnalyticsChart from '@/features/analytics/components/InsuranceAnalyticsChart';
import LoyaltyDistributionChart from '@/features/analytics/components/LoyaltyDistributionChart';
import { getAnalyticsSummary, exportToCSV } from '@/features/analytics/services/analytics-service';
import type { AnalyticsSummary, DateRange } from '@/features/analytics/types';

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // Redirect non-admin users (redundant with RequireRole, but kept for safety)
  useEffect(() => {
    if (user?.activeRole !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await getAnalyticsSummary(dateRange);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (dataKey: keyof AnalyticsSummary, filename: string) => {
    if (!analytics) return;
    const data = analytics[dataKey];
    if (Array.isArray(data)) {
      exportToCSV(data, filename);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value);
  };

  const getRangeName = (range: DateRange) => {
    const names = {
      '7d': '7 derniers jours',
      '30d': '30 derniers jours',
      '90d': '90 derniers jours',
      '1y': '1 an',
      'all': 'Tout',
    };
    return names[range];
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                Analyses & Rapports
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tableau de bord analytique complet
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 derniers jours</SelectItem>
                  <SelectItem value="30d">30 derniers jours</SelectItem>
                  <SelectItem value="90d">90 derniers jours</SelectItem>
                  <SelectItem value="1y">1 an</SelectItem>
                  <SelectItem value="all">Tout</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => navigate('/dashboard')}>
                Retour au tableau de bord
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des analyses...</p>
            </div>
          </div>
        ) : analytics ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="revenue">Revenus</TabsTrigger>
              <TabsTrigger value="operations">Opérations</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Revenus totaux</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(analytics.stats.totalRevenue)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getRangeName(dateRange)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatNumber(analytics.stats.totalOrders)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valeur moy: {formatCurrency(analytics.stats.averageOrderValue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatNumber(analytics.stats.totalUsers)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analytics.stats.activeDrivers} chauffeurs actifs
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Véhicules</CardTitle>
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatNumber(analytics.stats.totalVehicles)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analytics.stats.activeFleets} flottes actives
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Polices d'assurance</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatNumber(analytics.stats.totalInsurancePolicies)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analytics.stats.totalClaims} sinistres
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Taux de conversion</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {analytics.stats.conversionRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Commandes / Utilisateurs
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Main Charts */}
              <div className="grid gap-6">
                <RevenueChart data={analytics.revenueData} />
                <div className="grid gap-6 md:grid-cols-2">
                  <OrderTrendsChart data={analytics.orderTrends} />
                  <UserGrowthChart data={analytics.userGrowth} />
                </div>
              </div>
            </TabsContent>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleExport('revenueData', 'revenus')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </Button>
              </div>
              <RevenueChart data={analytics.revenueData} chartType="line" />
              <div className="grid gap-6 md:grid-cols-2">
                <ProductPerformanceChart data={analytics.productPerformance} />
                <Card>
                  <CardHeader>
                    <CardTitle>Performance des stations</CardTitle>
                    <CardDescription>Top 10 stations par revenus</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.stationPerformance.map((station, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{station.stationName}</p>
                            <p className="text-sm text-muted-foreground">
                              {station.orders} commandes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">
                              {formatCurrency(station.revenue)}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-yellow-600">
                              <Award className="h-3 w-3" />
                              {station.rating.toFixed(1)}/5
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Operations Tab */}
            <TabsContent value="operations" className="space-y-6">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExport('orderTrends', 'tendances_commandes')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter Commandes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExport('userGrowth', 'croissance_utilisateurs')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter Utilisateurs
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <OrderTrendsChart data={analytics.orderTrends} />
                <UserGrowthChart data={analytics.userGrowth} />
              </div>
              <ProductPerformanceChart data={analytics.productPerformance} />
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExport('insuranceData', 'assurance')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter Assurance
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExport('loyaltyData', 'fidelite')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter Fidélité
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <InsuranceAnalyticsChart data={analytics.insuranceData} />
                <LoyaltyDistributionChart data={analytics.loyaltyData} />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune donnée disponible</p>
          </div>
        )}
      </main>
    </div>
  );
}
