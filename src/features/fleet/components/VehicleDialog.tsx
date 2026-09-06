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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { vehicleService } from '../services/vehicle-service';
import type { Vehicle, VehicleType, FuelType, CreateVehicleData } from '../types';

interface VehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fleetId: string;
  vehicle?: Vehicle | null;
  onSuccess: () => void;
}

export function VehicleDialog({
  open,
  onOpenChange,
  fleetId,
  vehicle,
  onSuccess,
}: VehicleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateVehicleData>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    registration: '',
    vin: '',
    vehicleType: 'car',
    fuelType: 'diesel',
    tankCapacity: 50,
    currentMileage: 0,
    insuranceNumber: '',
    insuranceExpiry: '',
    notes: '',
  });

  useEffect(() => {
    if (vehicle) {
      setFormData({
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        registration: vehicle.registration,
        vin: vehicle.vin || '',
        vehicleType: vehicle.vehicleType,
        fuelType: vehicle.fuelType,
        tankCapacity: vehicle.tankCapacity,
        currentMileage: vehicle.currentMileage,
        insuranceNumber: vehicle.insuranceNumber || '',
        insuranceExpiry: vehicle.insuranceExpiry || '',
        notes: vehicle.notes || '',
      });
    } else {
      // Reset form for new vehicle
      setFormData({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        registration: '',
        vin: '',
        vehicleType: 'car',
        fuelType: 'diesel',
        tankCapacity: 50,
        currentMileage: 0,
        insuranceNumber: '',
        insuranceExpiry: '',
        notes: '',
      });
    }
  }, [vehicle, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (vehicle) {
        await vehicleService.updateVehicle(vehicle._id, formData);
      } else {
        await vehicleService.createVehicle(fleetId, formData);
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save vehicle:', error);
      alert('Erreur lors de la sauvegarde du véhicule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? 'Modifiez les informations du véhicule'
              : 'Ajoutez un nouveau véhicule à votre flotte'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Informations de base</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marque *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Toyota, Mercedes..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modèle *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Hilux, Sprinter..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Année *</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration">Immatriculation *</Label>
                <Input
                  id="registration"
                  value={formData.registration}
                  onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                  placeholder="DK-1234-AA"
                  required
                />
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Détails du véhicule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Type de véhicule *</Label>
                <Select
                  value={formData.vehicleType}
                  onValueChange={(value) => setFormData({ ...formData, vehicleType: value as VehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Voiture</SelectItem>
                    <SelectItem value="truck">Camion</SelectItem>
                    <SelectItem value="van">Fourgon</SelectItem>
                    <SelectItem value="bus">Bus</SelectItem>
                    <SelectItem value="motorcycle">Moto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuelType">Type de carburant *</Label>
                <Select
                  value={formData.fuelType}
                  onValueChange={(value) => setFormData({ ...formData, fuelType: value as FuelType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="gasoline">Essence</SelectItem>
                    <SelectItem value="hybrid">Hybride</SelectItem>
                    <SelectItem value="electric">Électrique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tankCapacity">Capacité réservoir (L) *</Label>
                <Input
                  id="tankCapacity"
                  type="number"
                  value={formData.tankCapacity}
                  onChange={(e) => setFormData({ ...formData, tankCapacity: parseInt(e.target.value) })}
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentMileage">Kilométrage actuel *</Label>
                <Input
                  id="currentMileage"
                  type="number"
                  value={formData.currentMileage}
                  onChange={(e) => setFormData({ ...formData, currentMileage: parseInt(e.target.value) })}
                  min="0"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vin">Numéro de châssis (VIN)</Label>
                <Input
                  id="vin"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                  placeholder="1HGBH41JXMN109186"
                />
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Assurance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insuranceNumber">Numéro d'assurance</Label>
                <Input
                  id="insuranceNumber"
                  value={formData.insuranceNumber}
                  onChange={(e) => setFormData({ ...formData, insuranceNumber: e.target.value })}
                  placeholder="ASS-2024-12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceExpiry">Date d'expiration</Label>
                <Input
                  id="insuranceExpiry"
                  type="date"
                  value={formData.insuranceExpiry}
                  onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informations additionnelles..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sauvegarde...' : vehicle ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
