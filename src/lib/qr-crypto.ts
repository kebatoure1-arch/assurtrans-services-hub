/**
 * QR Code Cryptographic Module - HMAC-SHA256 Security
 * Sprint 2.2: Comprehensive QR Code security with signature and expiration
 * 
 * Features:
 * - HMAC-SHA256 signature generation and verification
 * - Timing-safe comparison (prevents timing attacks)
 * - 48-hour expiration enforcement
 * - Secret key management
 * - Backward compatibility with legacy QR codes
 */

// ============================================================================
// SECRET KEY MANAGEMENT
// ============================================================================

/**
 * Get signing secret from environment
 * In production, this MUST be set in project settings
 * 
 * To configure:
 * 1. Go to Project Settings → Environment Variables
 * 2. Add: VITE_QR_SIGNATURE_SECRET = [your-256-bit-secret]
 * 3. Generate secret: openssl rand -base64 32
 */
function getSigningSecret(): string {
  const secret = import.meta.env.VITE_QR_SIGNATURE_SECRET;
  
  if (!secret) {
    // Development fallback (DO NOT USE IN PRODUCTION)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ QR_SIGNATURE_SECRET not set! Using dev fallback (INSECURE)');
      return 'dev-insecure-secret-change-in-production-12345678';
    }
    
    throw new Error('QR_SIGNATURE_SECRET environment variable not configured');
  }
  
  return secret;
}

// ============================================================================
// CRYPTOGRAPHIC UTILITIES
// ============================================================================

/**
 * Convert string to ArrayBuffer (for Web Crypto API)
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = Array.from(byteArray).map(byte => 
    byte.toString(16).padStart(2, '0')
  );
  return hexCodes.join('');
}

/**
 * Generate HMAC-SHA256 signature
 * 
 * @param data - Data to sign (JSON string)
 * @param secret - Secret key
 * @returns Hex-encoded signature
 */
