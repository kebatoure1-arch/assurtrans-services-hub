// Mobile Money Service — Orange Money, Wave, Free Money Integration
// Handles payment initiation, webhook callbacks, and status verification

import { table } from '@devvai/devv-code-backend';
import type {
  MobileMoneyOperator,
  MobileMoneyTransaction,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  WebhookCallbackPayload,
  TransactionStatusResponse
} from '../types/mobile-money.types';
import { OPERATOR_CONFIGS, validatePhoneNumber, getInternationalPhone } from '../types/mobile-money.types';
import { depositToWallet } from '@/features/fuel/services/wallet-service';
import { notificationService } from '@/features/notifications/services/notification-service';

// ⚠️ IMPORTANT: Using existing 'transactions' table (f4f186qchmgw) instead of non-existent 'payments' table
// This table already exists and is perfect for Mobile Money payment logging
const MOBILE_MONEY_TABLE_ID = 'f4f186qchmgw'; // Using transactions table (existing)
const TRANSACTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

// Get current user ID
function getCurrentUserId(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) throw new Error('User not authenticated');
  const parsed = JSON.parse(authStorage);
  return parsed.state?.user?.uid || '';
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `MM-${timestamp}-${random}`;
}

/**
 * Calculate expiration time (5 minutes from now)
 */
function calculateExpirationTime(): string {
  const expiresAt = new Date(Date.now() + TRANSACTION_TIMEOUT);
  return expiresAt.toISOString();
}

/**
 * Initiate Mobile Money payment
 * @param request - Payment request details
 * @returns Payment response with transaction details
 */
export async function initiateMobileMoneyPayment(
  request: InitiatePaymentRequest
): Promise<InitiatePaymentResponse> {
  const { operator, phoneNumber, amount, purpose, referenceId } = request;
  
  // 1. Validate inputs
  if (!validatePhoneNumber(phoneNumber, operator)) {
    throw new Error(`Numéro invalide pour ${OPERATOR_CONFIGS[operator].name}`);
  }
  
  const config = OPERATOR_CONFIGS[operator];
  if (amount < config.minAmount || amount > config.maxAmount) {
    throw new Error(
      `Montant doit être entre ${config.minAmount} et ${config.maxAmount} FCFA`
    );
  }
  
  const userId = getCurrentUserId();
  const transactionId = generateTransactionId();
  const now = new Date().toISOString();
  
  // 2. Create transaction record
  const transaction: Omit<MobileMoneyTransaction, 'id'> & { transaction_id: string } = {
    transaction_id: transactionId,
    operator,
    phoneNumber,
    amount,
    currency: 'XOF',
    status: 'pending',
    purpose,
    referenceId,
    userId,
    createdAt: now,
    updatedAt: now,
    expiresAt: calculateExpirationTime()
  };
  
  try {
    // 3. Save to database
    await table.addItem(MOBILE_MONEY_TABLE_ID, {
      _uid: userId,
      ...transaction,
      provider: operator, // For compatibility with existing schema
      phone_number: phoneNumber,
      reference_id: referenceId,
      created_at: now,
      updated_at: now
    });
    
    console.log(`✅ Mobile Money transaction created: ${transactionId}`);
    
    // 4. Call operator API (simulated for now)
    // In production, call actual operator API here
    await callOperatorAPI(operator, transaction);
    
    // 5. Send notification to user
    await notificationService.createNotification(userId, {
      type: 'info',
      category: 'payment',
      title: 'Paiement Mobile Money',
      message: `Composez ${config.ussdCode} pour confirmer votre paiement de ${amount.toLocaleString()} FCFA`,
      priority: 'high',
      metadata: { transactionId, operator, amount }
    });
    
    return {
      success: true,
      transaction: {
        id: transactionId,
        ...transaction
      },
      ussdCode: config.ussdCode,
      instructions: `Composez ${config.ussdCode} sur votre téléphone ${config.name} et suivez les instructions pour confirmer le paiement.`
    };
  } catch (error) {
    console.error('❌ Mobile Money initiation failed:', error);
    throw new Error('Échec de l\'initiation du paiement. Veuillez réessayer.');
  }
}

/**
 * Call operator API (simulated)
 * In production, this would call the actual operator API
 */
