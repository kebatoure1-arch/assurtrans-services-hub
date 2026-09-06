// Payment type definitions

export type MobileMoneyProvider = 'mtn' | 'orange' | 'wave' | 'free';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';

export type PaymentPurpose = 'wallet_deposit' | 'order_payment' | 'insurance_premium';

export interface Payment {
  _id: string;
  _uid: string;
  transaction_id: string;
  amount: number;
  provider: MobileMoneyProvider;
  phone_number: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  reference_id: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  provider: MobileMoneyProvider;
  phone_number: string;
  is_default: boolean;
}

export interface CreatePaymentInput {
  amount: number;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  purpose: PaymentPurpose;
  referenceId: string;
}
