// Mobile Money Types — Orange Money, Wave, Free Money

export type MobileMoneyOperator = 'orange' | 'wave' | 'free';

export type MobileMoneyStatus = 
  | 'pending'      // Initial state, waiting for user confirmation
  | 'processing'   // User confirmed, payment being processed
  | 'success'      // Payment successful
  | 'failed'       // Payment failed
  | 'timeout';     // Payment timed out (no confirmation after 5 min)

export interface MobileMoneyTransaction {
  id: string;
  operator: MobileMoneyOperator;
  phoneNumber: string;
  amount: number;
  currency: 'XOF' | 'USD';
  status: MobileMoneyStatus;
  purpose: 'wallet_deposit' | 'order_payment' | 'insurance_premium';
  referenceId: string;  // DEP-xxx, ORD-xxx, POL-xxx
  userId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;    // 5 minutes from creation
  confirmedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface InitiatePaymentRequest {
  operator: MobileMoneyOperator;
  phoneNumber: string;
  amount: number;
  purpose: 'wallet_deposit' | 'order_payment' | 'insurance_premium';
  referenceId: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  transaction: MobileMoneyTransaction;
  ussdCode?: string;     // *144# pour Orange, etc.
  instructions?: string; // Instructions for user
}

export interface WebhookCallbackPayload {
  transactionId: string;
  status: 'success' | 'failed';
  amount: number;
  operator: MobileMoneyOperator;
  phoneNumber: string;
  timestamp: string;
  signature: string;     // HMAC-SHA256 signature
  metadata?: Record<string, any>;
}

export interface TransactionStatusResponse {
  transaction: MobileMoneyTransaction;
  canRetry: boolean;
}

export interface OperatorConfig {
  name: string;
  prefixes: string[];    // Phone number prefixes (70, 77, etc.)
  apiUrl: string;
  icon: string;
  color: string;
  ussdCode: string;      // Code USSD for payment
  supportedCurrencies: string[];
  minAmount: number;     // Minimum amount in XOF
  maxAmount: number;     // Maximum amount in XOF
  processingTime: string; // "Instantané" or "1-2 minutes"
}

export const OPERATOR_CONFIGS: Record<MobileMoneyOperator, OperatorConfig> = {
  orange: {
    name: 'Orange Money',
    prefixes: ['70', '75', '76', '77', '78', '79'],
    apiUrl: 'https://api.orange.com/orange-money-webpay/dev/v1',
    icon: '🍊',
    color: 'bg-orange-500',
    ussdCode: '*144#',
    supportedCurrencies: ['XOF', 'USD'],
    minAmount: 100,
    maxAmount: 5000000,
    processingTime: 'Instantané'
  },
  wave: {
    name: 'Wave',
    prefixes: ['71', '72', '73', '74'],
    apiUrl: 'https://api.wave.com/v1',
    icon: '🌊',
    color: 'bg-blue-500',
    ussdCode: '*155#',
    supportedCurrencies: ['XOF', 'USD'],
    minAmount: 100,
    maxAmount: 3000000,
    processingTime: 'Instantané'
  },
  free: {
    name: 'Free Money',
    prefixes: ['76', '78'], // Overlap with Orange
    apiUrl: 'https://api.freemoney.sn/v1',
    icon: '💰',
    color: 'bg-green-500',
    ussdCode: '*133#',
    supportedCurrencies: ['XOF'],
    minAmount: 500,
    maxAmount: 2000000,
    processingTime: '1-2 minutes'
  }
};

// Helper functions
export function detectOperatorFromPhone(phoneNumber: string): MobileMoneyOperator | null {
  const prefix = phoneNumber.substring(0, 2);
  
  for (const [operator, config] of Object.entries(OPERATOR_CONFIGS)) {
    if (config.prefixes.includes(prefix)) {
      return operator as MobileMoneyOperator;
    }
  }
  
  return null;
}

export function validatePhoneNumber(phoneNumber: string, operator?: MobileMoneyOperator): boolean {
  // Must be 9 digits
  if (!/^\d{9}$/.test(phoneNumber)) {
    return false;
  }
  
  // If operator specified, check prefix
  if (operator) {
    const config = OPERATOR_CONFIGS[operator];
    const prefix = phoneNumber.substring(0, 2);
    return config.prefixes.includes(prefix);
  }
  
  return true;
}

export function formatPhoneNumber(phoneNumber: string): string {
  // Remove non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Remove leading +221 if present
  const cleaned = digits.startsWith('221') ? digits.substring(3) : digits;
  
  // Format as XX XXX XX XX
  if (cleaned.length === 9) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7)}`;
  }
  
  return cleaned;
}

export function getInternationalPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  const cleaned = digits.startsWith('221') ? digits : `221${digits}`;
  return `+${cleaned}`;
}
