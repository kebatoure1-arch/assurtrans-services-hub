import { table } from '@devvai/devv-code-backend';

const SYNC_QUEUE_TABLE_ID = 'f4fa0h4yv2f4';
const SYNC_STORAGE_KEY = 'assur-trans-offline-queue';

export interface SyncQueueItem {
  _id?: string;
  _uid?: string;
  operation: 'create' | 'update' | 'delete';
  table_name: string;
  data: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
}

export interface OfflineData {
  [tableName: string]: any[];
}

class OfflineSyncService {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Check online status periodically
    setInterval(this.checkOnlineStatus, 30000);
  }

  private handleOnline = () => {
    console.log('🟢 Connection restored');
    this.isOnline = true;
    this.notifyListeners();
    this.syncPendingChanges();
  };

  private handleOffline = () => {
    console.log('🔴 Connection lost - Offline mode active');
    this.isOnline = false;
    this.notifyListeners();
  };

  private checkOnlineStatus = async () => {
    try {
      const online = navigator.onLine;
      if (online !== this.isOnline) {
        this.isOnline = online;
        this.notifyListeners();
        if (online) {
          await this.syncPendingChanges();
        }
      }
    } catch (error) {
      console.error('Failed to check online status:', error);
    }
  };

  // Subscribe to online/offline changes
  subscribe(callback: (isOnline: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Queue operation for sync
  async queueOperation(
    operation: 'create' | 'update' | 'delete',
    tableName: string,
    data: any
  ): Promise<void> {
    const queueItem: Partial<SyncQueueItem> = {
      operation,
      table_name: tableName,
      data: JSON.stringify(data),
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    // Store in localStorage for immediate offline access
    const localQueue = this.getLocalQueue();
    localQueue.push(queueItem as SyncQueueItem);
    this.saveLocalQueue(localQueue);

    // If online, also add to remote queue
    if (this.isOnline) {
      try {
        await table.addItem(SYNC_QUEUE_TABLE_ID, queueItem);
      } catch (error) {
        console.error('Failed to add to remote queue:', error);
      }
    }
  }

  // Get local queue from localStorage
  private getLocalQueue(): SyncQueueItem[] {
    try {
      const stored = localStorage.getItem(SYNC_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get local queue:', error);
      return [];
    }
  }

  // Save local queue to localStorage
  private saveLocalQueue(queue: SyncQueueItem[]): void {
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save local queue:', error);
    }
  }

  // Sync pending changes when back online
  async syncPendingChanges(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Starting sync...');

    try {
      const localQueue = this.getLocalQueue();
      const pendingItems = localQueue.filter(item => item.status === 'pending');

      if (pendingItems.length === 0) {
        console.log('✅ No pending changes to sync');
        this.syncInProgress = false;
        return;
      }

      console.log(`🔄 Syncing ${pendingItems.length} changes...`);

      for (const item of pendingItems) {
        try {
          const data = JSON.parse(item.data);
          
          // Execute the operation
          switch (item.operation) {
            case 'create':
              await table.addItem(item.table_name, data);
              break;
            case 'update':
              await table.updateItem(item.table_name, data);
              break;
            case 'delete':
              await table.deleteItem(item.table_name, data);
              break;
          }

          // Mark as completed
          item.status = 'completed';
        } catch (error: any) {
          console.error(`Failed to sync item:`, error);
          item.status = 'failed';
          item.retry_count = (item.retry_count || 0) + 1;
          item.error_message = error.message || 'Unknown error';
        }
      }

      // Remove completed items, keep failed ones
      const updatedQueue = localQueue.filter(item => item.status !== 'completed');
      this.saveLocalQueue(updatedQueue);

      const failedCount = updatedQueue.filter(item => item.status === 'failed').length;
      
      if (failedCount > 0) {
        console.log(`⚠️ Sync completed with ${failedCount} failures`);
      } else {
        console.log('✅ Sync completed successfully');
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get sync status
  getSyncStatus(): { pending: number; failed: number; completed: number } {
    const queue = this.getLocalQueue();
    return {
      pending: queue.filter(item => item.status === 'pending').length,
      failed: queue.filter(item => item.status === 'failed').length,
      completed: queue.filter(item => item.status === 'completed').length,
    };
  }

  // Clear completed items
  clearCompleted(): void {
    const queue = this.getLocalQueue();
    const filtered = queue.filter(item => item.status !== 'completed');
    this.saveLocalQueue(filtered);
  }

  // Retry failed items
  async retryFailed(): Promise<void> {
    const queue = this.getLocalQueue();
    queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'pending';
      }
    });
    this.saveLocalQueue(queue);
    
    if (this.isOnline) {
      await this.syncPendingChanges();
    }
  }

  // Cache data for offline access
  cacheOfflineData(tableName: string, data: any[]): void {
    try {
      const cacheKey = `offline-cache-${tableName}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to cache ${tableName}:`, error);
    }
  }

  // Get cached data
  getCachedData(tableName: string): any[] {
    try {
      const cacheKey = `offline-cache-${tableName}`;
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(`Failed to get cached ${tableName}:`, error);
      return [];
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
