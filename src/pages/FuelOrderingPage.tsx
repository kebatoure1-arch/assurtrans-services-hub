// Fuel Ordering Page - Main interface for fuel ordering and management

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Fuel, History, TrendingUp } from 'lucide-react';
import { WalletCard } from '@/features/fuel/components/WalletCard';
import { CreateOrderDialog } from '@/features/fuel/components/CreateOrderDialog';
import { DepositDialog } from '@/features/fuel/components/DepositDialog';
import { OrderList } from '@/features/fuel/components/OrderList';

export default function FuelOrderingPage() {
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOrderSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDepositSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Commandes de Carburant
        </h1>
        <p className="text-muted-foreground">
          Gérez vos commandes de carburant et rechargez votre portefeuille
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Wallet */}
        <div className="lg:col-span-1 space-y-6">
          <WalletCard
            key={refreshKey}
            onDeposit={() => setDepositOpen(true)}
            onViewTransactions={() => {
              // TODO: Implement transactions view
            }}
          />

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Statistiques Rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Commandes ce mois</span>
                <span className="font-bold">-</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total dépensé</span>
                <span className="font-bold">- XOF</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Économies réalisées</span>
                <span className="font-bold text-green-600">- XOF</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Action */}
          <Button
            className="w-full h-auto py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={() => setCreateOrderOpen(true)}
          >
            <div className="flex flex-col items-center gap-2">
              <Plus className="h-6 w-6" />
              <span className="font-semibold">Nouvelle Commande</span>
            </div>
          </Button>
        </div>

        {/* Right Column - Orders */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="orders" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="orders" className="gap-2">
                <Fuel className="h-4 w-4" />
                Mes Commandes
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                Historique
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-4">
              <OrderList key={refreshKey} />
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <History className="h-16 w-16 text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Historique Complet</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    L'historique détaillé des commandes sera disponible dans une prochaine mise à jour.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <CreateOrderDialog
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        onSuccess={handleOrderSuccess}
      />

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onSuccess={handleDepositSuccess}
      />
    </div>
  );
}
