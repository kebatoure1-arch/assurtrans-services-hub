import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Fuel,
  Package,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Truck,
  BarChart3,
  ChevronRight,
  Shield,
  DollarSign,
  QrCode,
  BookOpen,
  CreditCard
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { OrderList } from '@/features/fuel/components/OrderList';
import { getStationStats, type StationStats } from '@/services/statistics-service';

export default function StationDashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<StationStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load real-time statistics
  useEffect(() => {
    const loadStats = async () => {
      if (user?.uid) {
        setLoading(true);
        const data = await getStationStats(user.uid);
        setStats(data);
        setLoading(false);
      }
    };
    loadStats();
  }, [user]);

  // Station-specific statistics
  const stationStats = [
    {
      title: 'Commandes en attente',
      value: '0',
      change: 'À livrer',
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Livrées aujourd\'hui',
      value: '0',
      change: '+0%',
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      title: 'Revenus du jour',
      value: '0 FCFA',
      change: '+0%',
      icon: DollarSign,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Stock disponible',
      value: '100%',
      change: 'Optimal',
      icon: Fuel,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ];

  const quickActions = [
    {
      title: 'Terminal de Paiement (TPE)',
      description: 'Traiter les paiements par carte',
      icon: CreditCard,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => navigate('/tpe-terminal')
    },
    {
      title: 'Commandes en attente',
      description: 'Voir les livraisons à effectuer',
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      count: stats?.pendingOrders || 0,
      onClick: () => setActiveTab('pending')
    },
    {
      title: 'Stock de carburant',
      description: 'Gérer mon inventaire',
      icon: Package,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      onClick: () => setActiveTab('inventory')
    },
    {
      title: 'Historique',
      description: 'Toutes les livraisons',
      icon: BarChart3,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => setActiveTab('history')
    },
  ];

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
                <h1 className="text-xl font-bold">Espace Station</h1>
                <p className="text-xs text-muted-foreground">Gestion des livraisons</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <Shield className="w-3 h-3 mr-1" />
              Station-service
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 fade-in">
          <h2 className="text-3xl font-bold mb-2">
            Bonjour, {user?.name?.split(' ')[0] || 'Station'} 👋
          </h2>
          <p className="text-muted-foreground text-lg">
            Gérez vos livraisons et votre stock de carburant
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {stationStats.map((stat, index) => (
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

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {quickActions.map((action, index) => (
            <Card key={index} className="card-interactive cursor-pointer group" onClick={action.onClick}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform relative`}>
                    <action.icon className={`w-6 h-6 ${action.iconColor}`} />
                    {action.count !== undefined && action.count > 0 && (
                      <Badge className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 flex items-center justify-center bg-red-500">
                        {action.count}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                      {action.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Livraisons du jour</CardTitle>
                  <CardDescription>Commandes à traiter aujourd'hui</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune livraison programmée</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Niveaux de stock</CardTitle>
                  <CardDescription>État des réservoirs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Essence</span>
                        <span className="text-muted-foreground">100%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Diesel</span>
                        <span className="text-muted-foreground">100%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Commandes en attente de livraison</CardTitle>
                <CardDescription>Commandes assignées à votre station</CardDescription>
              </CardHeader>
              <CardContent>
                <OrderList statusFilter="dispatched" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique des livraisons</CardTitle>
                <CardDescription>Toutes vos livraisons effectuées</CardDescription>
              </CardHeader>
              <CardContent>
                <OrderList statusFilter="completed" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
