import React, { useEffect, useState } from 'react';
import { Clock, Package, Shield, Award, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { table } from '@devvai/devv-code-backend';

interface ActivityItem {
  id: string;
  type: 'order' | 'claim' | 'reward' | 'payment' | 'vehicle';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  iconBgColor: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

interface UserActivityTimelineProps {
  userId: string;
  userRole: string;
  limit?: number;
}

const UserActivityTimeline: React.FC<UserActivityTimelineProps> = ({
  userId,
  userRole,
  limit = 10,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [userId, userRole]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const allActivities: ActivityItem[] = [];

      // Load orders
      if (userRole === 'fleet' || userRole === 'driver') {
        try {
          const ordersResult = await table.getItems('f4f186q7i03l'); // orders table
          const orders = ((ordersResult as any).items || [])
            .filter((order: any) => order._uid === userId)
            .slice(0, 5);
          
          orders.forEach((order: any) => {
            allActivities.push({
              id: order._id,
              type: 'order',
              title: 'Commande de carburant',
              description: `${order.quantity}L de ${order.product_name} - ${order.total_amount} FCFA`,
              timestamp: order.created_at,
              icon: <Package className="h-4 w-4" />,
              iconBgColor: 'bg-emerald-100 text-emerald-600',
              badge: order.status,
              badgeVariant: order.status === 'completed' ? 'default' : 'secondary',
            });
          });
        } catch (err) {
          console.warn('Failed to load orders:', err);
        }
      }

      // Load claims
      if (userRole === 'driver' || userRole === 'fleet') {
        try {
          const claimsResult = await table.getItems('f4f4hkylexvk'); // insurance_claims table
          const claims = ((claimsResult as any).items || [])
            .filter((claim: any) => claim._uid === userId)
            .slice(0, 3);
          
          claims.forEach((claim: any) => {
            allActivities.push({
              id: claim._id,
              type: 'claim',
              title: 'Réclamation d\'assurance',
              description: `${claim.claim_type} - ${claim.claim_amount} FCFA`,
              timestamp: claim.claim_date,
              icon: <Shield className="h-4 w-4" />,
              iconBgColor: 'bg-blue-100 text-blue-600',
              badge: claim.status,
              badgeVariant: claim.status === 'approved' ? 'default' : 'secondary',
            });
          });
        } catch (err: any) {
          if (
            typeof err?.message === 'string' &&
            err.message.includes('project table') &&
            err.message.includes('not found')
          ) {
            console.log('ℹ️ Insurance claims table not yet initialized');
          } else {
            console.warn('⚠️ Failed to load claims (non-critical):', err?.message);
          }
        }
      }

      // Load loyalty redemptions
      if (userRole === 'driver') {
        try {
          const redemptionsResult = await table.getItems('f4fb4hcj1p1s'); // loyalty_redemptions table
          const redemptions = ((redemptionsResult as any).items || [])
            .filter((r: any) => r._uid === userId)
            .slice(0, 3);
          
          redemptions.forEach((redemption: any) => {
            allActivities.push({
              id: redemption._id,
              type: 'reward',
              title: 'Échange de points',
              description: `${redemption.reward_name} - ${redemption.points_used} points`,
              timestamp: redemption.redeemed_at,
              icon: <Award className="h-4 w-4" />,
              iconBgColor: 'bg-amber-100 text-amber-600',
              badge: 'Échangé',
              badgeVariant: 'default',
            });
          });
        } catch (err) {
          console.warn('Failed to load redemptions:', err);
        }
      }

      // Load transactions
      try {
        const transactionsResult = await table.getItems('f4f186qchmgw'); // transactions table
        const transactions = ((transactionsResult as any).items || [])
          .filter((t: any) => t._uid === userId)
          .slice(0, 5);
        
        transactions.forEach((transaction: any) => {
          allActivities.push({
            id: transaction._id,
            type: 'payment',
            title: transaction.transaction_type === 'deposit' ? 'Recharge de portefeuille' : 'Paiement',
            description: `${transaction.amount} FCFA - ${transaction.payment_method}`,
            timestamp: transaction.created_at,
            icon: <DollarSign className="h-4 w-4" />,
            iconBgColor: 'bg-green-100 text-green-600',
            badge: transaction.status,
            badgeVariant: transaction.status === 'completed' ? 'default' : 'secondary',
          });
        });
      } catch (err) {
        console.warn('Failed to load transactions:', err);
      }

      // Load vehicles (fleet only)
      if (userRole === 'fleet') {
        try {
          const vehiclesResult = await table.getItems('f4f06zbgkav4'); // vehicles table
          const vehicles = ((vehiclesResult as any).items || [])
            .filter((v: any) => v._uid === userId)
            .slice(0, 3);
          
          vehicles.forEach((vehicle: any) => {
            allActivities.push({
              id: vehicle._id,
              type: 'vehicle',
              title: 'Véhicule ajouté',
              description: `${vehicle.make} ${vehicle.model} - ${vehicle.registration_number}`,
              timestamp: vehicle.created_at,
              icon: <TrendingUp className="h-4 w-4" />,
              iconBgColor: 'bg-purple-100 text-purple-600',
              badge: vehicle.status,
              badgeVariant: vehicle.status === 'active' ? 'default' : 'secondary',
            });
          });
        } catch (err) {
          console.warn('Failed to load vehicles:', err);
        }
      }

      // Sort by timestamp and limit
      const sortedActivities = allActivities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      setActivities(sortedActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Aucune activité récente à afficher.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activité récente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="relative">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`h-10 w-10 rounded-full ${activity.iconBgColor} flex items-center justify-center flex-shrink-0`}>
                  {activity.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {activity.badge && (
                      <Badge variant={activity.badgeVariant} className="text-xs flex-shrink-0">
                        {activity.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline connector */}
              {index < activities.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserActivityTimeline;
