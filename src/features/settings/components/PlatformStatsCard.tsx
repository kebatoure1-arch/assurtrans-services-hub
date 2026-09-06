/**
 * Platform Stats Card Component - Display platform statistics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ShoppingCart, Wallet, Car, Shield, TrendingUp } from 'lucide-react';
import type { PlatformStats } from '../types';

interface PlatformStatsCardProps {
  stats: PlatformStats;
}

export function PlatformStatsCard({ stats }: PlatformStatsCardProps) {
  const statItems = [
    {
      label: 'Utilisateurs totaux',
      value: stats.totalUsers.toLocaleString(),
      subtext: `${stats.activeUsers.toLocaleString()} actifs`,
      icon: Users,
      color: 'text-blue-500'
    },
    {
      label: 'Commandes',
      value: stats.totalOrders.toLocaleString(),
      subtext: 'Total des commandes',
      icon: ShoppingCart,
      color: 'text-green-500'
    },
    {
      label: 'Revenus',
      value: `${(stats.totalRevenue / 1000).toFixed(0)}k`,
      subtext: 'XOF',
      icon: Wallet,
      color: 'text-yellow-500'
    },
    {
      label: 'Véhicules',
      value: stats.totalVehicles.toLocaleString(),
      subtext: 'Dans les flottes',
      icon: Car,
      color: 'text-purple-500'
    },
    {
      label: 'Polices actives',
      value: stats.activePolicies.toLocaleString(),
      subtext: 'Assurance santé',
      icon: Shield,
      color: 'text-red-500'
    },
    {
      label: 'Transactions',
      value: stats.totalTransactions.toLocaleString(),
      subtext: 'Paiements effectués',
      icon: TrendingUp,
      color: 'text-primary'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistiques de la plateforme</CardTitle>
        <CardDescription>
          Vue d'ensemble des performances et de l'utilisation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <Icon className={`w-5 h-5 ${item.color}`} />
                  <p className="text-2xl font-bold">{item.value}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.subtext}</p>
                </div>
              </div>
            );
          })}
        </div>

        {stats.pendingClaims > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
              ⚠️ {stats.pendingClaims} réclamation{stats.pendingClaims > 1 ? 's' : ''} en attente de traitement
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
