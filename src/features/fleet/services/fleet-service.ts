import type { FleetStats, FleetOverview } from '../types';
import { vehicleService } from './vehicle-service';
import { userService } from '@/features/users/services/user-service';
import type { User } from '@/features/users/types';

export const fleetService = {
  // Get complete fleet overview
  async getFleetOverview(fleetId: string): Promise<FleetOverview> {
    // Get fleet manager info - fetch all users since getUserById doesn't exist
    const allUsers = await userService.listUsers();
    const fleetManager = allUsers.find(u => u._uid === fleetId || u._id === fleetId);
    if (!fleetManager) {
      throw new Error('Fleet manager not found');
    }

    // Get all vehicles
    const vehicles = await vehicleService.getFleetVehicles(fleetId);

    // Get all drivers for this fleet
    const drivers = allUsers.filter(
      (user) => user.role === 'driver' && user.parentId === fleetId
    );

    // Calculate stats
    const stats: FleetStats = {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.status === 'active').length,
      inMaintenanceVehicles: vehicles.filter((v) => v.status === 'maintenance').length,
      inactiveVehicles: vehicles.filter((v) => v.status === 'inactive').length,
      totalDrivers: drivers.length,
      assignedDrivers: vehicles.filter((v) => v.driverId).length,
      unassignedDrivers: drivers.filter(
        (driver) => !vehicles.some((v) => v.driverId === driver._id)
      ).length,
      vehiclesNeedingService: 0,
      insuranceExpiringSoon: 0,
    };

    // Check for vehicles needing service
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    stats.vehiclesNeedingService = vehicles.filter((v) => {
      if (!v.nextServiceDue) return false;
      return new Date(v.nextServiceDue) <= sevenDaysFromNow;
    }).length;

    // Check for expiring insurance
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    stats.insuranceExpiringSoon = vehicles.filter((v) => {
      if (!v.insuranceExpiry) return false;
      return new Date(v.insuranceExpiry) <= thirtyDaysFromNow;
    }).length;

    return {
      fleetInfo: {
        fleetId: fleetManager._id,
        fleetName: fleetManager.companyName || `${fleetManager.firstName} ${fleetManager.lastName}`,
        managerName: `${fleetManager.firstName} ${fleetManager.lastName}`,
        email: fleetManager.email,
        phone: fleetManager.phone,
      },
      stats,
      recentVehicles: vehicles.slice(0, 5),
    };
  },

  // Get available drivers (not assigned to any vehicle)
  async getAvailableDrivers(fleetId: string): Promise<User[]> {
    const vehicles = await vehicleService.getFleetVehicles(fleetId);
    const assignedDriverIds = new Set(
      vehicles.filter((v) => v.driverId).map((v) => v.driverId!)
    );

    const allUsers = await userService.listUsers();
    return allUsers.filter(
      (user) =>
        user.role === 'driver' &&
        user.parentId === fleetId &&
        !assignedDriverIds.has(user._id)
    );
  },

  // Get driver's assigned vehicle
  async getDriverVehicle(fleetId: string, driverId: string): Promise<any> {
    const vehicles = await vehicleService.getFleetVehicles(fleetId);
    return vehicles.find((v) => v.driverId === driverId) || null;
  },
};
