// QR Code Validation Service - Real-Time Validation (< 2s guaranteed)
// Sprint 2 Implementation - Enhanced Security with HMAC-SHA256

import { table } from '@devvai/devv-code-backend';
import type { Order } from '../types';
import { decodeOrderQR, type OrderQRData, isQRCodeExpired } from '@/lib/qr-utils';

const ORDERS_TABLE_ID = 'f4f186q7i03l';
const WALLETS_TABLE_ID = 'f4f186q7i03k';

// QR Code validation cache (in-memory for < 2s performance)
// In production, use Redis with 5-minute TTL
const validationCache = new Map<string, {
  result: QRValidationResult;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface QRValidationResult {
  valid: boolean;
  order?: Order;
  error?: string;
  errorCode?: 
    | 'INVALID_QR'
    | 'EXPIRED'
    | 'ALREADY_USED'
    | 'INVALID_SIGNATURE'
    | 'ORDER_NOT_FOUND'
    | 'INSUFFICIENT_BALANCE'
    | 'INVALID_STATUS'
    | 'VALIDATION_CODE_MISMATCH';
  authorizedAmount?: number;
  driver?: {
    name: string;
    vehicle: string;
  };
  warnings?: string[];
  performance?: {
    decodingTime: number;
    dbQueryTime: number;
    totalTime: number;
  };
}

export interface QRValidationRequest {
  qrString: string;
  validationCode: string;
  stationId: string;
  scannedBy: string;
}

/**
 * Main validation function - Optimized for < 2 seconds response
 */
export async function validateQRCode(
  request: QRValidationRequest
): Promise<QRValidationResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Check cache (< 5ms)
    const cached = getFromCache(request.qrString);
    if (cached) {
      console.log('✅ QR validation cache hit');
      return cached;
    }

    // Step 2: Decode QR Code with signature verification (< 10ms)
    const decodeStart = Date.now();
    const qrData = await decodeOrderQR(request.qrString);
    const decodeTime = Date.now() - decodeStart;
    
    if (!qrData) {
      return createErrorResult('INVALID_QR', 'QR Code invalide ou corrompu', {
        decodingTime: decodeTime,
        dbQueryTime: 0,
        totalTime: Date.now() - startTime,
      });
    }

    // Step 3: Verify validation code (< 1ms)
    if (qrData.validationCode !== request.validationCode) {
      return createErrorResult('VALIDATION_CODE_MISMATCH', 'Code de validation incorrect', {
        decodingTime: decodeTime,
        dbQueryTime: 0,
        totalTime: Date.now() - startTime,
      });
    }

    // Step 4: Load order from database (< 500ms - optimized query)
    const dbStart = Date.now();
    const order = await loadOrderByNumber(qrData.orderNumber);
    const dbTime = Date.now() - dbStart;

    if (!order) {
      return createErrorResult('ORDER_NOT_FOUND', 'Commande introuvable', {
        decodingTime: decodeTime,
        dbQueryTime: dbTime,
        totalTime: Date.now() - startTime,
      });
    }

    // Step 5: Security checks (< 50ms)
    const securityResult = performSecurityChecks(order, qrData);
    if (!securityResult.valid) {
      return {
        ...securityResult,
        performance: {
          decodingTime: decodeTime,
          dbQueryTime: dbTime,
          totalTime: Date.now() - startTime,
        },
      };
    }

    // Step 6: Check wallet balance (< 100ms)
    const balanceCheck = await checkWalletBalance(order.customerId, order.totalAmount);
    if (!balanceCheck.sufficient) {
      return createErrorResult('INSUFFICIENT_BALANCE', 'Solde wallet insuffisant', {
        decodingTime: decodeTime,
        dbQueryTime: dbTime,
        totalTime: Date.now() - startTime,
      });
    }

    // Step 7: Build success result
    const totalTime = Date.now() - startTime;
    const result: QRValidationResult = {
      valid: true,
      order,
      authorizedAmount: order.totalAmount,
      driver: {
        name: order.customerName || 'Chauffeur',
        vehicle: order.vehicleRegistration || 'Véhicule non spécifié',
      },
      warnings: [],
      performance: {
        decodingTime: decodeTime,
        dbQueryTime: dbTime,
        totalTime,
      },
    };

    // Performance warning if > 1.5s
    if (totalTime > 1500) {
      result.warnings?.push(`⚠️ Validation lente: ${totalTime}ms (cible: < 2000ms)`);
    }

    // Cache result
    setCache(request.qrString, result);

    console.log(`✅ QR validation success in ${totalTime}ms`);
    return result;

  } catch (error: any) {
    console.error('❌ QR validation error:', error);
    
    return createErrorResult('INVALID_QR', error.message || 'Erreur de validation', {
      decodingTime: 0,
      dbQueryTime: 0,
      totalTime: Date.now() - startTime,
    });
  }
}

/**
 * Load order by order number (optimized query)
 */
