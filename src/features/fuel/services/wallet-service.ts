// Wallet Service - Prepaid Balance Management

import { table } from '@devvai/devv-code-backend';
import { Wallet, Transaction } from '../types';
import { notificationService } from '@/features/notifications/services/notification-service';

const WALLETS_TABLE_ID = 'f4f186q7i03k';
const TRANSACTIONS_TABLE_ID = 'f4f186qchmgw';

// Get current user ID from localStorage
function getCurrentUserId(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('User not authenticated');
  const parsed = JSON.parse(authStorage);
  return parsed.state?.user?.uid || '';
}

// Get or create wallet for user
export async function getUserWallet(userId?: string): Promise<Wallet | null> {
  try {
    const targetUserId = userId || getCurrentUserId();
    const result = await table.getItems(WALLETS_TABLE_ID, {
      query: { userId: targetUserId }
    });
    
    if (result.items && result.items.length > 0) {
      return result.items[0] as Wallet;
    }
    
    // Create wallet if doesn't exist
    const now = new Date().toISOString();
    await table.addItem(WALLETS_TABLE_ID, {
      userId: targetUserId,
      balance: 0,
      currency: 'XOF',
      status: 'active',
      dailyLimit: 500000,
      monthlyLimit: 10000000,
      createdAt: now,
      updatedAt: now
    });
    
    // Fetch the newly created wallet
    const newResult = await table.getItems(WALLETS_TABLE_ID, {
      query: { userId: targetUserId }
    });
    
    return newResult.items?.[0] as Wallet || null;
  } catch (error) {
    console.error('Error getting wallet:', error);
    throw error;
  }
}

// Get wallet balance
export async function getWalletBalance(userId?: string): Promise<number> {
  const wallet = await getUserWallet(userId);
  return wallet?.balance || 0;
}

// Add transaction
async function addTransaction(transactionData: {
  walletId: string;
  userId: string;
  type: Transaction['type'];
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string;
  referenceNumber?: string;
  paymentMethod?: Transaction['paymentMethod'];
  description: string;
  metadata?: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await table.addItem(TRANSACTIONS_TABLE_ID, {
      ...transactionData,
      status: 'completed',
      createdAt: now
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
}

// Deposit to wallet
export async function depositToWallet(
  amount: number, 
  paymentMethod: Transaction['paymentMethod'],
  referenceNumber?: string
): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const wallet = await getUserWallet(userId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;
    const now = new Date().toISOString();
    
    // Update wallet balance
    await table.updateItem(WALLETS_TABLE_ID, {
      _uid: wallet._uid,
      _id: wallet._id,
      balance: balanceAfter,
      lastTransactionAt: now,
      updatedAt: now
    });
    
    // Record transaction
    await addTransaction({
      walletId: wallet._id,
      userId,
      type: 'deposit',
      amount,
      balanceBefore,
      balanceAfter,
      paymentMethod,
      referenceNumber,
      description: `Dépôt via ${paymentMethod}`
    });
  } catch (error) {
    console.error('Error depositing to wallet:', error);
    throw error;
  }
}

// Deduct from wallet (for orders)
export async function deductFromWallet(
  amount: number, 
  orderId: string,
  description: string
): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const wallet = await getUserWallet(userId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const now = new Date().toISOString();
    
    // Update wallet balance
    await table.updateItem(WALLETS_TABLE_ID, {
      _uid: wallet._uid,
      _id: wallet._id,
      balance: balanceAfter,
      lastTransactionAt: now,
      updatedAt: now
    });
    
    // Record transaction
    await addTransaction({
      walletId: wallet._id,
      userId,
      type: 'order_payment',
      amount: -amount,
      balanceBefore,
      balanceAfter,
      orderId,
      description
    });
    
    // Check for low balance and send notification
    const LOW_BALANCE_THRESHOLD = 10000; // 10,000 FCFA
    if (balanceAfter < LOW_BALANCE_THRESHOLD && balanceBefore >= LOW_BALANCE_THRESHOLD) {
      try {
        await notificationService.notifyLowBalance(userId, balanceAfter);
      } catch (error) {
        console.error('Error sending low balance notification:', error);
      }
    }
  } catch (error) {
    console.error('Error deducting from wallet:', error);
    throw error;
  }
}

// Get wallet transactions
export async function getWalletTransactions(userId?: string): Promise<Transaction[]> {
  try {
    const targetUserId = userId || getCurrentUserId();
    const result = await table.getItems(TRANSACTIONS_TABLE_ID, {
      query: { userId: targetUserId }
    });
    
    // Sort by creation date descending
    const transactions = (result.items || []) as Transaction[];
    return transactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

// Refund to wallet
export async function refundToWallet(
  amount: number, 
  orderId: string,
  description: string
): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const wallet = await getUserWallet(userId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;
    const now = new Date().toISOString();
    
    // Update wallet balance
    await table.updateItem(WALLETS_TABLE_ID, {
      _uid: wallet._uid,
      _id: wallet._id,
      balance: balanceAfter,
      lastTransactionAt: now,
      updatedAt: now
    });
    
    // Record transaction
    await addTransaction({
      walletId: wallet._id,
      userId,
      type: 'refund',
      amount,
      balanceBefore,
      balanceAfter,
      orderId,
      description
    });
  } catch (error) {
    console.error('Error refunding to wallet:', error);
    throw error;
  }
}
