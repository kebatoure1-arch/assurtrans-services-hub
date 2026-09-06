/**
 * OLA ENERGY TPE Integration Types
 * 
 * Terminal de Paiement Électronique (TPE) types for card payment processing
 * at OLA ENERGY stations.
 */

// ============================================================================
// TPE Transaction Types
// ============================================================================

export type TPEStatus = 'idle' | 'scanning' | 'validating' | 'processing_payment' | 'success' | 'failed' | 'cancelled';

export type TPEPaymentMethod = 'visa' | 'mastercard' | 'mobile_money' | 'qr_prepaid' | 'cash';

export type TPETransactionType = 'fuel_purchase' | 'refund' | 'void';

// ============================================================================
// TPE Configuration
// ============================================================================

export interface TPEConfig {
  terminalId: string;              // Unique TPE terminal ID
  stationId: string;               // OLA ENERGY station ID
  merchantId: string;              // OLA ENERGY merchant ID
  apiKey?: string;                 // TPE API key (optional, configured in settings)
  apiUrl?: string;                 // TPE API endpoint (default: OLA ENERGY prod)
  timeout?: number;                // Transaction timeout in seconds (default: 120s)
  offlineMode?: boolean;           // Enable offline transaction queuing
}

// ============================================================================
// TPE Transaction Request/Response
// ============================================================================

export interface TPETransactionRequest {
  orderId: string;                 // Assur'Trans order ID
  amount: number;                  // Amount in XOF
  currency: string;                // Currency code (XOF)
  paymentMethod: TPEPaymentMethod; // Payment method
  terminalId: string;              // TPE terminal ID
  stationId: string;               // Station ID
  customerId?: string;             // Customer/Driver ID
  vehicleId?: string;              // Vehicle ID (optional)
  metadata?: Record<string, any>;  // Additional metadata
}

export interface TPETransactionResponse {
  success: boolean;
  transactionId: string;           // TPE transaction ID
  orderId: string;                 // Assur'Trans order ID
  amount: number;
  currency: string;
  paymentMethod: TPEPaymentMethod;
  status: TPEStatus;
  authorizationCode?: string;      // Bank authorization code
  cardMask?: string;               // Masked card number (e.g., "****1234")
  receiptNumber?: string;          // Receipt number
  timestamp: string;               // ISO 8601 timestamp
  errorCode?: string;              // Error code if failed
  errorMessage?: string;           // Error message if failed
}

// ============================================================================
// TPE Validation Request/Response
// ============================================================================

export interface TPEValidationRequest {
  qrCode: string;                  // QR Code content
  terminalId: string;              // TPE terminal ID
  stationId: string;               // Station ID
}

export interface TPEValidationResponse {
  valid: boolean;
  orderId: string;
  driverName: string;
  vehicleRegistration?: string;
  fuelType: string;
  quantity: number;
  amount: number;
  currency: string;
  walletBalance: number;           // Current wallet balance
  canProceed: boolean;             // Can proceed with transaction
  paymentRequired: boolean;        // Additional payment needed (wallet insufficient)
  paymentAmount?: number;          // Amount to pay by card (if wallet insufficient)
  reason?: string;                 // Reason if validation fails
}

// ============================================================================
// TPE Offline Transaction
// ============================================================================

export interface TPEOfflineTransaction {
  id: string;                      // Local ID
  request: TPETransactionRequest;
  timestamp: string;
  syncAttempts: number;
  lastSyncAttempt?: string;
  synced: boolean;
}

// ============================================================================
// TPE Receipt
// ============================================================================

export interface TPEReceipt {
  transactionId: string;
  orderId: string;
  stationName: string;
  stationAddress: string;
  terminalId: string;
  date: string;
  time: string;
  driverName: string;
  vehicleRegistration?: string;
  fuelType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  paymentMethod: TPEPaymentMethod;
  cardMask?: string;
  authorizationCode?: string;
  receiptNumber: string;
  loyaltyPointsEarned?: number;
}

// ============================================================================
// TPE Error Codes
// ============================================================================

export enum TPEErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'TPE_001',
  TIMEOUT = 'TPE_002',
  NETWORK_ERROR = 'TPE_003',

  // Validation errors
  INVALID_QR_CODE = 'TPE_101',
  ORDER_NOT_FOUND = 'TPE_102',
  ORDER_ALREADY_COMPLETED = 'TPE_103',
  ORDER_EXPIRED = 'TPE_104',
  ORDER_CANCELLED = 'TPE_105',

  // Payment errors
  INSUFFICIENT_FUNDS = 'TPE_201',
  CARD_DECLINED = 'TPE_202',
  INVALID_CARD = 'TPE_203',
  TRANSACTION_DECLINED = 'TPE_204',
  PAYMENT_CANCELLED = 'TPE_205',

  // System errors
  TERMINAL_ERROR = 'TPE_301',
  CONFIGURATION_ERROR = 'TPE_302',
  UNKNOWN_ERROR = 'TPE_999',
}

// ============================================================================
// TPE Event Types (for real-time updates)
// ============================================================================

export type TPEEventType = 
  | 'tpe_transaction_initiated'
  | 'tpe_transaction_processing'
  | 'tpe_transaction_success'
  | 'tpe_transaction_failed'
  | 'tpe_transaction_cancelled'
  | 'tpe_validation_success'
  | 'tpe_validation_failed';

export interface TPEEvent {
  type: TPEEventType;
  transactionId?: string;
  orderId?: string;
  status: TPEStatus;
  data?: any;
  timestamp: string;
}
