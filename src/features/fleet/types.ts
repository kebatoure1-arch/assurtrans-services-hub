// Fleet and Vehicle Types

export type VehicleType = 'truck' | 'van' | 'car' | 'bus' | 'motorcycle';
export type FuelType = 'diesel' | 'gasoline' | 'hybrid' | 'electric';
export type VehicleStatus = 'active' | 'maintenance' | 'inactive';

export interface Vehicle {
  _id: string;
  _uid: string;
  fleetId: string;
  driverId?: string;
  brand: string;
  model: string;
  year: number;
  registration: string;
  vin?: string;
  vehicleType: VehicleType;
  fuelType: FuelType;
  tankCapacity: number;
  currentMileage: number;
  status: VehicleStatus;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  lastServiceDate?: string;
  nextServiceDue?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleData {
  brand: string;
  model: string;
  year: number;
  registration: string;
  vin?: string;
  vehicleType: VehicleType;
  fuelType: FuelType;
  tankCapacity: number;
  currentMileage: number;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  notes?: string;
}

export interface UpdateVehicleData extends Partial<CreateVehicleData> {
  driverId?: string;
  status?: VehicleStatus;
  lastServiceDate?: string;
  nextServiceDue?: string;
  currentMileage?: number;
}

export interface FleetStats {
  totalVehicles: number;
  activeVehicles: number;
  inMaintenanceVehicles: number;
  inactiveVehicles: number;
  totalDrivers: number;
  assignedDrivers: number;
  unassignedDrivers: number;
  vehiclesNeedingService: number;
  insuranceExpiringSoon: number;
}

export interface FleetOverview {
  fleetInfo: {
    fleetId: string;
    fleetName: string;
    managerName: string;
    email: string;
    phone: string;
  };
  stats: FleetStats;
  recentVehicles: Vehicle[];
}
