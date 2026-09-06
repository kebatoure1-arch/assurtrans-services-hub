/**
 * AssignDriverSection Component
 * Dedicated UI for assigning drivers to vehicles
 * Separate from driver creation workflow
 */

import { useState } from 'react';
import { assignDriverToVehicle } from '@/services/vehicle-driver-service';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Truck, User, ArrowRight } from 'lucide-react';

interface Vehicle {
  _id: string;
  registration: string;
  brand?: string;
  model?: string;
  driverId?: string | null;
}

interface Driver {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface AssignDriverSectionProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  onAssigned?: () => void; // Callback to reload fleet data
}

export function AssignDriverSection({
  vehicles,
  drivers,
  onAssigned,
}: AssignDriverSectionProps) {
  const { toast } = useToast();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Get driver display name (handle both name and firstName/lastName)
  const getDriverName = (driver: Driver): string => {
    if (driver.name) return driver.name;
    if (driver.firstName && driver.lastName) {
      return `${driver.firstName} ${driver.lastName}`;
    }
    return driver.firstName || driver.lastName || 'Chauffeur sans nom';
  };

  // Filter unassigned vehicles (or vehicles needing reassignment)
  const unassignedVehicles = vehicles.filter((v) => !v.driverId || v.driverId === null);

  const handleAssign = async () => {
    if (!selectedVehicleId || !selectedDriverId) {
      toast({
        title: 'Champs manquants',
        description: 'Veuillez choisir un véhicule et un chauffeur.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await assignDriverToVehicle(selectedVehicleId, selectedDriverId);

      toast({
        title: '✅ Chauffeur assigné',
        description: 'Le chauffeur a été assigné au véhicule avec succès.',
      });

      // Reset selections
      setSelectedVehicleId('');
      setSelectedDriverId('');

      // Trigger reload
      if (onAssigned) onAssigned();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible d\'assigner le chauffeur.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Show helpful message if no unassigned vehicles
  if (unassignedVehicles.length === 0) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="py-8 text-center">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            Tous vos véhicules ont déjà un chauffeur assigné.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Vous pouvez modifier les assignations dans l'onglet Véhicules.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-lg">Assignation Chauffeur ↔ Véhicule</div>
            <div className="text-sm font-normal text-muted-foreground">
              Affectez un chauffeur à un véhicule disponible
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-[1fr,auto,1fr,auto] items-end">
          {/* Vehicle Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Véhicule disponible</span>
            </div>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choisir un véhicule" />
              </SelectTrigger>
              <SelectContent>
                {unassignedVehicles.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.registration}</span>
                      {(v.brand || v.model) && (
                        <span className="text-muted-foreground text-sm">
                          – {v.brand} {v.model}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {unassignedVehicles.length} véhicule(s) sans chauffeur
            </p>
          </div>

          {/* Arrow Icon */}
          <div className="hidden md:flex items-center justify-center pb-2">
            <ArrowRight className="w-6 h-6 text-primary" />
          </div>

          {/* Driver Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Chauffeur</span>
            </div>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choisir un chauffeur" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getDriverName(d)}</span>
                      {d.phone && (
                        <span className="text-muted-foreground text-sm">
                          ({d.phone})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {drivers.length} chauffeur(s) disponible(s)
            </p>
          </div>

          {/* Assign Button */}
          <div className="flex justify-end md:justify-start">
            <Button
              onClick={handleAssign}
              disabled={loading || !selectedVehicleId || !selectedDriverId}
              size="lg"
              className="gap-2 w-full md:w-auto"
            >
              <User className="w-4 h-4" />
              {loading ? 'Assignation...' : 'Assigner'}
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Astuce :</strong> Après l'assignation, le chauffeur pourra voir ce
            véhicule dans son profil et passer des commandes de carburant.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
