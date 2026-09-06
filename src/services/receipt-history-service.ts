/**
 * ========================================
 * 📜 Receipt History Service
 * ========================================
 * 
 * Service de gestion de l'historique des reçus
 * - Liste de tous les reçus (commandes + transactions TPE)
 * - Filtrage par date, type, statut
 * - Export CSV des transactions
 * - Téléchargement en masse des PDF
 * 
 * @module receipt-history-service
 */

import { table } from '@devvai/devv-code-backend';
import type { Order } from '@/features/fuel/types';

// ========================================
// Constants
// ========================================

const ORDERS_TABLE_ID = 'f4f186q7i03l';
const TRANSACTIONS_TABLE_ID = 'f4f186qchmgw';

// ========================================
// Types
// ========================================

/**
 * Receipt types
 */
export type ReceiptType = 'fuel_order' | 'tpe_transaction' | 'all';

/**
 * Receipt status
 */
export type ReceiptStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'all';

/**
 * Unified receipt item (combines orders and TPE transactions)
 */
export interface ReceiptItem {
  id: string;
  type: ReceiptType;
  date: Date;
  orderNumber?: string;
  transactionId?: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  customerName?: string;
  customerId?: string;
  vehicleRegistration?: string;
  stationName?: string;
  paymentMethod?: string;
  // Raw data for PDF generation
  rawData: any;
}

/**
 * Filter options for receipt history
 */
export interface ReceiptFilterOptions {
  type?: ReceiptType;
  status?: ReceiptStatus;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  searchQuery?: string;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Get current user ID from localStorage
 */
function getCurrentUserId(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('User not authenticated');
  const parsed = JSON.parse(authStorage);
  return parsed.state?.user?.uid || '';
}

/**
 * Check if user is admin
 */
function isUserAdmin(): boolean {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) return false;
  const parsed = JSON.parse(authStorage);
  const activeRole = parsed.state?.user?.activeRole;
  return activeRole === 'admin';
}

/**
 * Convert order to receipt item
 */
function orderToReceiptItem(order: any): ReceiptItem {
  return {
    id: order._id || '',
    type: 'fuel_order',
    date: new Date(order.createdAt),
    orderNumber: order.orderNumber,
    amount: order.totalAmount || 0,
    status: order.status as any,
    customerName: order.customerName,
    customerId: order.customerId,
    vehicleRegistration: order.vehicleRegistration,
    stationName: order.stationName,
    paymentMethod: order.paymentMethod || 'prepaid',
    rawData: order,
  };
}

/**
 * Convert TPE transaction to receipt item
 */
function transactionToReceiptItem(transaction: any): ReceiptItem {
  return {
    id: transaction._id || '',
    type: 'tpe_transaction',
    date: new Date(transaction.timestamp || transaction.createdAt),
    transactionId: transaction.transactionId,
    amount: transaction.amount || 0,
    status: transaction.status === 'completed' ? 'completed' : 
            transaction.status === 'failed' ? 'failed' : 'pending',
    customerId: transaction.customerId,
    stationName: transaction.stationName,
    paymentMethod: transaction.paymentMethod,
    rawData: transaction,
  };
}

/**
 * Apply filters to receipt items
 */
function applyFilters(items: ReceiptItem[], filters: ReceiptFilterOptions): ReceiptItem[] {
  let filtered = items;

  // Filter by type
  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter(item => item.type === filters.type);
  }

  // Filter by status
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(item => item.status === filters.status);
  }

  // Filter by date range
  if (filters.startDate) {
    filtered = filtered.filter(item => item.date >= filters.startDate!);
  }
  if (filters.endDate) {
    const endOfDay = new Date(filters.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    filtered = filtered.filter(item => item.date <= endOfDay);
  }

  // Filter by search query (order number, transaction ID, customer name)
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(item => {
      return (
        item.orderNumber?.toLowerCase().includes(query) ||
        item.transactionId?.toLowerCase().includes(query) ||
        item.customerName?.toLowerCase().includes(query) ||
        item.vehicleRegistration?.toLowerCase().includes(query)
      );
    });
  }

  return filtered;
}

// ========================================
// Public API Functions
// ========================================

/**
 * Get receipt history with filters
 * 
 * @param filters - Filter options
 * @returns Array of receipt items sorted by date (newest first)
 * 
 * @example
 * ```typescript
 * // Get all receipts for current user
 * const receipts = await getReceiptHistory({ type: 'all' });
 * 
 * // Get only completed fuel orders in December 2025
 * const receipts = await getReceiptHistory({
 *   type: 'fuel_order',
 *   status: 'completed',
 *   startDate: new Date('2025-12-01'),
 *   endDate: new Date('2025-12-31')
 * });
 * ```
 */
