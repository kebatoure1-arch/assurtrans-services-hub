import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, MoreVertical, Edit, Trash2, User, Truck, AlertCircle } from 'lucide-react';
import { vehicleService } from '../services/vehicle-service';
import { userService } from '@/features/users/services/user-service';
import type { Vehicle, VehicleStatus } from '../types';
import type { User as UserType } from '@/features/users/types';

interface VehicleListProps {
  fleetId: string;
  onEdit: (vehicle: Vehicle) => void;
  onAssignDriver: (vehicle: Vehicle) => void;
}

export function VehicleList({ fleetId, onEdit, onAssignDriver }: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; vehicle: Vehicle | null }>({
    open: false,
    vehicle: null,
  });

  useEffect(() => {
    loadData();
  }, [fleetId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vehiclesData, allUsers] = await Promise.all([
        vehicleService.getFleetVehicles(fleetId),
        userService.listUsers(),
      ]);
      
      setVehicles(vehiclesData);
      setDrivers(allUsers.filter(u => u.role === 'driver' && u.parentId === fleetId));
    } catch (error) {
      console.error('Failed to load vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.vehicle) return;

    try {
      await vehicleService.deleteVehicle(deleteDialog.vehicle._id);
      setVehicles(vehicles.filter((v) => v._id !== deleteDialog.vehicle!._id));
      setDeleteDialog({ open: false, vehicle: null });
    } catch (error) {
      console.error('Failed to delete vehicle:', error);
    }
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'Non assigné';
    const driver = drivers.find(d => d._id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Chauffeur inconnu';
  };

  const getStatusBadge = (status: VehicleStatus) => {
    const variants = {
      active: { variant: 'default' as const, label: 'Actif', className: 'bg-green-500/10 text-green-700 border-green-500/20' },
      maintenance: { variant: 'secondary' as const, label: 'Maintenance', className: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
      inactive: { variant: 'outline' as const, label: 'Inactif', className: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
    };
    const config = variants[status];
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      searchQuery === '' ||
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.registration.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const isServiceDueSoon = (vehicle: Vehicle) => {
    if (!vehicle.nextServiceDue) return false;
    const dueDate = new Date(vehicle.nextServiceDue);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate <= sevenDaysFromNow;
  };

  const isInsuranceExpiringSoon = (vehicle: Vehicle) => {
    if (!vehicle.insuranceExpiry) return false;
    const expiryDate = new Date(vehicle.insuranceExpiry);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiryDate <= thirtyDaysFromNow;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par marque, modèle ou immatriculation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="inactive">Inactif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vehicle List */}
      <div className="space-y-3">
        {filteredVehicles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Aucun véhicule trouvé'
                  : 'Aucun véhicule dans la flotte'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredVehicles.map((vehicle) => (
            <Card
              key={vehicle._id}
              className="group hover:shadow-md transition-all duration-300"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Vehicle Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="font-semibold text-lg">
                          {vehicle.brand} {vehicle.model}
                        </h3>
                        {(isServiceDueSoon(vehicle) || isInsuranceExpiringSoon(vehicle)) && (
                          <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                        <div>
                          <span className="font-medium">Immatriculation:</span> {vehicle.registration}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {vehicle.vehicleType}
                        </div>
                        <div>
                          <span className="font-medium">Carburant:</span> {vehicle.fuelType}
                        </div>
                        <div>
                          <span className="font-medium">Année:</span> {vehicle.year}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        {getStatusBadge(vehicle.status)}
                        <Badge variant="outline" className="gap-1">
                          <User className="h-3 w-3" />
                          {getDriverName(vehicle.driverId)}
                        </Badge>
                        {isServiceDueSoon(vehicle) && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
                            Entretien proche
                          </Badge>
                        )}
                        {isInsuranceExpiringSoon(vehicle) && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
                            Assurance expire bientôt
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAssignDriver(vehicle)}>
                        <User className="h-4 w-4 mr-2" />
                        Assigner chauffeur
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteDialog({ open: true, vehicle })}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le véhicule ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{' '}
              <span className="font-semibold">
                {deleteDialog.vehicle?.brand} {deleteDialog.vehicle?.model}
              </span>{' '}
              ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
