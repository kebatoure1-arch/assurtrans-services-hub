import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck,
  Users,
  AlertTriangle,
  Shield,
  Plus,
  TrendingUp,
  Activity,
  Car,
} from 'lucide-react';
import { fleetService } from '../services/fleet-service';
import type { FleetOverview as FleetOverviewType } from '../types';

interface FleetOverviewProps {
  fleetId: string;
  onAddVehicle: () => void;
  onAddDriver: () => void;
  onViewVehicles: () => void;
  onViewDrivers: () => void;
}

export function FleetOverview({
  fleetId,
  onAddVehicle,
  onAddDriver,
  onViewVehicles,
  onViewDrivers,
}: FleetOverviewProps) {
  const [overview, setOverview] = useState<FleetOverviewType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, [fleetId]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const data = await fleetService.getFleetOverview(fleetId);
      setOverview(data);
    } catch (error) {
      console.error('Failed to load fleet overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-32 bg-muted rounded-lg animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Impossible de charger les données de la flotte</p>
      </div>
    );
  }

  const { fleetInfo, stats, recentVehicles } = overview;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Fleet Header */}
      <Card className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl mb-2">{fleetInfo.fleetName}</CardTitle>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Gérant: {fleetInfo.managerName}
                </p>
                <p>{fleetInfo.email}</p>
                <p>{fleetInfo.phone}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={onAddVehicle} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Véhicule
              </Button>
              <Button onClick={onAddDriver} size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Chauffeur
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vehicles Stats */}
        <Card
          className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]"
          onClick={onViewVehicles}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Véhicules</CardTitle>
            <Truck className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary mb-2">{stats.totalVehicles}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                {stats.activeVehicles} actifs
              </Badge>
              {stats.inMaintenanceVehicles > 0 && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
                  {stats.inMaintenanceVehicles} maintenance
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Drivers Stats */}
        <Card
          className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-[1.02]"
          onClick={onViewDrivers}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chauffeurs</CardTitle>
            <Users className="h-5 w-5 text-secondary transition-transform group-hover:scale-110" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary mb-2">{stats.totalDrivers}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                {stats.assignedDrivers} assignés
              </Badge>
              {stats.unassignedDrivers > 0 && (
                <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-500/20">
                  {stats.unassignedDrivers} disponibles
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Alerts */}
        <Card
          className={`group hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
            stats.vehiclesNeedingService > 0 ? 'border-orange-500/50 bg-orange-500/5' : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entretien</CardTitle>
            <Activity
              className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                stats.vehiclesNeedingService > 0 ? 'text-orange-500' : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold mb-2 ${
                stats.vehiclesNeedingService > 0 ? 'text-orange-500' : 'text-muted-foreground'
              }`}
            >
              {stats.vehiclesNeedingService}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.vehiclesNeedingService > 0
                ? 'Véhicules nécessitant un entretien'
                : 'Aucun entretien prévu'}
            </p>
          </CardContent>
        </Card>

        {/* Insurance Alerts */}
        <Card
          className={`group hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
            stats.insuranceExpiringSoon > 0 ? 'border-red-500/50 bg-red-500/5' : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assurances</CardTitle>
            <Shield
              className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                stats.insuranceExpiringSoon > 0 ? 'text-red-500' : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold mb-2 ${
                stats.insuranceExpiringSoon > 0 ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              {stats.insuranceExpiringSoon}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.insuranceExpiringSoon > 0
                ? 'Assurances expirant bientôt'
                : 'Toutes les assurances à jour'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Vehicles */}
      {recentVehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Véhicules Récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentVehicles.map((vehicle) => (
                <div
                  key={vehicle._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-sm text-muted-foreground">{vehicle.registration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        vehicle.status === 'active'
                          ? 'default'
                          : vehicle.status === 'maintenance'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {vehicle.status === 'active'
                        ? 'Actif'
                        : vehicle.status === 'maintenance'
                        ? 'Maintenance'
                        : 'Inactif'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {stats.totalVehicles > 5 && (
              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={onViewVehicles}
              >
                Voir tous les véhicules ({stats.totalVehicles})
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stats.totalVehicles === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun véhicule</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              Commencez par ajouter des véhicules à votre flotte pour suivre leur activité et gérer les chauffeurs.
            </p>
            <Button onClick={onAddVehicle} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un véhicule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
