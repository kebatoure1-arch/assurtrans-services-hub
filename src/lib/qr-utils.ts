// QR Code Utilities for Assur'Trans©
// Encoding and decoding QR Code data with HMAC-SHA256 security

import { 
  createSecureQRData, 
  decodeAndVerifyQR, 
  type SignedQRData,
  generateValidationCode 
} from './qr-crypto';

export interface OrderQRData {
  orderNumber: string;
  validationCode: string;
  amount: number;
  productName: string;
  vehicleRegistration: string;
  customerId: string;
  stationId?: string;
  stationName?: string;
  timestamp: string;
  expiresAt?: string;
  signature?: string;
}

/**
 * Encode order data to SECURE QR Code string (with HMAC-SHA256)
 * 
 * Sprint 2.2: Now includes cryptographic signature
 */
export async function encodeOrderQR(data: OrderQRData): Promise<string> {
  try {
    // Create secure signed QR data
    const signedData = await createSecureQRData({
      orderNumber: data.orderNumber,
      validationCode: data.validationCode,
      amount: data.amount,
      productName: data.productName,
      vehicleRegistration: data.vehicleRegistration,
      customerId: data.customerId,
      stationId: data.stationId,
      stationName: data.stationName,
    }, 48); // 48 hours validity
    
    return JSON.stringify(signedData);
  } catch (error) {
    console.error('Failed to encode secure QR Code:', error);
    // Fallback to basic encoding (backward compatibility)
    return JSON.stringify(data);
  }
}

/**
 * Decode QR Code string to order data
 * 
 * Sprint 2.2: Now verifies HMAC-SHA256 signature
 */
export async function decodeOrderQR(qrString: string): Promise<OrderQRData | null> {
  try {
    // First, try to parse as JSON
    const data = JSON.parse(qrString);
    
    // Check if it has signature (new format)
    if (data.signature) {
      // Verify signature
      const verifiedData = await decodeAndVerifyQR(qrString);
      return verifiedData;
    }
    
    // Fallback to old format (no signature - for backward compatibility)
    if (
      !data.orderNumber ||
      !data.validationCode ||
      !data.amount ||
      !data.customerId
    ) {
      console.error('Invalid QR Code data: missing required fields');
      return null;
    }
    
    return data as OrderQRData;
  } catch (error) {
    console.error('Failed to decode QR Code:', error);
    return null;
  }
}

/**
 * LEGACY: Decode QR Code string synchronously (for backward compatibility)
 * 
 * Note: This does NOT verify signature. Use decodeOrderQR() instead.
 */
export function decodeOrderQRLegacy(qrString: string): OrderQRData | null {
  try {
    const data = JSON.parse(qrString);
    
    // Validate required fields
    if (
      !data.orderNumber ||
      !data.validationCode ||
      !data.amount ||
      !data.customerId
    ) {
      console.error('Invalid QR Code data: missing required fields');
      return null;
    }
    
    return data as OrderQRData;
  } catch (error) {
    console.error('Failed to decode QR Code:', error);
    return null;
  }
}

/**
 * Validate QR Code data structure
 */
export function validateQRData(data: OrderQRData): boolean {
  return !!(
    data.orderNumber &&
    data.validationCode &&
    data.amount > 0 &&
    data.customerId &&
    data.timestamp
  );
}

/**
 * Check if QR Code is expired (48h validity)
 */
export function isQRCodeExpired(data: OrderQRData): boolean {
  if (!data.expiresAt) {
    // If no expiration set, check timestamp (legacy format)
    if (data.timestamp) {
      const createdTime = new Date(data.timestamp).getTime();
      const expirationTime = createdTime + 48 * 60 * 60 * 1000; // 48 hours
      return Date.now() > expirationTime;
    }
    return false; // No timestamp, consider valid
  }
  
  const expirationTime = new Date(data.expiresAt).getTime();
  return Date.now() > expirationTime;
}

/**
 * Format QR data for display
 */
export function formatQRDataForDisplay(data: OrderQRData): {
  title: string;
  items: { label: string; value: string }[];
} {
  const items = [
    { label: 'Produit', value: data.productName },
    { label: 'Véhicule', value: data.vehicleRegistration },
    { label: 'Montant', value: `${data.amount.toLocaleString('fr-FR')} FCFA` },
    { label: 'Code validation', value: data.validationCode },
  ];
  
  if (data.stationName) {
    items.push({ label: 'Station', value: data.stationName });
  }
  
  items.push({
    label: 'Créé le',
    value: new Date(data.timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  });
  
  if (data.expiresAt) {
    const expiresDate = new Date(data.expiresAt);
    const isExpired = Date.now() > expiresDate.getTime();
    
    items.push({
      label: isExpired ? '❌ Expiré le' : '⏰ Expire le',
      value: expiresDate.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  }
  
  if (data.signature) {
    items.push({
      label: '🔐 Signature',
      value: `${data.signature.substring(0, 16)}...`,
    });
  }
  
  return {
    title: `Commande ${data.orderNumber}`,
    items,
  };
}

/**
 * Generate new validation code (4-digit)
 */
export function generateNewValidationCode(): string {
  return generateValidationCode();
}
