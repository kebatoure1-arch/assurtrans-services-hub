// Fuel Management Page - Comprehensive management for Petroliers
// Combines product catalog, order dispatch, and station management

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Truck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductManagement } from '@/features/fuel/components/ProductManagement';
import { OrderDispatch } from '@/features/fuel/components/OrderDispatch';
import { StationManagement } from '@/features/fuel/components/StationManagement';

export default function FuelManagementPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back Button and Title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
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
                    Gestion Carburant
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Catalogue, Commandes et Stations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produits</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Commandes</span>
            </TabsTrigger>
            <TabsTrigger value="stations" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Stations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <OrderDispatch />
          </TabsContent>

          <TabsContent value="stations" className="space-y-6">
            <StationManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