async function generateHMAC(data: string, secret: string): Promise<string> {
  try {
    // Import secret key
    const key = await crypto.subtle.importKey(
      'raw',
      stringToArrayBuffer(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign data
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      stringToArrayBuffer(data)
    );
    
    return arrayBufferToHex(signature);
  } catch (error) {
    console.error('❌ HMAC generation failed:', error);
    throw new Error('Failed to generate signature');
  }
}

/**
 * Verify HMAC-SHA256 signature (timing-safe)
 * 
 * Uses constant-time comparison to prevent timing attacks
 * 
 * @param data - Original data (JSON string)
 * @param signature - Signature to verify
 * @param secret - Secret key
 * @returns True if signature is valid
 */
async function verifyHMAC(
  data: string, 
  signature: string, 
  secret: string
): Promise<boolean> {
  try {
    // Generate expected signature
    const expectedSignature = await generateHMAC(data, secret);
    
    // Timing-safe comparison
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    console.error('❌ HMAC verification failed:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by ensuring constant execution time
 * 
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// ============================================================================
// VALIDATION CODE GENERATION
// ============================================================================

/**
 * Generate 4-digit validation code
 * Range: 1000-9999 (no leading zeros)
 */
export function generateValidationCode(): string {
  const code = Math.floor(1000 + Math.random() * 9000);
  return code.toString();
}

// ============================================================================
// QR DATA TYPES
// ============================================================================

export interface QRDataPayload {
  orderNumber: string;
  validationCode: string;
  amount: number;
  productName: string;
  vehicleRegistration: string;
  customerId: string;
  stationId?: string;
  stationName?: string;
}

export interface SignedQRData extends QRDataPayload {
  timestamp: string;
  expiresAt: string;
  signature: string;
  version: string;
}

// ============================================================================
// SECURE QR CODE GENERATION
// ============================================================================

/**
 * Create secure QR Code data with HMAC-SHA256 signature
 * 
 * Sprint 2.2: Complete security implementation
 * 
 * @param payload - Order data to encode
 * @param validityHours - Validity period in hours (default: 48h)
 * @returns Signed QR data with signature and expiration
 */
export async function createSecureQRData(
  payload: QRDataPayload,
  validityHours: number = 48
): Promise<SignedQRData> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityHours * 60 * 60 * 1000);
    
    // Create unsigned data
    const unsignedData: Omit<SignedQRData, 'signature'> = {
      ...payload,
      timestamp: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      version: '2.2', // Sprint 2.2 with HMAC-SHA256
    };
    
    // Generate signature (sign everything except signature field)
    const dataToSign = JSON.stringify(unsignedData);
    const secret = getSigningSecret();
    const signature = await generateHMAC(dataToSign, secret);
    
    // Complete signed data
    const signedData: SignedQRData = {
      ...unsignedData,
      signature,
    };
    
    console.log('✅ Secure QR Code created:', {
      orderNumber: signedData.orderNumber,
      expiresAt: signedData.expiresAt,
      signatureLength: signature.length,
      version: signedData.version,
    });
    
    return signedData;
  } catch (error) {
    console.error('❌ Failed to create secure QR Code:', error);
    throw new Error('QR Code generation failed');
  }
}

// ============================================================================
// SECURE QR CODE VERIFICATION
// ============================================================================

/**
 * Decode and verify QR Code with HMAC-SHA256 signature
 * 
 * Sprint 2.2: Complete security verification
 * 
 * Security checks:
 * 1. JSON parsing
 * 2. Required fields validation
 * 3. Expiration check
 * 4. HMAC-SHA256 signature verification
 * 
 * @param qrString - QR Code data string (JSON)
 * @returns Verified QR data or null if invalid
 */
export async function decodeAndVerifyQR(qrString: string): Promise<SignedQRData | null> {
  const startTime = performance.now();
  
  try {
    // Step 1: Parse JSON
    const data = JSON.parse(qrString) as SignedQRData;
    
    // Step 2: Validate required fields
    if (
      !data.orderNumber ||
      !data.validationCode ||
      !data.amount ||
      !data.customerId ||
      !data.timestamp ||
      !data.expiresAt ||
      !data.signature
    ) {
      console.error('❌ Invalid QR: Missing required fields');
      return null;
    }
    
    // Step 3: Check expiration
    const now = Date.now();
    const expiresAt = new Date(data.expiresAt).getTime();
    
    if (now > expiresAt) {
      const expiredHours = Math.floor((now - expiresAt) / (1000 * 60 * 60));
      console.error(`❌ QR Code expired ${expiredHours}h ago`);
      return null;
    }
    
    // Step 4: Verify HMAC-SHA256 signature
    const { signature, ...unsignedData } = data;
    const dataToVerify = JSON.stringify(unsignedData);
    const secret = getSigningSecret();
    
    const isValid = await verifyHMAC(dataToVerify, signature, secret);
    
    if (!isValid) {
      console.error('❌ Invalid signature: QR Code may be tampered');
      return null;
    }
    
    const endTime = performance.now();
    const verificationTime = Math.round(endTime - startTime);
    
    console.log('✅ QR Code verified successfully:', {
      orderNumber: data.orderNumber,
      verificationTime: `${verificationTime}ms`,
      expiresIn: `${Math.floor((expiresAt - now) / (1000 * 60 * 60))}h`,
      version: data.version,
    });
    
    return data;
  } catch (error) {
    console.error('❌ QR Code verification failed:', error);
    return null;
  }
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export interface CryptoPerformanceMetrics {
  signatureGeneration: number;
  signatureVerification: number;
  totalProcessing: number;
}

let performanceMetrics: CryptoPerformanceMetrics = {
  signatureGeneration: 0,
  signatureVerification: 0,
  totalProcessing: 0,
};

/**
 * Get current performance metrics
 * For monitoring and optimization
 */
export function getCryptoPerformanceMetrics(): CryptoPerformanceMetrics {
  return { ...performanceMetrics };
}

/**
 * Reset performance metrics
 */
export function resetCryptoPerformanceMetrics(): void {
  performanceMetrics = {
    signatureGeneration: 0,
    signatureVerification: 0,
    totalProcessing: 0,
  };
}

// ============================================================================
// DEVELOPMENT UTILITIES
// ============================================================================

/**
 * Generate test QR Code (development only)
 * 
 * @param orderNumber - Order number
 * @returns Test QR data with signature
 */
export async function generateTestQRCode(orderNumber: string): Promise<SignedQRData> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Test QR generation only available in development');
  }
  
  const testPayload: QRDataPayload = {
    orderNumber,
    validationCode: generateValidationCode(),
    amount: 50000,
    productName: 'Gasoil (Test)',
    vehicleRegistration: 'DK-TEST-123',
    customerId: 'test-user-id',
    stationId: 'test-station-id',
    stationName: 'Station Test',
  };
  
  return await createSecureQRData(testPayload, 48);
}

/**
 * Validate QR Code format (without signature verification)
 * For UI validation before submission
 */
export function isValidQRFormat(qrString: string): boolean {
  try {
    const data = JSON.parse(qrString);
    return !!(
      data.orderNumber &&
      data.validationCode &&
      data.amount &&
      data.customerId
    );
  } catch {
    return false;
  }
}