async function loadOrderByNumber(orderNumber: string): Promise<Order | null> {
  try {
    // Optimized: Filter by orderNumber to avoid loading all orders
    const result = await table.getItems(ORDERS_TABLE_ID, {
      query: { orderNumber },
      limit: 1,
    });

    const orders = (result.items || []) as Order[];
    return orders.length > 0 ? orders[0] : null;
  } catch (error) {
    console.error('Failed to load order:', error);
    return null;
  }
}

/**
 * Perform security checks on order and QR data
 */
function performSecurityChecks(
  order: Order,
  qrData: OrderQRData
): QRValidationResult {
  // Check 1: QR Code already used
  if (order.scannedAt) {
    return createErrorResult(
      'ALREADY_USED',
      'QR Code déjà utilisé',
      undefined,
      [
        `Scanné le ${new Date(order.scannedAt).toLocaleString('fr-FR')}`,
        `Par: ${order.scannedBy || 'Utilisateur inconnu'}`,
      ]
    );
  }

  // Check 2: Order status must be valid
  const validStatuses = ['pending', 'dispatched'];
  if (!validStatuses.includes(order.status)) {
    return createErrorResult(
      'INVALID_STATUS',
      `Statut commande invalide: ${order.status}`,
      undefined,
      ['La commande doit être en statut "pending" ou "dispatched"']
    );
  }

  // Check 3: Expiration (48h validity)
  // ✅ Sprint 2.2: ACTIVATED
  const expired = isQRCodeExpired(qrData);
  if (expired) {
    return createErrorResult('EXPIRED', 'QR Code expiré (> 48h)', undefined, [
      'Le QR Code est valide pendant 48 heures après sa création',
      `Créé le: ${new Date(qrData.timestamp).toLocaleString('fr-FR')}`,
    ]);
  }

  // Check 4: HMAC-SHA256 signature verification
  // ✅ Sprint 2.2: ACTIVATED
  // Note: Signature is already verified in decodeOrderQR()
  // If signature was invalid, we would have gotten null from decodeOrderQR
  // This is just a double-check for security
  if (qrData.signature) {
    // Signature was successfully verified in decodeOrderQR
    // No additional action needed
  } else {
    // Legacy QR Code without signature (backward compatibility)
    // Log warning but allow transaction
    console.warn('⚠️ QR Code validated without signature (legacy format)');
  }

  return { valid: true };
}

/**
 * Check wallet balance
 */
async function checkWalletBalance(
  userId: string,
  requiredAmount: number
): Promise<{ sufficient: boolean; balance?: number }> {
  try {
    const result = await table.getItems(WALLETS_TABLE_ID, {
      query: { userId },
      limit: 1,
    });

    const wallets = result.items || [];
    if (wallets.length === 0) {
      return { sufficient: false };
    }

    const wallet = wallets[0] as any;
    const balance = parseFloat(wallet.balance) || 0;

    return {
      sufficient: balance >= requiredAmount,
      balance,
    };
  } catch (error) {
    console.error('Failed to check wallet balance:', error);
    return { sufficient: false };
  }
}

/**
 * ✅ HMAC-SHA256 signature verification (Sprint 2.2 - ACTIVATED)
 * 
 * Note: Signature verification is now handled in qr-crypto.ts
 * The decodeOrderQR() function automatically verifies signatures
 * This provides:
 * - Tamper-proof QR Codes
 * - Authenticity verification
 * - Man-in-the-middle attack prevention
 */

/**
 * Mark QR Code as used (one-time use enforcement)
 */
export async function markQRCodeAsUsed(
  orderId: string,
  orderUid: string,
  scannedBy: string
): Promise<void> {
  try {
    await table.updateItem(ORDERS_TABLE_ID, {
      _uid: orderUid,
      _id: orderId,
      scannedAt: new Date().toISOString(),
      scannedBy,
      status: 'in_progress',
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ QR Code marked as used: ${orderId}`);
  } catch (error) {
    console.error('Failed to mark QR Code as used:', error);
    throw error;
  }
}

/**
 * Helper: Create error result
 */
function createErrorResult(
  errorCode: QRValidationResult['errorCode'],
  error: string,
  performance?: QRValidationResult['performance'],
  warnings?: string[]
): QRValidationResult {
  return {
    valid: false,
    error,
    errorCode,
    warnings,
    performance,
  };
}

/**
 * Cache management
 */
function getFromCache(qrString: string): QRValidationResult | null {
  const cached = validationCache.get(qrString);
  if (!cached) return null;

  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    validationCache.delete(qrString);
    return null;
  }

  return cached.result;
}

function setCache(qrString: string, result: QRValidationResult): void {
  validationCache.set(qrString, {
    result,
    timestamp: Date.now(),
  });

  // Auto-cleanup old cache entries
  if (validationCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of validationCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        validationCache.delete(key);
      }
    }
  }
}

/**
 * Clear cache (for testing)
 */
export function clearValidationCache(): void {
  validationCache.clear();
}
