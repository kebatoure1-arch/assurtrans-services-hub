import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Fuel,
  Heart,
  Award,
  Truck,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Shield,
  CreditCard,
  Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { WalletCard } from '@/features/fuel/components/WalletCard';
import { getDriverStats, type DriverStats } from '@/services/statistics-service';

export default function DriverDashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load real-time statistics
  useEffect(() => {
    const loadStats = async () => {
      if (user?.uid) {
        setLoading(true);
        const data = await getDriverStats(user.uid);
        setStats(data);
        setLoading(false);
      }
    };
    loadStats();
  }, [user]);

  // Driver-specific statistics (with real data from stats)
  const driverStats = [
    {
      title: 'Véhicule assigné',
      value: stats?.vehicleRegistration || 'N/A',
      change: stats?.vehicleBrand 
        ? `${stats.vehicleBrand} ${stats.vehicleModel || ''}`.trim()
        : 'Non attribué',
      icon: Truck,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Points fidélité',
      value: stats?.loyaltyPoints?.toString() || '0',
      change: `Niveau ${stats?.loyaltyTier || 'Bronze'}`,
      icon: Award,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Solde portefeuille',
      value: stats?.walletBalance 
        ? `${Math.round(stats.walletBalance).toLocaleString()} FCFA` 
        : '0 FCFA',
      change: 'Disponible',
      icon: CreditCard,
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Commandes totales',
      value: stats?.totalOrders?.toString() || '0',
      change: stats?.completedOrders 
        ? `${stats.completedOrders} terminées`
        : 'Aucune',
      icon: Fuel,
      color: 'from-green-500 to-teal-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
  ];

  const quickActions = [
    {
      title: 'Commander carburant',
      description: 'Nouvelle commande',
      icon: Fuel,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => navigate('/fuel')
    },
    {
      title: 'Mon assurance',
      description: 'Gérer ma couverture santé',
      icon: Heart,
      iconColor: 'text-rose-600',
      bgColor: 'bg-rose-50',
      onClick: () => navigate('/insurance')
    },
    {
      title: 'Mes récompenses',
      description: 'Voir mes points',
      icon: Award,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      onClick: () => navigate('/loyalty')
    },
    {
      title: 'Mon véhicule',
      description: 'Infos et entretien',
      icon: Truck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => setActiveTab('vehicle')
    },
  ];

  // Vehicle info from stats
  const vehicleInfo = {
    plateNumber: stats?.vehicleAssigned || 'N/A',
    brand: stats?.vehicleBrand || 'Non attribué',
    model: '',
    year: '',
    fuelType: '',
    lastService: null,
    nextService: null,
    insuranceExpiry: null
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Espace Chauffeur</h1>
                <p className="text-xs text-muted-foreground">Mon tableau de bord</p>
              </div>
            </div>
            <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">
              <Shield className="w-3 h-3 mr-1" />
              Chauffeur
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 fade-in">
          <h2 className="text-3xl font-bold mb-2">
            Bonjour, {user?.name?.split(' ')[0] || 'Chauffeur'} 👋
          </h2>
          <p className="text-muted-foreground text-lg">
            Gérez votre activité et vos avantages
          </p>
        </div>

        {/* Wallet Card */}
        <div className="mb-8">
          <WalletCard />
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats === null ? (
          <Card className="mb-8 border-amber-200 bg-amber-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">
                    Aucune statistique disponible pour le moment
                  </h3>
                  <p className="text-sm text-amber-700">
                    Les indicateurs apparaîtront après vos premières transactions. 
                    Commencez par commander du carburant ou consulter votre portefeuille.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {driverStats.map((stat, index) => (
              <Card key={index} className="border-l-4 border-l-primary stat-card group overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action, index) => (
            <Card key={index} className="card-interactive cursor-pointer group" onClick={action.onClick}>
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <action.icon className={`w-6 h-6 ${action.iconColor}`} />
                </div>
                <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                  {action.title}
                </h4>
                <p className="text-sm text-muted-foreground">{action.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                  Accéder
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="vehicle">Mon véhicule</TabsTrigger>
            <TabsTrigger value="activity">Activité</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Prochains rappels</CardTitle>
                  <CardDescription>Entretiens et échéances</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun rappel programmé</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mes avantages</CardTitle>
                  <CardDescription>Programme de fidélité</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50">
                      <div className="flex items-center gap-3">
                        <Award className="w-8 h-8 text-amber-600" />
                        <div>
                          <p className="font-semibold">Niveau Bronze</p>
                          <p className="text-sm text-muted-foreground">0 points</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate('/loyalty')}>
                        Voir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vehicle">
            <Card>
              <CardHeader>
                <CardTitle>Mon véhicule</CardTitle>
                <CardDescription>Informations et suivi d'entretien</CardDescription>
              </CardHeader>
              <CardContent>
                {vehicleInfo.plateNumber === 'N/A' ? (
                  <div className="text-center py-12">
                    <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-4">Aucun véhicule attribué</p>
                    <p className="text-sm text-muted-foreground">
                      Contactez votre gestionnaire de flotte pour obtenir un véhicule
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Vehicle details will be shown here when a vehicle is assigned */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Immatriculation</p>
                        <p className="font-semibold text-lg">{vehicleInfo.plateNumber}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Véhicule</p>
                        <p className="font-semibold">{vehicleInfo.brand} {vehicleInfo.model}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Historique d'activité</CardTitle>
                <CardDescription>Vos commandes et transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune activité récente</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
