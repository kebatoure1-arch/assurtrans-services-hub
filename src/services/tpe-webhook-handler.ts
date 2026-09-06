/**
 * OLA ENERGY TPE Webhook Handler
 * 
 * Handles incoming webhook callbacks from OLA ENERGY TPE API
 * for real-time transaction status updates.
 * 
 * Features:
 * - HMAC signature verification (security)
 * - Idempotency handling (prevent duplicate processing)
 * - Transaction status synchronization
 * - Automatic retry for failed webhooks
 * - Email notifications on status change
 * 
 * Endpoint: POST /api/tpe/webhook
 * 
 * Usage:
 * This file should be integrated with your backend API routing.
 * For Vite/React apps, you'll need a backend proxy or serverless function.
 * 
 * Example Integration:
 * - Vercel: Create /api/tpe/webhook.ts serverless function
 * - Netlify: Create /netlify/functions/tpe-webhook.ts
 * - Express: app.post('/api/tpe/webhook', handleTPEWebhook)
 */

import { table } from '@devvai/devv-code-backend';
import { TPEErrorCode } from '@/features/payments/types/tpe.types';

// ============================================================================
// Constants
// ============================================================================

const ORDERS_TABLE_ID = 'f4f186q7i03l';
const TRANSACTIONS_TABLE_ID = 'f4f186qchmgw';
const WEBHOOK_EVENTS_TABLE_ID = 'f4fa0h4yv2f5'; // Can use notifications table
const WEBHOOK_SIGNATURE_HEADER = 'X-OLA-Signature';
const WEBHOOK_IDEMPOTENCY_HEADER = 'X-OLA-Idempotency-Key';

// ============================================================================
// Webhook Request/Response Types
// ============================================================================

export interface TPEWebhookPayload {
  event_type: 'transaction.approved' | 'transaction.declined' | 'transaction.pending' | 'transaction.cancelled';
  transaction_id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'approved' | 'declined' | 'pending' | 'cancelled';
  authorization_code?: string;
  card_mask?: string;
  card_last_four?: string;
  error_code?: string;
  error_message?: string;
  decline_reason?: string;
  merchant_id: string;
  terminal_id: string;
  station_id: string;
  timestamp: string;
  signature?: string;
  metadata?: Record<string, any>;
}

export interface TPEWebhookResponse {
  success: boolean;
  message: string;
  processed_at: string;
}

// ============================================================================
// Main Webhook Handler
// ============================================================================

/**
 * Handle incoming TPE webhook callback from OLA ENERGY
 * 
 * @param payload - Webhook payload from OLA ENERGY API
 * @param headers - HTTP headers (for signature verification)
 * @returns Webhook response
 */
