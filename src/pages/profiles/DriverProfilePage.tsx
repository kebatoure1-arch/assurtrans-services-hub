// Driver Profile Page - Chauffeur avec véhicule et fidélité

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Shield, ArrowLeft, Fuel, Award, Wallet, Truck, TrendingUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/store/auth-store';
import UserActivityTimeline from '@/components/UserActivityTimeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchDriverStats, type DriverStats } from '@/lib/driver-stats';

export default function DriverProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Handle both user.id and user.uid for compatibility
  const driverId = (user as any)?.id ?? (user as any)?.uid;

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }

    // Load driver stats
    const loadStats = async () => {
      try {
        if (!driverId) {
          console.warn('⚠️ No user id/uid available for driver stats');
          setLoading(false);
          return;
        }
        
        const data = await fetchDriverStats(driverId);
        setStats(data);
      } catch (error) {
        console.error('❌ Error loading driver stats in profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [isAuthenticated, user, navigate, driverId]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Profil Chauffeur</h1>
            <p className="text-muted-foreground">Véhicule et programme de fidélité</p>
          </div>
          <Badge variant="secondary">
            <Shield className="h-3 w-3 mr-1" />
            Chauffeur
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{user.name || user.email}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {user.email}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
            <TabsTrigger value="activity">Activité</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stats" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Chargement des statistiques...</span>
                  </div>
                </CardContent>
              </Card>
            ) : !stats ? (
              <Alert className="border-blue-200 bg-blue-50/50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Bienvenue sur Assur'Trans !</strong>
                  <br />
                  Aucune statistique disponible pour le moment. Vos données apparaîtront ici après vos premières transactions :
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Commandes de carburant</li>
                    <li>Points de fidélité</li>
                    <li>Solde du portefeuille</li>
                    <li>Informations sur votre véhicule</li>
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Orders Stats */}
                {stats.totalOrders !== undefined && (
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Commandes</p>
                          <p className="text-3xl font-bold">{stats.totalOrders}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {stats.pendingOrders || 0} en cours
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {stats.completedOrders || 0} terminées
                            </Badge>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          <Fuel className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Total Spent */}
                {stats.totalSpent !== undefined && (
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Dépenses totales</p>
                          <p className="text-3xl font-bold">{stats.totalSpent.toLocaleString('fr-FR')}</p>
                          <p className="text-xs text-muted-foreground mt-1">FCFA</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Fuel Volume */}
                {stats.totalFuelVolume !== undefined && (
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Volume carburant</p>
                          <p className="text-3xl font-bold">{stats.totalFuelVolume.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Litres</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                          <Fuel className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Loyalty Points */}
                {stats.loyaltyPoints !== undefined && (
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Points Fidélité</p>
                          <p className="text-3xl font-bold">{stats.loyaltyPoints}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {stats.loyaltyTier || 'bronze'}
                            </Badge>
                            {stats.tierProgress !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                {stats.tierProgress}% prochain niveau
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                          <Award className="w-6 h-6 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Wallet Balance */}
                {stats.walletBalance !== undefined && (
                  <Card className="border-l-4 border-l-cyan-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Solde Portefeuille</p>
                          <p className="text-3xl font-bold">{stats.walletBalance.toLocaleString('fr-FR')}</p>
                          <p className="text-xs text-muted-foreground mt-1">FCFA</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-cyan-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Vehicle Info */}
                {stats.vehicleRegistration && (
                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Véhicule</p>
                          <p className="text-xl font-bold">{stats.vehicleRegistration}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {stats.vehicleBrand} {stats.vehicleModel}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                          <Truck className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="activity">
            <UserActivityTimeline userId={driverId || user.uid} userRole="driver" limit={15} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
