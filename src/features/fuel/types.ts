// Fuel and Service Types for Assur'Trans©

export type ProductType = 'fuel' | 'oil' | 'service';
export type FuelCategory = 'diesel' | 'gasoline' | 'premium';
export type OilCategory = 'engine' | 'transmission' | 'hydraulic';
export type ServiceCategory = 'washing' | 'oil_change' | 'maintenance';
export type ProductStatus = 'active' | 'inactive';

export interface Product {
  _id: string;
  _uid: string;
  productType: ProductType;
  name: string;
  category: string;
  unit: string;
  basePrice: number;
  description: string;
  isActive: ProductStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';

export interface Order {
  _id: string;
  _uid: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleRegistration: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: OrderStatus;
  stationId?: string;
  stationName?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  completedAt?: string;
  validationCode?: string;
  ticketUrl?: string;
  notes?: string;
  qrCode?: string;        // 🆕 QR Code as base64 PNG
  qrCodeData?: string;    // 🆕 JSON data encoded in QR
  scannedAt?: string;     // 🆕 Timestamp when QR was scanned
  scannedBy?: string;     // 🆕 UID of station that scanned
  createdAt: string;
  updatedAt: string;
}

export type WalletStatus = 'active' | 'suspended' | 'frozen';

export interface Wallet {
  _id: string;
  _uid: string;
  userId: string;
  balance: number;
  currency: string;
  status: WalletStatus;
  dailyLimit: number;
  monthlyLimit: number;
  createdAt: string;
  updatedAt: string;
  lastTransactionAt?: string;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'order_payment' | 'refund' | 'fee';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';
export type PaymentMethod = 'mobile_money_wave' | 'mobile_money_orange' | 'mobile_money_free' | 'bank_transfer' | 'cash';

export interface Transaction {
  _id: string;
  _uid: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string;
  referenceNumber?: string;
  paymentMethod?: PaymentMethod;
  status: TransactionStatus;
  description: string;
  metadata?: string;
  createdAt: string;
}

export type StationType = 'total' | 'shell' | 'oryx' | 'independant';
export type StationStatus = 'active' | 'inactive' | 'maintenance';

export interface Station {
  _id: string;
  _uid: string;
  stationName: string;
  petrolier_id: string;
  stationType: StationType;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  latitude?: string;
  longitude?: string;
  operatingHours: string;
  status: StationStatus;
  fuelCapacity: number;
  servicesOffered: string; // JSON string array
  createdAt: string;
  updatedAt: string;
}
