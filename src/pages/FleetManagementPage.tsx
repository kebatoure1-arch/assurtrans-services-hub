import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, LayoutDashboard, Truck, Users, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { FleetOverview } from '@/features/fleet/components/FleetOverview';
import { VehicleList } from '@/features/fleet/components/VehicleList';
import { VehicleDialog } from '@/features/fleet/components/VehicleDialog';
import { AssignDriverDialog } from '@/features/fleet/components/AssignDriverDialog';
import { DriverList } from '@/features/fleet/components/DriverList';
import { AssignDriverSection } from '@/features/fleet/components/AssignDriverSection';
import { EditUserDialog } from '@/features/users/components/EditUserDialog';
import { userService } from '@/features/users/services/user-service';
import { getAllDrivers } from '@/services/driver-service';
import { table } from '@devvai/devv-code-backend';
import type { Vehicle } from '@/features/fleet/types';
import type { User } from '@/features/users/types';

const VEHICLES_TABLE_ID = 'f4f06zbgkav4';

export default function FleetManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [vehicleDialog, setVehicleDialog] = useState<{
    open: boolean;
    vehicle: Vehicle | null;
  }>({ open: false, vehicle: null });
  const [assignDriverDialog, setAssignDriverDialog] = useState<{
    open: boolean;
    vehicle: Vehicle | null;
  }>({ open: false, vehicle: null });
  const [editDriverDialog, setEditDriverDialog] = useState<{
    open: boolean;
    driver: User | null;
  }>({ open: false, driver: null });

  // Data for assignment section
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]); // Use any[] to accommodate DriverRecord type
  const [loadingData, setLoadingData] = useState(false);

  // ✅ Admin has unrestricted access
  if (!user || (user.activeRole !== 'fleet_manager' && user.activeRole !== 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Cette page est réservée aux chefs de flotte
          </p>
          <Button onClick={() => navigate('/dashboard')}>Retour au tableau de bord</Button>
        </Card>
      </div>
    );
  }

  // Load vehicles and drivers for assignment
  const loadFleetData = async () => {
    try {
      setLoadingData(true);

      // Load vehicles - ✅ FIXED: Use fleetId instead of fleetManagerId
      const vehiclesResult = await table.getItems(VEHICLES_TABLE_ID, {
        query: { fleetId: user.uid },
      });
      const vehiclesData = (vehiclesResult as any).items || [];
      setVehicles(vehiclesData);

      // Load drivers
      const driversData = await getAllDrivers();
      setDrivers(driversData);
    } catch (error: any) {
      console.error('Error loading fleet data:', error?.message || error);
      
      // Graceful error handling
      if (
        typeof error?.message === 'string' &&
        error.message.includes('project table') &&
        error.message.includes('not found')
      ) {
        console.log('ℹ️ Fleet data tables not fully initialized');
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      loadFleetData();
    }
  }, [activeTab, user.uid]);

  const handleVehicleSuccess = () => {
    // Reload data by changing tab and back
    const currentTab = activeTab;
    setActiveTab('');
    setTimeout(() => setActiveTab(currentTab), 0);
    
    // Also reload fleet data for assignment section
    loadFleetData();
  };

  const handleAddVehicle = () => {
    setVehicleDialog({ open: true, vehicle: null });
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setVehicleDialog({ open: true, vehicle });
  };

  const handleAssignDriver = (vehicle: Vehicle) => {
    setAssignDriverDialog({ open: true, vehicle });
  };

  /**
   * ✅ NEW APPROACH: Navigate to DriverCreatePage
   * Removed old CreateUserDialog for drivers
   */
  const handleAddDriver = () => {
    navigate('/drivers/new');
  };

  const handleEditDriver = (driver: User) => {
    setEditDriverDialog({ open: true, driver });
  };

  const handleDeleteDriver = async (driver: User) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${driver.firstName} ${driver.lastName} ?\n\nCette action est irréversible.`)) {
      try {
        await userService.deleteUser(driver._uid, driver._id);
        handleVehicleSuccess();
      } catch (error) {
        console.error('Failed to delete driver:', error);
        alert('Erreur lors de la suppression du chauffeur');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Gestion de Flotte</h1>
              <p className="text-muted-foreground">
                Gérez vos véhicules et chauffeurs
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Vue d'ensemble</span>
              <span className="sm:hidden">Vue</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2">
              <Truck className="h-4 w-4" />
              Véhicules
            </TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2">
              <Users className="h-4 w-4" />
              Chauffeurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <FleetOverview
              fleetId={user.uid}
              onAddVehicle={handleAddVehicle}
              onAddDriver={handleAddDriver}
              onViewVehicles={() => setActiveTab('vehicles')}
              onViewDrivers={() => setActiveTab('drivers')}
            />

            {/* ✅ NEW: Dedicated assignment section */}
            <AssignDriverSection
              vehicles={vehicles}
              drivers={drivers}
              onAssigned={loadFleetData}
            />
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Mes Véhicules</h2>
              <Button onClick={handleAddVehicle} className="gap-2">
                <Truck className="h-4 w-4" />
                Ajouter un véhicule
              </Button>
            </div>
            <VehicleList
              fleetId={user.uid}
              onEdit={handleEditVehicle}
              onAssignDriver={handleAssignDriver}
            />
          </TabsContent>

          <TabsContent value="drivers" className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Mes Chauffeurs</h2>
              
              {/* ✅ UPDATED: Navigate to DriverCreatePage instead of dialog */}
              <Button onClick={handleAddDriver} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Ajouter un chauffeur
              </Button>
            </div>
            <DriverList
              fleetId={user.uid}
              onEdit={handleEditDriver}
              onDelete={handleDeleteDriver}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <VehicleDialog
        open={vehicleDialog.open}
        onOpenChange={(open) => setVehicleDialog({ ...vehicleDialog, open })}
        fleetId={user.uid}
        vehicle={vehicleDialog.vehicle}
        onSuccess={handleVehicleSuccess}
      />

      <AssignDriverDialog
        open={assignDriverDialog.open}
        onOpenChange={(open) => setAssignDriverDialog({ ...assignDriverDialog, open })}
        vehicle={assignDriverDialog.vehicle}
        fleetId={user.uid}
        onSuccess={handleVehicleSuccess}
      />

      {/* ✅ ONLY EditUserDialog - No more CreateUserDialog for drivers */}
      {editDriverDialog.driver && (
        <EditUserDialog
          open={editDriverDialog.open}
          onOpenChange={(open) => setEditDriverDialog({ ...editDriverDialog, open })}
          user={editDriverDialog.driver}
          allowedRoles={['driver']}
          onSuccess={handleVehicleSuccess}
        />
      )}
    </div>
  );
}
