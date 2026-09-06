import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Edit, Trash2, User, Car } from 'lucide-react';
import { userService } from '@/features/users/services/user-service';
import { vehicleService } from '../services/vehicle-service';
import type { User as UserType } from '@/features/users/types';
import type { Vehicle } from '../types';

interface DriverListProps {
  fleetId: string;
  onEdit: (driver: UserType) => void;
  onDelete: (driver: UserType) => void;
}

export function DriverList({ fleetId, onEdit, onDelete }: DriverListProps) {
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [fleetId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allUsers, vehiclesList] = await Promise.all([
        userService.listUsers(),
        vehicleService.getFleetVehicles(fleetId),
      ]);

      const fleetDrivers = allUsers.filter(
        (user) => user.role === 'driver' && user.parentId === fleetId
      );

      setDrivers(fleetDrivers);
      setVehicles(vehiclesList);
    } catch (error) {
      console.error('Failed to load drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDriverVehicle = (driverId: string): Vehicle | null => {
    return vehicles.find((v) => v.driverId === driverId) || null;
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (searchQuery === '') return true;
    
    const query = searchQuery.toLowerCase();
    return (
      driver.firstName.toLowerCase().includes(query) ||
      driver.lastName.toLowerCase().includes(query) ||
      driver.email.toLowerCase().includes(query) ||
      driver.phone.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-lg animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un chauffeur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Driver List */}
      <div className="space-y-3">
        {filteredDrivers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Aucun chauffeur trouvé' : 'Aucun chauffeur dans la flotte'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDrivers.map((driver) => {
            const vehicle = getDriverVehicle(driver._id);
            
            return (
              <Card
                key={driver._id}
                className="group hover:shadow-md transition-all duration-300"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Driver Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-14 w-14 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-7 w-7 text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1">
                          {driver.firstName} {driver.lastName}
                        </h3>
                        
                        <div className="space-y-1 text-sm text-muted-foreground mb-3">
                          <p>{driver.email}</p>
                          <p>{driver.phone}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                          <Badge
                            variant={driver.status === 'active' ? 'default' : 'secondary'}
                            className={
                              driver.status === 'active'
                                ? 'bg-green-500/10 text-green-700 border-green-500/20'
                                : 'bg-gray-500/10 text-gray-700 border-gray-500/20'
                            }
                          >
                            {driver.status === 'active' ? 'Actif' : 'Inactif'}
                          </Badge>
                          
                          {vehicle ? (
                            <Badge variant="outline" className="gap-1 bg-primary/5">
                              <Car className="h-3 w-3" />
                              {vehicle.brand} {vehicle.model} ({vehicle.registration})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-muted">
                              <Car className="h-3 w-3" />
                              Non assigné
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
                        <DropdownMenuItem onClick={() => onEdit(driver)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(driver)}
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
            );
          })
        )}
      </div>
    </div>
  );
}
