// Payment service - Mobile Money payment processing

import { table } from '@devvai/devv-code-backend';
import type { CreatePaymentInput, Payment } from '../types';

const PAYMENTS_TABLE_ID = 'f4eypl4z2zgw';
const PAYMENT_METHODS_TABLE_ID = 'f4eypl514yy8';

/**
 * Initiate a Mobile Money payment
 */
export async function initiatePayment(input: CreatePaymentInput): Promise<Payment> {
  const { amount, provider, phoneNumber, purpose, referenceId } = input;

  // Get current user ID from localStorage
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) {
    throw new Error('User not authenticated');
  }
  const { state } = JSON.parse(authStorage);
  const userId = state?.user?._id;
  if (!userId) {
    throw new Error('User ID not found');
  }

  // Validate phone number format
  if (!phoneNumber || phoneNumber.length < 9) {
    throw new Error('Invalid phone number');
  }

  // Generate transaction ID
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // Create payment record
  const payment: Omit<Payment, '_id'> = {
    _uid: userId,
    transaction_id: transactionId,
    amount,
    provider,
    phone_number: phoneNumber,
    status: 'pending',
    purpose,
    reference_id: referenceId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await table.addItem(PAYMENTS_TABLE_ID, payment);

  // In production, here you would call the actual Mobile Money API
  // For demo purposes, we'll simulate a successful payment after a delay
  
  // Simulate payment processing
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Update payment status to completed
  const updatedPayment: Partial<Payment> = {
    status: 'completed',
    updated_at: new Date().toISOString(),
  };

  await table.updateItem(PAYMENTS_TABLE_ID, {
    ...payment,
    ...updatedPayment,
  });

  return {
    _id: transactionId,
    ...payment,
    ...updatedPayment,
  } as Payment;
}

/**
 * Get user's payment history
 */
export async function getUserPayments(): Promise<Payment[]> {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) {
    throw new Error('User not authenticated');
  }
  const { state } = JSON.parse(authStorage);
  const userId = state?.user?._id;
  if (!userId) {
    throw new Error('User ID not found');
  }

  const result = await table.getItems(PAYMENTS_TABLE_ID, {
    query: {
      _uid: userId,
    },
    order: 'desc',
  });

  return (result.items || []) as Payment[];
}

/**
 * Get payment by transaction ID
 */
export async function getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) {
    throw new Error('User not authenticated');
  }
  const { state } = JSON.parse(authStorage);
  const userId = state?.user?._id;
  if (!userId) {
    throw new Error('User ID not found');
  }

  const result = await table.getItems(PAYMENTS_TABLE_ID, {
    query: {
      _uid: userId,
      transaction_id: transactionId,
    },
  });

  return (result.items?.[0] as Payment) || null;
}

/**
 * Get payment by reference ID (for order, policy, etc.)
 */
export async function getPaymentByReferenceId(referenceId: string): Promise<Payment | null> {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) {
    throw new Error('User not authenticated');
  }
  const { state } = JSON.parse(authStorage);
  const userId = state?.user?._id;
  if (!userId) {
    throw new Error('User ID not found');
  }

  const result = await table.getItems(PAYMENTS_TABLE_ID, {
    query: {
      _uid: userId,
      reference_id: referenceId,
    },
  });

  return (result.items?.[0] as Payment) || null;
}
