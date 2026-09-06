import { table } from '@devvai/devv-code-backend';
import type { Vehicle, CreateVehicleData, UpdateVehicleData } from '../types';

const VEHICLES_TABLE_ID = 'f4f06zbgkav4';

// Helper to get current user ID from localStorage
const getCurrentUserId = (): string => {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('Not authenticated');
  
  const parsed = JSON.parse(authStorage);
  const userId = parsed.state?.user?.uid;
  
  if (!userId) throw new Error('User ID not found');
  return userId;
};

export const vehicleService = {
  // Create a new vehicle
  async createVehicle(fleetId: string, data: CreateVehicleData): Promise<void> {
    const now = new Date().toISOString();
    const currentUserId = getCurrentUserId();
    
    await table.addItem(VEHICLES_TABLE_ID, {
      _uid: currentUserId,
      fleetId,
      ...data,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  },

  // Get all vehicles for a fleet
  async getFleetVehicles(fleetId: string): Promise<Vehicle[]> {
    const result = await table.getItems(VEHICLES_TABLE_ID, {
      query: { fleetId },
      limit: 100,
    });

    return (result.items || []) as Vehicle[];
  },

  // Get vehicle by ID
  async getVehicleById(vehicleId: string): Promise<Vehicle | null> {
    const currentUserId = getCurrentUserId();
    
    const result = await table.getItems(VEHICLES_TABLE_ID, {
      query: {
        _uid: currentUserId,
        _id: vehicleId,
      },
      limit: 1,
    });

    const vehicles = result.items as Vehicle[];
    return vehicles.length > 0 ? vehicles[0] : null;
  },

  // Get vehicle by registration
  async getVehicleByRegistration(registration: string): Promise<Vehicle | null> {
    const result = await table.getItems(VEHICLES_TABLE_ID, {
      query: { registration },
      limit: 1,
    });

    const vehicles = result.items as Vehicle[];
    return vehicles.length > 0 ? vehicles[0] : null;
  },

  // Update vehicle
  async updateVehicle(vehicleId: string, data: UpdateVehicleData): Promise<void> {
    const currentUserId = getCurrentUserId();
    
    await table.updateItem(VEHICLES_TABLE_ID, {
      _uid: currentUserId,
      _id: vehicleId,
      updatedAt: new Date().toISOString(),
      ...data,
    });
  },

  // Assign driver to vehicle
  async assignDriver(vehicleId: string, driverId: string): Promise<void> {
    await this.updateVehicle(vehicleId, { driverId });
  },

  // Unassign driver from vehicle
  async unassignDriver(vehicleId: string): Promise<void> {
    await this.updateVehicle(vehicleId, { driverId: '' });
  },

  // Delete vehicle
  async deleteVehicle(vehicleId: string): Promise<void> {
    const currentUserId = getCurrentUserId();
    
    await table.deleteItem(VEHICLES_TABLE_ID, {
      _uid: currentUserId,
      _id: vehicleId,
    });
  },

  // Get vehicles needing service (within 7 days or overdue)
  async getVehiclesNeedingService(fleetId: string): Promise<Vehicle[]> {
    const allVehicles = await this.getFleetVehicles(fleetId);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return allVehicles.filter((vehicle) => {
      if (!vehicle.nextServiceDue) return false;
      const serviceDue = new Date(vehicle.nextServiceDue);
      return serviceDue <= sevenDaysFromNow;
    });
  },

  // Get vehicles with expiring insurance (within 30 days or expired)
  async getVehiclesWithExpiringInsurance(fleetId: string): Promise<Vehicle[]> {
    const allVehicles = await this.getFleetVehicles(fleetId);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return allVehicles.filter((vehicle) => {
      if (!vehicle.insuranceExpiry) return false;
      const expiryDate = new Date(vehicle.insuranceExpiry);
      return expiryDate <= thirtyDaysFromNow;
    });
  },
};

// Export helper function for fuel ordering
export async function getVehiclesByFleet(fleetId?: string): Promise<Vehicle[]> {
  if (!fleetId) {
    // If no fleetId provided, get current user's fleet ID from user profile
    const currentUserId = getCurrentUserId();
    // For now, return all vehicles for current user
    const result = await table.getItems(VEHICLES_TABLE_ID, {
      query: { _uid: currentUserId },
      limit: 100,
    });
    return (result.items || []) as Vehicle[];
  }
  
  return vehicleService.getFleetVehicles(fleetId);
}