async function callOperatorAPI(
  operator: MobileMoneyOperator,
  transaction: Partial<MobileMoneyTransaction>
): Promise<void> {
  const config = OPERATOR_CONFIGS[operator];
  
  console.log(`📡 Calling ${config.name} API...`);
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`Transaction ID: ${(transaction as any).transaction_id || transaction.id}`);
  console.log(`Amount: ${transaction.amount} ${transaction.currency}`);
  console.log(`Phone: ${getInternationalPhone(transaction.phoneNumber!)}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // In production, replace with actual API call:
  /*
  const response = await fetch(`${config.apiUrl}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getOperatorAPIKey(operator)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transaction_id: transaction.transaction_id,
      phone_number: getInternationalPhone(transaction.phoneNumber!),
      amount: transaction.amount,
      currency: transaction.currency,
      callback_url: `${window.location.origin}/api/webhook/${operator}`,
      reference: transaction.referenceId
    })
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  */
  
  console.log(`✅ ${config.name} API call successful`);
}

/**
 * Process webhook callback from operator
 * @param payload - Webhook data from operator
 */
export async function processWebhookCallback(
  payload: WebhookCallbackPayload
): Promise<void> {
  const { transactionId, status, amount, operator } = payload;
  
  console.log(`📥 Webhook received: ${transactionId} - ${status}`);
  
  try {
    // 1. Verify webhook signature (security)
    if (!verifyWebhookSignature(payload)) {
      console.error('❌ Invalid webhook signature');
      throw new Error('Invalid webhook signature');
    }
    
    // 2. Find transaction
    const transaction = await getMobileMoneyTransaction(transactionId);
    if (!transaction) {
      console.error('❌ Transaction not found:', transactionId);
      throw new Error('Transaction not found');
    }
    
    // 3. Check if already processed (idempotence)
    if (transaction.status === 'success') {
      console.log('⚠️ Transaction already processed:', transactionId);
      return;
    }
    
    // 4. Update transaction status
    const now = new Date().toISOString();
    await updateTransactionStatus(transactionId, status, now);
    
    // 5. If successful, credit wallet
    if (status === 'success') {
      await depositToWallet(
        amount,
        `mobile_money_${operator}`,
        transactionId
      );
      
      console.log(`✅ Wallet credited: ${amount} FCFA`);
      
      // 6. Send success notification
      await notificationService.createNotification(transaction.userId, {
        type: 'success',
        category: 'payment',
        title: 'Paiement confirmé',
        message: `Votre compte a été crédité de ${amount.toLocaleString()} FCFA`,
        priority: 'high',
        metadata: { transactionId, operator, amount }
      });
    } else {
      // 7. Send failure notification
      await notificationService.createNotification(transaction.userId, {
        type: 'error',
        category: 'payment',
        title: 'Paiement échoué',
        message: `Le paiement de ${amount.toLocaleString()} FCFA a échoué. Veuillez réessayer.`,
        priority: 'high',
        metadata: { transactionId, operator, amount }
      });
    }
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    throw error;
  }
}

/**
 * Verify webhook signature (HMAC-SHA256)
 * In production, implement actual signature verification
 */
function verifyWebhookSignature(payload: WebhookCallbackPayload): boolean {
  // In production, verify HMAC-SHA256 signature:
  /*
  const secret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return payload.signature === expectedSignature;
  */
  
  // For development, always return true
  return true;
}

/**
 * Get Mobile Money transaction by ID
 */
export async function getMobileMoneyTransaction(
  transactionId: string
): Promise<MobileMoneyTransaction | null> {
  try {
    const result = await table.getItems(MOBILE_MONEY_TABLE_ID, {
      query: { transaction_id: transactionId }
    });
    
    if (!result.items || result.items.length === 0) {
      return null;
    }
    
    const item = result.items[0] as any;
    return {
      id: item.transaction_id,
      operator: item.operator || item.provider,
      phoneNumber: item.phoneNumber || item.phone_number,
      amount: item.amount,
      currency: item.currency || 'XOF',
      status: item.status,
      purpose: item.purpose,
      referenceId: item.referenceId || item.reference_id,
      userId: item.userId || item._uid,
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
      expiresAt: item.expiresAt || item.expires_at,
      confirmedAt: item.confirmedAt || item.confirmed_at,
      errorMessage: item.errorMessage || item.error_message,
      metadata: item.metadata ? JSON.parse(item.metadata) : undefined
    };
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      error.message.includes('project table') &&
      error.message.includes('not found')
    ) {
      console.log('ℹ️ Payments table not yet initialized - returning null gracefully');
    } else {
      console.warn('⚠️ Error fetching transaction (non-critical):', error?.message || error);
    }
    return null;
  }
}

