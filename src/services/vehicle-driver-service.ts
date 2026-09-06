/**
 * Vehicle-Driver Assignment Service
 * Manages driver assignment to vehicles
 */

import { table } from '@devvai/devv-code-backend';

const VEHICLES_TABLE_ID = 'f4f06zbgkav4';

/**
 * Assign a driver to a vehicle
 * @param vehicleId - Vehicle _id (Devv)
 * @param driverId - Driver _id (from users table)
 */
export async function assignDriverToVehicle(
  vehicleId: string,
  driverId: string
): Promise<void> {
  try {
    console.log('🚛 Assigning driver to vehicle:', { vehicleId, driverId });

    await table.updateItem(VEHICLES_TABLE_ID, {
      _id: vehicleId,
      // ⚠️ IMPORTANT: This field name must match your vehicles table schema
      // Based on your logs (_limit=1&driverId=...) → the field is 'driverId'
      driverId,
      updatedAt: new Date().toISOString(),
    });

    console.log('✅ Driver assigned successfully to vehicle');
  } catch (err: any) {
    console.error('❌ Error assigning driver to vehicle:', err?.message || err);
    
    // Graceful error handling for missing table
    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Vehicles table not found - feature not fully configured');
      throw new Error('La fonctionnalité d\'assignation n\'est pas encore configurée');
    }
    
    throw new Error(err?.message || 'Impossible d\'assigner le chauffeur au véhicule');
  }
}

/**
 * Unassign a driver from a vehicle
 * @param vehicleId - Vehicle _id (Devv)
 */
export async function unassignDriverFromVehicle(vehicleId: string): Promise<void> {
  try {
    console.log('🚛 Unassigning driver from vehicle:', vehicleId);

    await table.updateItem(VEHICLES_TABLE_ID, {
      _id: vehicleId,
      driverId: null,
      updatedAt: new Date().toISOString(),
    });

    console.log('✅ Driver unassigned successfully from vehicle');
  } catch (err: any) {
    console.error('❌ Error unassigning driver from vehicle:', err?.message || err);
    
    // Graceful error handling for missing table
    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Vehicles table not found - feature not fully configured');
      throw new Error('La fonctionnalité d\'assignation n\'est pas encore configurée');
    }
    
    throw new Error(err?.message || 'Impossible de retirer le chauffeur du véhicule');
  }
}

/**
 * Get vehicles assigned to a specific driver
 * @param driverId - Driver _id
 */
export async function getDriverVehicles(driverId: string): Promise<any[]> {
  try {
    const result = await table.getItems(VEHICLES_TABLE_ID, {
      query: { driverId },
    });

    return (result as any).items || [];
  } catch (err: any) {
    console.error('❌ Error fetching driver vehicles:', err?.message || err);
    
    // Graceful error handling for missing table
    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Vehicles table not found - returning empty array');
      return [];
    }
    
    return [];
  }
}

/**
 * Get unassigned vehicles for a fleet manager
 * @param fleetManagerId - Fleet manager user ID
 */
export async function getUnassignedVehicles(fleetManagerId: string): Promise<any[]> {
  try {
    const result = await table.getItems(VEHICLES_TABLE_ID, {
      query: { fleetManagerId },
    });

    const vehicles = (result as any).items || [];
    
    // Filter vehicles without assigned driver
    return vehicles.filter((v: any) => !v.driverId || v.driverId === null);
  } catch (err: any) {
    console.error('❌ Error fetching unassigned vehicles:', err?.message || err);
    
    // Graceful error handling for missing table
    if (
      typeof err?.message === 'string' &&
      err.message.includes('project table') &&
      err.message.includes('not found')
    ) {
      console.log('ℹ️ Vehicles table not found - returning empty array');
      return [];
    }
    
    return [];
  }
}
