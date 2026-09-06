// Station Service - Station Network Management

import { table } from '@devvai/devv-code-backend';
import { Station } from '../types';

const STATIONS_TABLE_ID = 'f4f2zphd3uv4';

// Get current user ID from localStorage
function getCurrentUserId(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('User not authenticated');
  const parsed = JSON.parse(authStorage);
  return parsed.state?.user?.uid || '';
}

// Get all stations
export async function getStations(filterQuery?: { 
  petrolier_id?: string; 
  city?: string;
  status?: string;
}): Promise<Station[]> {
  try {
    const result = await table.getItems(STATIONS_TABLE_ID, {
      query: filterQuery || {}
    });
    return (result.items || []) as Station[];
  } catch (error) {
    console.error('Error fetching stations:', error);
    throw error;
  }
}

// Get station by ID
export async function getStationById(stationId: string): Promise<Station | null> {
  try {
    const result = await table.getItems(STATIONS_TABLE_ID, {
      query: { _id: stationId }
    });
    return result.items?.[0] as Station || null;
  } catch (error) {
    console.error('Error fetching station:', error);
    throw error;
  }
}

// Create new station
export async function createStation(stationData: Omit<Station, '_id' | '_uid' | 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await table.addItem(STATIONS_TABLE_ID, {
      ...stationData,
      createdAt: now,
      updatedAt: now,
      status: stationData.status || 'active',
      country: stationData.country || 'Sénégal',
      servicesOffered: stationData.servicesOffered || JSON.stringify(['fuel'])
    });
  } catch (error) {
    console.error('Error creating station:', error);
    throw error;
  }
}

// Update station
export async function updateStation(stationId: string, uid: string, updates: Partial<Station>): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await table.updateItem(STATIONS_TABLE_ID, {
      _uid: uid,
      _id: stationId,
      ...updates,
      updatedAt: now
    });
  } catch (error) {
    console.error('Error updating station:', error);
    throw error;
  }
}

// Delete station
export async function deleteStation(stationId: string, uid: string): Promise<void> {
  try {
    await table.deleteItem(STATIONS_TABLE_ID, {
      _uid: uid,
      _id: stationId
    });
  } catch (error) {
    console.error('Error deleting station:', error);
    throw error;
  }
}

// Get active stations
export async function getActiveStations(city?: string): Promise<Station[]> {
  const query: any = { status: 'active' };
  if (city) query.city = city;
  return getStations(query);
}

// Get petrolier's stations
export async function getPetrolierStations(petrolierId?: string): Promise<Station[]> {
  const userId = petrolierId || getCurrentUserId();
  return getStations({ petrolier_id: userId });
}

// Get stations by city
export async function getStationsByCity(city: string): Promise<Station[]> {
  return getStations({ city });
}
