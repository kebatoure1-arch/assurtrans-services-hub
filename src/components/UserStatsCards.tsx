import React from 'react';
import { 
  Activity, 
  DollarSign, 
  Award, 
  TrendingUp, 
  Clock, 
  Shield,
  AlertCircle,
  Wallet,
  TrendingDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  subtitle?: string;
  trend?: number;
  badge?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBgColor = 'bg-emerald-100',
  iconColor = 'text-emerald-600',
  subtitle,
  trend,
  badge,
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {badge && (
              <Badge variant="secondary" className="mt-2 text-xs">
                {badge}
              </Badge>
            )}
          </div>
          <div className={`h-12 w-12 rounded-full ${iconBgColor} flex items-center justify-center flex-shrink-0 ml-4`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 pt-3 border-t flex items-center gap-1 text-xs">
            {trend >= 0 ? (
              <>
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-green-600 font-medium">+{trend}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span className="text-red-600 font-medium">{trend}%</span>
              </>
            )}
            <span className="text-muted-foreground ml-1">vs mois dernier</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface UserStatsCardsProps {
  userRole: string;
  stats: {
    totalOrders?: number;
    totalSpent?: number;
    loyaltyPoints?: number;
    loyaltyTier?: string;
    vehiclesCount?: number;
    lastActivity?: string;
    walletBalance?: number;
    activePolicies?: number;
    pendingClaims?: number;
    maintenanceAlerts?: number;
  };
  loading?: boolean;
}

const UserStatsCards: React.FC<UserStatsCardsProps> = ({
  userRole,
  stats,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards: React.ReactNode[] = [];

  // Fleet & Driver: Orders
  if ((userRole === 'fleet' || userRole === 'driver') && stats.totalOrders !== undefined) {
    cards.push(
      <StatCard
        key="orders"
        label="Commandes"
        value={stats.totalOrders}
        icon={<Activity className="h-6 w-6" />}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        subtitle={`${stats.totalOrders} commandes passées`}
      />
    );
  }

  // Fleet & Driver: Total Spent
  if ((userRole === 'fleet' || userRole === 'driver') && stats.totalSpent !== undefined) {
    cards.push(
      <StatCard
        key="spent"
        label="Dépenses"
        value={`${stats.totalSpent.toLocaleString('fr-FR')} FCFA`}
        icon={<DollarSign className="h-6 w-6" />}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        subtitle="Montant total dépensé"
      />
    );
  }

  // Driver: Loyalty Points
  if (userRole === 'driver' && stats.loyaltyPoints !== undefined) {
    cards.push(
      <StatCard
        key="loyalty"
        label="Points Fidélité"
        value={stats.loyaltyPoints}
        icon={<Award className="h-6 w-6" />}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        subtitle={stats.loyaltyTier}
        badge={stats.loyaltyTier}
      />
    );
  }

  // Fleet: Vehicles Count
  if (userRole === 'fleet' && stats.vehiclesCount !== undefined) {
    cards.push(
      <StatCard
        key="vehicles"
        label="Véhicules"
        value={stats.vehiclesCount}
        icon={<TrendingUp className="h-6 w-6" />}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        subtitle={`${stats.vehiclesCount} véhicules dans votre flotte`}
      />
    );
  }

  // Fleet: Maintenance Alerts
  if (userRole === 'fleet' && stats.maintenanceAlerts !== undefined && stats.maintenanceAlerts > 0) {
    cards.push(
      <StatCard
        key="maintenance"
        label="Alertes Maintenance"
        value={stats.maintenanceAlerts}
        icon={<AlertCircle className="h-6 w-6" />}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        subtitle="Entretiens à venir (30 jours)"
        badge="Attention requise"
      />
    );
  }

  // Wallet Balance (all roles except admin)
  if (userRole !== 'admin' && stats.walletBalance !== undefined) {
    cards.push(
      <StatCard
        key="wallet"
        label="Solde Portefeuille"
        value={`${stats.walletBalance.toLocaleString('fr-FR')} FCFA`}
        icon={<Wallet className="h-6 w-6" />}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        subtitle="Solde disponible"
      />
    );
  }

  // Driver & Fleet: Active Policies
  if ((userRole === 'driver' || userRole === 'fleet') && stats.activePolicies !== undefined) {
    cards.push(
      <StatCard
        key="policies"
        label="Polices Actives"
        value={stats.activePolicies}
        icon={<Shield className="h-6 w-6" />}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        subtitle="Assurances en cours"
      />
    );
  }

  // Driver & Fleet: Pending Claims
  if ((userRole === 'driver' || userRole === 'fleet') && stats.pendingClaims !== undefined && stats.pendingClaims > 0) {
    cards.push(
      <StatCard
        key="claims"
        label="Réclamations"
        value={stats.pendingClaims}
        icon={<AlertCircle className="h-6 w-6" />}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        subtitle="En attente de traitement"
        badge="Urgent"
      />
    );
  }

  // Last Activity (all roles)
  if (stats.lastActivity) {
    cards.push(
      <Card key="activity" className="md:col-span-2">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Dernière activité</p>
              <p className="text-lg font-semibold">
                {new Date(stats.lastActivity).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no stats available
  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Aucune statistique disponible pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards}
    </div>
  );
};

export default UserStatsCards;
