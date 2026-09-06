import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  LogOut,
  User,
  BarChart3,
  Users,
  Building2,
  Fuel,
  Truck,
  AlertCircle,
  TrendingUp,
  Activity,
  Sparkles,
  ChevronRight,
  Settings,
  Bell,
  Heart,
  Award,
  CreditCard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { getAdminStats, type AdminStats } from '@/services/statistics-service';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [visibleStats, setVisibleStats] = useState<number[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load real-time statistics
  useEffect(() => {
    const loadStats = async () => {
      if (user?.activeRole === 'admin') {
        setLoading(true);
        const data = await getAdminStats();
        setStats(data);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    loadStats();
  }, [user]);

  // Progressive stat card reveal
  useEffect(() => {
    const timers = [0, 1, 2, 3].map((index) => 
      setTimeout(() => {
        setVisibleStats(prev => [...prev, index]);
      }, index * 100)
    );
    return () => timers.forEach(timer => clearTimeout(timer));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: '👋 Déconnexion réussie',
        description: 'À bientôt sur Assur\'Trans',
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de se déconnecter',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleDisplay = (role?: string) => {
    const roles = {
      admin: 'Administrateur',
      agent: 'Agent Assur\'Trans',
      petrolier: 'Pétrolier',
      station: 'Station-service',
      fleet: 'Chef de Flotte',
      driver: 'Chauffeur',
    };
    return role ? roles[role as keyof typeof roles] : 'Utilisateur';
  };

  const getRoleBadgeColor = (role?: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-700 border-red-200',
      agent: 'bg-blue-100 text-blue-700 border-blue-200',
      petrolier: 'bg-purple-100 text-purple-700 border-purple-200',
      station: 'bg-green-100 text-green-700 border-green-200',
      fleet: 'bg-orange-100 text-orange-700 border-orange-200',
      driver: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    };
    return role ? colors[role as keyof typeof colors] : 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const quickStats = [
    {
      title: 'Utilisateurs actifs',
      value: loading ? '...' : (stats?.totalUsers.toString() || '0'),
      change: loading ? '...' : `+${stats?.userGrowth || 0}%`,
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: 'up'
    },
    {
      title: 'Transactions',
      value: loading ? '...' : (stats?.totalTransactions.toString() || '0'),
      change: loading ? '...' : `+${stats?.transactionGrowth || 0}%`,
      icon: BarChart3,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: 'up'
    },
    {
      title: 'Stations',
      value: loading ? '...' : (stats?.totalStations.toString() || '0'),
      change: loading ? '...' : '+0%',
      icon: Building2,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      trend: 'neutral'
    },
    {
      title: 'Véhicules',
      value: loading ? '...' : (stats?.totalVehicles.toString() || '0'),
      change: loading ? '...' : '+0%',
      icon: Truck,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: 'up'
    },
  ];

  // Base quick actions for all users
  const baseQuickActions = [
    {
      title: 'Commander carburant',
      description: 'Passez une nouvelle commande',
      icon: Fuel,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      badge: 'Actif',
      onClick: () => navigate('/fuel')
    },
    {
      title: 'Assurance santé',
      description: 'Gérez votre couverture',
      icon: Heart,
      iconColor: 'text-rose-600',
      bgColor: 'bg-rose-50',
      badge: 'Actif',
      onClick: () => navigate('/insurance')
    },
    {
      title: 'Mes récompenses',
      description: 'Consultez vos points',
      icon: Award,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      badge: 'Actif',
      onClick: () => navigate('/loyalty')
    },
    {
      title: 'Historique paiements',
      description: 'Vos transactions Mobile Money',
      icon: CreditCard,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      badge: 'Actif',
      onClick: () => navigate('/payments')
    },
  ];

  // Fleet management action for fleet managers
  const fleetAction = {
    title: 'Ma Flotte',
    description: 'Gérez véhicules et chauffeurs',
    icon: Truck,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
    badge: 'Actif',
    onClick: () => navigate('/fleet')
  };

  // Fuel management action for petroliers
  const fuelManagementAction = {
    title: 'Gestion Carburant',
    description: 'Produits, commandes et stations',
    icon: Fuel,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badge: 'Actif',
    onClick: () => navigate('/fuel-management')
  };

  // Settings action for admin
  const settingsAction = {
    title: 'Paramètres système',
    description: 'Configuration de la plateforme',
    icon: Settings,
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    badge: 'Admin',
    onClick: () => navigate('/settings')
  };

  // Add driver action for admin, agent, fleet manager
  const addDriverAction = {
    title: 'Ajouter un Chauffeur',
    description: 'Créer un nouveau profil',
    icon: Users,
    iconColor: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    badge: 'Nouveau',
    onClick: () => navigate('/drivers/new')
  };

  // Analytics action for admin
  const analyticsAction = {
    title: 'Analyses & Rapports',
    description: 'Tableaux de bord analytiques',
    icon: BarChart3,
    iconColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    badge: 'Admin',
    onClick: () => navigate('/analytics')
  };

  // Agent dashboard action
  const agentDashboardAction = {
    title: 'Espace Agent',
    description: 'Gérer mes pétroliers',
    icon: Users,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badge: 'Actif',
    onClick: () => navigate('/dashboard/agent')
  };

  // Station dashboard action
  const stationDashboardAction = {
    title: 'Espace Station',
    description: 'Gérer les livraisons',
    icon: Building2,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
    badge: 'Actif',
    onClick: () => navigate('/dashboard/station')
  };

  // Driver dashboard action
  const driverDashboardAction = {
    title: 'Mon espace',
    description: 'Gérer mon activité',
    icon: Truck,
    iconColor: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    badge: 'Actif',
    onClick: () => navigate('/dashboard/driver')
  };

  // Build quick actions based on user role
  let quickActions = baseQuickActions;
  
  if (user?.activeRole === 'admin') {
    quickActions = [analyticsAction, settingsAction, addDriverAction, ...baseQuickActions.slice(0, 1)];
  } else if (user?.activeRole === 'assur_agent') {
    quickActions = [agentDashboardAction, addDriverAction, ...baseQuickActions.slice(0, 2)];
  } else if (user?.activeRole === 'station_operator') {
    quickActions = [stationDashboardAction, ...baseQuickActions.slice(0, 3)];
  } else if (user?.activeRole === 'fleet_manager') {
    quickActions = [fleetAction, addDriverAction, ...baseQuickActions.slice(0, 2)];
  } else if (user?.activeRole === 'driver') {
    quickActions = [driverDashboardAction, ...baseQuickActions.slice(0, 3)];
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md group-hover:blur-lg transition-all" />
                <img 
                  src="https://static.devv.ai/f4eyuacgbocg.jpg" 
                  alt="Assur'Trans Logo" 
                  className="w-11 h-11 object-contain relative z-10"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  Assur'Trans
                </h1>
                <p className="text-xs text-muted-foreground">Tableau de bord</p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative hover:bg-primary/10 transition-colors">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-11 w-11 rounded-full hover:ring-2 hover:ring-primary/20 transition-all">
                    <Avatar>
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-white font-semibold">
                        {user?.name ? getInitials(user.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 scale-in">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-2">
                      <p className="text-sm font-semibold">{user?.name || 'Utilisateur'}</p>
                      <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                      <Badge className={`w-fit text-xs ${getRoleBadgeColor(user?.activeRole)}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {getRoleDisplay(user?.activeRole)}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    Mon profil
                  </DropdownMenuItem>
                  {user?.activeRole === 'admin' && (
                    <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Paramètres
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 fade-in">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-3xl md:text-4xl font-bold">
              Bienvenue, {user?.name?.split(' ')[0] || 'Utilisateur'} 👋
            </h2>
            <Badge variant="outline" className="hidden sm:inline-flex">
              <Activity className="w-3 h-3 mr-1 text-green-600" />
              <span className="text-green-600">En ligne</span>
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">
            Voici un aperçu de votre plateforme Assur'Trans
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {quickStats.map((stat, index) => (
            <Card 
              key={index} 
              className={`border-l-4 border-l-primary stat-card group overflow-hidden ${visibleStats.includes(index) ? 'fade-in' : 'opacity-0'}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <CardContent className="p-6 relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <Badge variant="secondary" className="text-xs">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {stat.change}
                      </Badge>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${stat.color} w-0 group-hover:w-full transition-all duration-1000`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Actions rapides
            </h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Card 
                key={index} 
                className="card-interactive cursor-pointer group"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={action.onClick}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <action.icon className={`w-6 h-6 ${action.iconColor}`} />
                    </div>
                    <Badge 
                      variant={action.badge === 'Actif' ? 'default' : 'secondary'} 
                      className={action.badge === 'Actif' ? 'bg-green-500 text-xs' : 'text-xs'}
                    >
                      {action.badge}
                    </Badge>
                  </div>
                  <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                    {action.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                  <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                    {action.badge === 'Actif' ? 'Accéder' : 'Commencer'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Role-specific message */}
        {user?.activeRole === 'admin' && (
          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-blue-50/50 shadow-lg">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle>Panneau d'administration</CardTitle>
                  <CardDescription className="text-base">
                    Vous avez accès complet à toutes les fonctionnalités de la plateforme
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}
        
        {(user?.activeRole === 'assur_agent' || user?.activeRole === 'station_operator' || user?.activeRole === 'driver') && (
          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-blue-50/50 shadow-lg">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle>Bienvenue sur Assur'Trans</CardTitle>
                  <CardDescription className="text-base">
                    Accédez à votre espace dédié via les actions rapides ci-dessus
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}
      </main>
    </div>
  );
}