/**
 * Update transaction status
 */
async function updateTransactionStatus(
  transactionId: string,
  status: 'success' | 'failed',
  timestamp: string
): Promise<void> {
  const transaction = await getMobileMoneyTransaction(transactionId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  await table.updateItem(MOBILE_MONEY_TABLE_ID, {
    _uid: transaction.userId,
    transaction_id: transactionId,
    status,
    updated_at: timestamp,
    confirmed_at: status === 'success' ? timestamp : undefined
  });
}

/**
 * Check transaction status (for polling)
 */
export async function checkTransactionStatus(
  transactionId: string
): Promise<TransactionStatusResponse> {
  const transaction = await getMobileMoneyTransaction(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  // Check if expired
  const now = Date.now();
  const expiresAt = new Date(transaction.expiresAt).getTime();
  const isExpired = now > expiresAt;
  
  if (isExpired && transaction.status === 'pending') {
    // Mark as timeout
    await updateTransactionStatus(transactionId, 'failed', new Date().toISOString());
    transaction.status = 'timeout';
    transaction.errorMessage = 'Transaction expired';
  }
  
  // Can retry if failed or timeout
  const canRetry = ['failed', 'timeout'].includes(transaction.status);
  
  return {
    transaction,
    canRetry
  };
}

/**
 * Retry failed transaction
 */
export async function retryTransaction(
  transactionId: string
): Promise<InitiatePaymentResponse> {
  const transaction = await getMobileMoneyTransaction(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (!['failed', 'timeout'].includes(transaction.status)) {
    throw new Error('Cannot retry transaction in current status');
  }
  
  // Create new transaction with same details
  return initiateMobileMoneyPayment({
    operator: transaction.operator,
    phoneNumber: transaction.phoneNumber,
    amount: transaction.amount,
    purpose: transaction.purpose,
    referenceId: transaction.referenceId
  });
}

/**
 * Simulate successful payment (for testing)
 * Remove in production
 */
export async function simulatePaymentSuccess(transactionId: string): Promise<void> {
  console.log('🧪 Simulating payment success for:', transactionId);
  
  const transaction = await getMobileMoneyTransaction(transactionId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  await processWebhookCallback({
    transactionId,
    status: 'success',
    amount: transaction.amount,
    operator: transaction.operator,
    phoneNumber: transaction.phoneNumber,
    timestamp: new Date().toISOString(),
    signature: 'test-signature'
  });
}

/**
 * Get user's Mobile Money transaction history
 */
export async function getUserMobileMoneyTransactions(): Promise<MobileMoneyTransaction[]> {
  try {
    const userId = getCurrentUserId();
    const result = await table.getItems(MOBILE_MONEY_TABLE_ID, {
      query: { _uid: userId }
    });
    
    if (!result.items) return [];
    
    return result.items.map((item: any) => ({
      id: item.transaction_id,
      operator: item.operator || item.provider,
      phoneNumber: item.phoneNumber || item.phone_number,
      amount: item.amount,
      currency: item.currency || 'XOF',
      status: item.status,
      purpose: item.purpose,
      referenceId: item.referenceId || item.reference_id,
      userId: item.userId || item._uid,
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
      expiresAt: item.expiresAt || item.expires_at,
      confirmedAt: item.confirmedAt || item.confirmed_at,
      errorMessage: item.errorMessage || item.error_message,
      metadata: item.metadata ? JSON.parse(item.metadata) : undefined
    })) as MobileMoneyTransaction[];
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      error.message.includes('project table') &&
      error.message.includes('not found')
    ) {
      console.log('ℹ️ Payments table not yet initialized - returning empty array gracefully');
    } else {
      console.warn('⚠️ Error fetching user transactions (non-critical):', error?.message || error);
    }
    return [];
  }
}

/**
 * Get transaction statistics
 */
export async function getTransactionStats() {
  const transactions = await getUserMobileMoneyTransactions();
  
  return {
    total: transactions.length,
    success: transactions.filter(t => t.status === 'success').length,
    pending: transactions.filter(t => t.status === 'pending').length,
    failed: transactions.filter(t => t.status === 'failed').length,
    totalAmount: transactions
      .filter(t => t.status === 'success')
      .reduce((sum, t) => sum + t.amount, 0),
    byOperator: {
      orange: transactions.filter(t => t.operator === 'orange').length,
      wave: transactions.filter(t => t.operator === 'wave').length,
      free: transactions.filter(t => t.operator === 'free').length
    }
  };
}
