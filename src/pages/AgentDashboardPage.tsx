import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  Building2,
  TrendingUp,
  DollarSign,
  Award,
  BarChart3,
  Calendar,
  ChevronRight,
  Shield
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { UserList } from '@/features/users/components/UserList';
import { CreateUserDialog } from '@/features/users/components/CreateUserDialog';
import { getAgentStats, type AgentStats } from '@/services/statistics-service';

export default function AgentDashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Agent-specific statistics
  const agentStats = [
    {
      title: 'Pétroliers gérés',
      value: '0',
      change: '+0 ce mois',
      icon: Building2,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Revenus ce mois',
      value: '0 FCFA',
      change: '+0%',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      title: 'Commissions',
      value: '0 FCFA',
      change: '+0%',
      icon: Award,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Objectif mensuel',
      value: '0%',
      change: 'En cours',
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
  ];

  const quickActions = [
    {
      title: 'Créer un pétrolier',
      description: 'Ajouter un nouveau partenaire',
      icon: UserPlus,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      onClick: () => setCreateDialogOpen(true)
    },
    {
      title: 'Ajouter un Chauffeur',
      description: 'Créer un nouveau profil',
      icon: Users,
      iconColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      onClick: () => navigate('/drivers/new')
    },
    {
      title: 'Mes commissions',
      description: 'Voir mes gains',
      icon: DollarSign,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => setActiveTab('commissions')
    },
    {
      title: 'Rapports mensuels',
      description: 'Statistiques et analyses',
      icon: BarChart3,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => setActiveTab('reports')
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
                <h1 className="text-xl font-bold">Espace Agent</h1>
                <p className="text-xs text-muted-foreground">Gestion des pétroliers</p>
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              <Shield className="w-3 h-3 mr-1" />
              Agent Assur'Trans
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 fade-in">
          <h2 className="text-3xl font-bold mb-2">
            Bonjour, {user?.name?.split(' ')[0] || 'Agent'} 👋
          </h2>
          <p className="text-muted-foreground text-lg">
            Gérez vos pétroliers et suivez vos performances
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {agentStats.map((stat, index) => (
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
                  <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-6 h-6 ${action.iconColor}`} />
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
            <TabsTrigger value="petroliers">Mes pétroliers</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activité récente</CardTitle>
                <CardDescription>Les dernières actions de vos pétroliers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune activité récente</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="petroliers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pétroliers gérés</CardTitle>
                    <CardDescription>Liste de vos partenaires pétroliers</CardDescription>
                  </div>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Nouveau pétrolier
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <UserList roleFilter="petrolier" parentFilter={user?.uid} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Rapports et statistiques</CardTitle>
                <CardDescription>Analyses de performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Les rapports détaillés seront disponibles prochainement</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultRole="petrolier"
      />
    </div>
  );
}