export async function getReceiptHistory(
  filters: ReceiptFilterOptions = {}
): Promise<ReceiptItem[]> {
  try {
    const userId = getCurrentUserId();
    const isAdmin = isUserAdmin();
    
    console.log('📜 Fetching receipt history with filters:', filters);

    const allItems: ReceiptItem[] = [];

    // 1. Fetch fuel orders (if type allows)
    if (!filters.type || filters.type === 'all' || filters.type === 'fuel_order') {
      try {
        const query = isAdmin ? {} : { customerId: filters.customerId || userId };
        
        const ordersResult = await table.getItems(ORDERS_TABLE_ID, { query });
        const orders = ordersResult?.items || [];
        
        const orderItems = orders.map(orderToReceiptItem);
        allItems.push(...orderItems);
        
        console.log(`📜 Loaded ${orderItems.length} fuel order receipts`);
      } catch (err) {
        console.warn('⚠️ Failed to load fuel orders:', err);
        // Continue - don't fail entirely if one source fails
      }
    }

    // 2. Fetch TPE transactions (if type allows)
    if (!filters.type || filters.type === 'all' || filters.type === 'tpe_transaction') {
      try {
        const query = { type: 'tpe_payment' };
        
        const transactionsResult = await table.getItems(TRANSACTIONS_TABLE_ID, { query });
        const transactions = transactionsResult?.items || [];
        
        const transactionItems = transactions
          .filter((t: any) => isAdmin || t.customerId === (filters.customerId || userId))
          .map(transactionToReceiptItem);
        
        allItems.push(...transactionItems);
        
        console.log(`📜 Loaded ${transactionItems.length} TPE transaction receipts`);
      } catch (err) {
        console.warn('⚠️ Failed to load TPE transactions:', err);
        // Continue - don't fail entirely if one source fails
      }
    }

    // 3. Apply filters
    const filteredItems = applyFilters(allItems, filters);

    // 4. Sort by date (newest first)
    filteredItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    console.log(`📜 Returning ${filteredItems.length} receipt items (after filters)`);

    return filteredItems;
  } catch (error) {
    console.error('❌ Error fetching receipt history:', error);
    throw error;
  }
}

/**
 * Export receipt history to CSV
 * 
 * @param filters - Filter options (same as getReceiptHistory)
 * @returns CSV string ready for download
 * 
 * @example
 * ```typescript
 * const csv = await exportReceiptHistoryToCSV({ type: 'all' });
 * const blob = new Blob([csv], { type: 'text/csv' });
 * const url = URL.createObjectURL(blob);
 * const link = document.createElement('a');
 * link.href = url;
 * link.download = 'receipts.csv';
 * link.click();
 * ```
 */
export async function exportReceiptHistoryToCSV(
  filters: ReceiptFilterOptions = {}
): Promise<string> {
  try {
    const items = await getReceiptHistory(filters);

    // CSV header
    const header = [
      'Date',
      'Type',
      'Numéro/ID',
      'Montant',
      'Statut',
      'Client',
      'Véhicule',
      'Station',
      'Méthode de paiement',
    ].join(',');

    // CSV rows
    const rows = items.map(item => {
      const date = item.date.toLocaleString('fr-FR');
      const type = item.type === 'fuel_order' ? 'Commande carburant' : 'Transaction TPE';
      const numberOrId = item.orderNumber || item.transactionId || '';
      const amount = `${item.amount} XOF`;
      const status = item.status === 'completed' ? 'Complétée' :
                     item.status === 'pending' ? 'En attente' :
                     item.status === 'failed' ? 'Échouée' : 'Annulée';
      const customer = item.customerName || '';
      const vehicle = item.vehicleRegistration || '';
      const station = item.stationName || '';
      const payment = item.paymentMethod || '';

      return [
        `"${date}"`,
        `"${type}"`,
        `"${numberOrId}"`,
        `"${amount}"`,
        `"${status}"`,
        `"${customer}"`,
        `"${vehicle}"`,
        `"${station}"`,
        `"${payment}"`,
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    console.log(`📜 Exported ${items.length} receipts to CSV`);

    return csv;
  } catch (error) {
    console.error('❌ Error exporting receipt history to CSV:', error);
    throw error;
  }
}

/**
 * Get receipt statistics (summary)
 * 
 * @param filters - Filter options
 * @returns Statistics object with counts and totals
 */
export async function getReceiptStatistics(
  filters: ReceiptFilterOptions = {}
): Promise<{
  totalReceipts: number;
  totalAmount: number;
  byType: { fuel_order: number; tpe_transaction: number };
  byStatus: { completed: number; pending: number; failed: number; cancelled: number };
}> {
  try {
    const items = await getReceiptHistory(filters);

    const stats = {
      totalReceipts: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      byType: {
        fuel_order: items.filter(i => i.type === 'fuel_order').length,
        tpe_transaction: items.filter(i => i.type === 'tpe_transaction').length,
      },
      byStatus: {
        completed: items.filter(i => i.status === 'completed').length,
        pending: items.filter(i => i.status === 'pending').length,
        failed: items.filter(i => i.status === 'failed').length,
        cancelled: items.filter(i => i.status === 'cancelled').length,
      },
    };

    console.log('📜 Receipt statistics:', stats);

    return stats;
  } catch (error) {
    console.error('❌ Error calculating receipt statistics:', error);
    throw error;
  }
}