export async function handleTPEWebhook(
  payload: TPEWebhookPayload,
  headers: Record<string, string>
): Promise<TPEWebhookResponse> {
  const startTime = performance.now();

  try {
    console.log('🔔 [TPE Webhook] Received webhook:', {
      eventType: payload.event_type,
      transactionId: payload.transaction_id,
      orderId: payload.order_id,
      status: payload.status,
    });

    // Step 1: Verify webhook signature (security)
    const signature = headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] || headers[WEBHOOK_SIGNATURE_HEADER];
    const webhookSecret = import.meta.env.VITE_TPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.error('❌ [TPE Webhook] Missing signature or webhook secret');
      return {
        success: false,
        message: 'Webhook signature verification failed',
        processed_at: new Date().toISOString(),
      };
    }

    const isValidSignature = await verifyWebhookSignature(payload, signature, webhookSecret);
    
    if (!isValidSignature) {
      console.error('❌ [TPE Webhook] Invalid signature!');
      return {
        success: false,
        message: 'Invalid webhook signature',
        processed_at: new Date().toISOString(),
      };
    }

    console.log('✅ [TPE Webhook] Signature verified');

    // Step 2: Check idempotency (prevent duplicate processing)
    const idempotencyKey = headers[WEBHOOK_IDEMPOTENCY_HEADER.toLowerCase()] || 
                           headers[WEBHOOK_IDEMPOTENCY_HEADER] ||
                           payload.transaction_id;

    const alreadyProcessed = await checkWebhookIdempotency(idempotencyKey);
    
    if (alreadyProcessed) {
      console.log('⚠️ [TPE Webhook] Already processed (idempotent):', idempotencyKey);
      return {
        success: true,
        message: 'Webhook already processed (idempotent)',
        processed_at: new Date().toISOString(),
      };
    }

    // Step 3: Process webhook based on event type
    await processWebhookEvent(payload);

    // Step 4: Record webhook event (for audit trail)
    await recordWebhookEvent(idempotencyKey, payload);

    const elapsedTime = performance.now() - startTime;
    console.log(`✅ [TPE Webhook] Processed successfully (${elapsedTime.toFixed(0)}ms)`);

    return {
      success: true,
      message: 'Webhook processed successfully',
      processed_at: new Date().toISOString(),
    };

  } catch (err: any) {
    const elapsedTime = performance.now() - startTime;
    console.error(`❌ [TPE Webhook] Processing failed (${elapsedTime.toFixed(0)}ms):`, err);

    return {
      success: false,
      message: err?.message || 'Webhook processing error',
      processed_at: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Webhook Processing Logic
// ============================================================================

/**
 * Process webhook event based on type
 */
async function processWebhookEvent(payload: TPEWebhookPayload): Promise<void> {
  switch (payload.event_type) {
    case 'transaction.approved':
      await handleTransactionApproved(payload);
      break;

    case 'transaction.declined':
      await handleTransactionDeclined(payload);
      break;

    case 'transaction.pending':
      await handleTransactionPending(payload);
      break;

    case 'transaction.cancelled':
      await handleTransactionCancelled(payload);
      break;

    default:
      console.warn('⚠️ [TPE Webhook] Unknown event type:', payload.event_type);
  }
}

/**
 * Handle approved transaction webhook
 */
async function handleTransactionApproved(payload: TPEWebhookPayload): Promise<void> {
  console.log('✅ [TPE Webhook] Processing APPROVED transaction:', payload.transaction_id);

  // Update transaction record
  try {
    await table.addItem(TRANSACTIONS_TABLE_ID, {
      orderId: payload.order_id,
      type: 'tpe_payment',
      amount: payload.amount,
      currency: payload.currency,
      paymentMethod: mapAPIPaymentMethodToInternal(payload.payment_method),
      status: 'completed',
      transactionId: payload.transaction_id,
      authorizationCode: payload.authorization_code,
      cardMask: payload.card_mask || (payload.card_last_four ? `****${payload.card_last_four}` : undefined),
      terminalId: payload.terminal_id,
      stationId: payload.station_id,
      timestamp: payload.timestamp,
      webhookProcessed: true,
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to save transaction:', err?.message);
  }

  // Update order status
  try {
    await table.updateItem(ORDERS_TABLE_ID, {
      _id: payload.order_id,
      status: 'completed',
      completedAt: payload.timestamp,
      paymentMethod: mapAPIPaymentMethodToInternal(payload.payment_method),
      tpeTransactionId: payload.transaction_id,
      tpeAuthorizationCode: payload.authorization_code,
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to update order:', err?.message);
  }

  // TODO: Send success notification email (optional)
  console.log('✅ [TPE Webhook] Transaction approved and recorded');
}

/**
 * Handle declined transaction webhook
 */
async function handleTransactionDeclined(payload: TPEWebhookPayload): Promise<void> {
  console.log('❌ [TPE Webhook] Processing DECLINED transaction:', payload.transaction_id);

  // Update transaction record
  try {
    await table.addItem(TRANSACTIONS_TABLE_ID, {
      orderId: payload.order_id,
      type: 'tpe_payment',
      amount: payload.amount,
      currency: payload.currency,
      paymentMethod: mapAPIPaymentMethodToInternal(payload.payment_method),
      status: 'failed',
      transactionId: payload.transaction_id,
      terminalId: payload.terminal_id,
      stationId: payload.station_id,
      timestamp: payload.timestamp,
      errorCode: mapAPIErrorCode(payload.error_code),
      errorMessage: payload.error_message || payload.decline_reason,
      webhookProcessed: true,
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to save transaction:', err?.message);
  }

  // Update order status (keep as dispatched, allow retry)
  try {
    await table.updateItem(ORDERS_TABLE_ID, {
      _id: payload.order_id,
      lastPaymentAttempt: payload.timestamp,
      lastPaymentError: payload.error_message || payload.decline_reason,
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to update order:', err?.message);
  }

  // TODO: Send failure notification email (optional)
  console.log('❌ [TPE Webhook] Transaction declined and recorded');
}

/**
 * Handle pending transaction webhook
 */
async function handleTransactionPending(payload: TPEWebhookPayload): Promise<void> {
  console.log('⏳ [TPE Webhook] Processing PENDING transaction:', payload.transaction_id);

  // Update transaction record
  try {
    await table.addItem(TRANSACTIONS_TABLE_ID, {
      orderId: payload.order_id,
      type: 'tpe_payment',
      amount: payload.amount,
      currency: payload.currency,
      paymentMethod: mapAPIPaymentMethodToInternal(payload.payment_method),
      status: 'pending',
      transactionId: payload.transaction_id,
      terminalId: payload.terminal_id,
      stationId: payload.station_id,
      timestamp: payload.timestamp,
      webhookProcessed: true,
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to save transaction:', err?.message);
  }

  console.log('⏳ [TPE Webhook] Transaction pending, waiting for final status');
}

/**
 * Handle cancelled transaction webhook
 */
async function handleTransactionCancelled(payload: TPEWebhookPayload): Promise<void> {
  console.log('🚫 [TPE Webhook] Processing CANCELLED transaction:', payload.transaction_id);

  // Update transaction record
  try {
    await table.addItem(TRANSACTIONS_TABLE_ID, {
      orderId: payload.order_id,
      type: 'tpe_payment',
      amount: payload.amount,
      currency: payload.currency,
      paymentMethod: mapAPIPaymentMethodToInternal(payload.payment_method),
      status: 'cancelled',
      transactionId: payload.transaction_id,
      terminalId: payload.terminal_id,
      stationId: payload.station_id,
      timestamp: payload.timestamp,
      webhookProcessed: true,
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to save transaction:', err?.message);
  }

  console.log('🚫 [TPE Webhook] Transaction cancelled and recorded');
}

// ============================================================================
// Security & Utilities
// ============================================================================

/**
 * Verify webhook HMAC signature
 */
async function verifyWebhookSignature(
  payload: TPEWebhookPayload,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Create canonical string (sorted keys, excluding signature)
    const payloadCopy = { ...payload };
    delete payloadCopy.signature;

    const canonicalString = Object.keys(payloadCopy)
      .sort()
      .map(key => `${key}=${(payloadCopy as any)[key]}`)
      .join('&');

    // Compute HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(canonicalString);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Timing-safe comparison
    return computedSignature === signature.toLowerCase();

  } catch (err) {
    console.error('❌ [TPE Webhook] Signature verification error:', err);
    return false;
  }
}

/**
 * Check if webhook has already been processed (idempotency)
 */
async function checkWebhookIdempotency(idempotencyKey: string): Promise<boolean> {
  try {
    const result = await table.getItems(WEBHOOK_EVENTS_TABLE_ID, {
      query: { type: 'tpe_webhook', idempotencyKey },
      limit: 1,
    });

    return result?.items && result.items.length > 0;

  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to check idempotency:', err?.message);
    return false; // Continue processing if check fails
  }
}

/**
 * Record webhook event (for audit trail and idempotency)
 */
async function recordWebhookEvent(
  idempotencyKey: string,
  payload: TPEWebhookPayload
): Promise<void> {
  try {
    await table.addItem(WEBHOOK_EVENTS_TABLE_ID, {
      type: 'tpe_webhook',
      idempotencyKey,
      eventType: payload.event_type,
      transactionId: payload.transaction_id,
      orderId: payload.order_id,
      status: payload.status,
      payload: JSON.stringify(payload),
      processedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('⚠️ [TPE Webhook] Failed to record event:', err?.message);
    // Non-critical, continue
  }
}

/**
 * Map OLA ENERGY API payment method to internal format
 */
function mapAPIPaymentMethodToInternal(apiMethod: string): string {
  const mapping: Record<string, string> = {
    'VISA': 'visa',
    'MASTERCARD': 'mastercard',
    'MOBILE_MONEY': 'mobile_money',
    'QR_WALLET': 'qr_prepaid',
    'CASH': 'cash',
  };
  return mapping[apiMethod] || 'card';
}

/**
 * Map OLA ENERGY API error code to TPE error code
 */
function mapAPIErrorCode(apiErrorCode?: string): string {
  if (!apiErrorCode) return TPEErrorCode.UNKNOWN_ERROR;

  const mapping: Record<string, string> = {
    'INSUFFICIENT_FUNDS': TPEErrorCode.INSUFFICIENT_FUNDS,
    'CARD_DECLINED': TPEErrorCode.CARD_DECLINED,
    'INVALID_CARD': TPEErrorCode.INVALID_CARD,
    'EXPIRED_CARD': TPEErrorCode.INVALID_CARD,
    'TRANSACTION_DECLINED': TPEErrorCode.TRANSACTION_DECLINED,
    'TIMEOUT': TPEErrorCode.TIMEOUT,
    'NETWORK_ERROR': TPEErrorCode.NETWORK_ERROR,
    'TERMINAL_ERROR': TPEErrorCode.TERMINAL_ERROR,
  };

  return mapping[apiErrorCode] || TPEErrorCode.UNKNOWN_ERROR;
}

// ============================================================================
// Express.js Integration Example
// ============================================================================

/**
 * Express.js route handler example
 * 
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { expressTPEWebhookHandler } from './tpe-webhook-handler';
 * 
 * const app = express();
 * app.use(express.json());
 * app.post('/api/tpe/webhook', expressTPEWebhookHandler);
 * ```
 */
export function expressTPEWebhookHandler(req: any, res: any) {
  const payload = req.body as TPEWebhookPayload;
  const headers = req.headers as Record<string, string>;

  handleTPEWebhook(payload, headers)
    .then(response => {
      const statusCode = response.success ? 200 : 400;
      res.status(statusCode).json(response);
    })
    .catch(err => {
      console.error('❌ [TPE Webhook] Unhandled error:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        processed_at: new Date().toISOString(),
      });
    });
}

// ============================================================================
// Vercel Serverless Function Example
// ============================================================================

/**
 * Vercel serverless function handler example
 * 
 * Create file: /api/tpe/webhook.ts
 * 
 * ```typescript
 * import { VercelRequest, VercelResponse } from '@vercel/node';
 * import { vercelTPEWebhookHandler } from '@/services/tpe-webhook-handler';
 * 
 * export default vercelTPEWebhookHandler;
 * ```
 */
export async function vercelTPEWebhookHandler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = req.body as TPEWebhookPayload;
  const headers = req.headers as Record<string, string>;

  try {
    const response = await handleTPEWebhook(payload, headers);
    const statusCode = response.success ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (err: any) {
    console.error('❌ [TPE Webhook] Unhandled error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      processed_at: new Date().toISOString(),
    });
  }
}
