import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, UserX } from 'lucide-react';
import { vehicleService } from '../services/vehicle-service';
import { fleetService } from '../services/fleet-service';
import type { Vehicle } from '../types';
import type { User as UserType } from '@/features/users/types';

interface AssignDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  fleetId: string;
  onSuccess: () => void;
}

export function AssignDriverDialog({
  open,
  onOpenChange,
  vehicle,
  fleetId,
  onSuccess,
}: AssignDriverDialogProps) {
  const [loading, setLoading] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<UserType[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  useEffect(() => {
    if (open && vehicle) {
      loadAvailableDrivers();
      setSelectedDriverId(vehicle.driverId || '');
    }
  }, [open, vehicle]);

  const loadAvailableDrivers = async () => {
    try {
      const drivers = await fleetService.getAvailableDrivers(fleetId);
      setAvailableDrivers(drivers);
    } catch (error) {
      console.error('Failed to load drivers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    setLoading(true);
    try {
      if (selectedDriverId) {
        await vehicleService.assignDriver(vehicle._id, selectedDriverId);
      } else {
        await vehicleService.unassignDriver(vehicle._id);
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to assign driver:', error);
      alert('Erreur lors de l\'assignation du chauffeur');
    } finally {
      setLoading(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assigner un chauffeur</DialogTitle>
          <DialogDescription>
            Véhicule: {vehicle.brand} {vehicle.model} ({vehicle.registration})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Current Assignment */}
            {vehicle.driverId && (
              <div className="p-4 rounded-lg bg-muted">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Chauffeur actuel
                </Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">
                    {/* Driver name would be fetched - showing ID for now */}
                    Chauffeur assigné
                  </span>
                  <Badge variant="secondary">Assigné</Badge>
                </div>
              </div>
            )}

            {/* Driver Selection */}
            <div className="space-y-2">
              <Label htmlFor="driver">
                {vehicle.driverId ? 'Réassigner à' : 'Assigner à'}
              </Label>
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un chauffeur" />
                </SelectTrigger>
                <SelectContent>
                  {vehicle.driverId && (
                    <SelectItem value="">
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4" />
                        <span>Retirer l'assignation</span>
                      </div>
                    </SelectItem>
                  )}
                  {availableDrivers.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Aucun chauffeur disponible
                    </div>
                  ) : (
                    availableDrivers.map((driver) => (
                      <SelectItem key={driver._id} value={driver._id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>
                            {driver.firstName} {driver.lastName}
                          </span>
                          {driver.phone && (
                            <span className="text-xs text-muted-foreground">
                              ({driver.phone})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {availableDrivers.length === 0 && !vehicle.driverId && (
                <p className="text-sm text-muted-foreground">
                  Tous les chauffeurs sont déjà assignés. Ajoutez de nouveaux chauffeurs ou désassignez-en d'autres.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || (!selectedDriverId && !vehicle.driverId)}>
              {loading ? 'Sauvegarde...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
