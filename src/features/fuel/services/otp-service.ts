// OTP Service - One-Time Password Fallback System
// Provides secure validation alternative when QR scanner is unavailable

import { table } from '@devvai/devv-code-backend';
import { notificationService } from '@/features/notifications/services/notification-service';

const OTP_TABLE_ID = 'f4f186q7i03l'; // Reusing orders table with otp fields
const OTP_LENGTH = 6; // 6-digit OTP
const OTP_EXPIRY_MINUTES = 15; // OTP valid for 15 minutes
const OTP_MAX_ATTEMPTS = 3; // Maximum verification attempts
const OTP_RESEND_COOLDOWN_SECONDS = 60; // 1 minute between resends

export interface OTPGenerationResult {
  success: boolean;
  otpCode: string;
  expiresAt: string;
  message: string;
}

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  orderId?: string;
  orderNumber?: string;
  remainingAttempts?: number;
}

export interface OTPStatus {
  exists: boolean;
  isExpired: boolean;
  attemptsRemaining: number;
  canResend: boolean;
  cooldownSeconds?: number;
}

/**
 * Generate a 6-digit OTP code
 */
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Calculate OTP expiry timestamp
 */
function calculateExpiryTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + OTP_EXPIRY_MINUTES);
  return now.toISOString();
}

/**
 * Check if OTP is expired
 */
function isOTPExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Check if cooldown period has passed for resending
 */
function canResendOTP(lastSentAt?: string): boolean {
  if (!lastSentAt) return true;
  
  const lastSent = new Date(lastSentAt);
  const now = new Date();
  const secondsPassed = (now.getTime() - lastSent.getTime()) / 1000;
  
  return secondsPassed >= OTP_RESEND_COOLDOWN_SECONDS;
}

/**
 * Get cooldown seconds remaining
 */
function getCooldownSeconds(lastSentAt?: string): number {
  if (!lastSentAt) return 0;
  
  const lastSent = new Date(lastSentAt);
  const now = new Date();
  const secondsPassed = (now.getTime() - lastSent.getTime()) / 1000;
  const remaining = OTP_RESEND_COOLDOWN_SECONDS - secondsPassed;
  
  return Math.max(0, Math.ceil(remaining));
}

/**
 * Generate OTP for an order
 * Automatically sends OTP via SMS/WhatsApp (if configured)
 */
export async function generateOTP(
  orderNumber: string,
  userPhone?: string
): Promise<OTPGenerationResult> {
  try {
    // Get order by order number
    const ordersResult = await table.getItems(OTP_TABLE_ID);
    const orders = (ordersResult.items || []) as any[];
    const order = orders.find(o => o.orderNumber === orderNumber);

    if (!order) {
      return {
        success: false,
        otpCode: '',
        expiresAt: '',
        message: 'Commande introuvable',
      };
    }

    // Check if order is in valid state for OTP
    if (order.status === 'completed') {
      return {
        success: false,
        otpCode: '',
        expiresAt: '',
        message: 'Cette commande est déjà terminée',
      };
    }

    if (order.status === 'cancelled') {
      return {
        success: false,
        otpCode: '',
        expiresAt: '',
        message: 'Cette commande a été annulée',
      };
    }

    // Check resend cooldown
    if (order.otpLastSentAt && !canResendOTP(order.otpLastSentAt)) {
      const cooldown = getCooldownSeconds(order.otpLastSentAt);
      return {
        success: false,
        otpCode: '',
        expiresAt: '',
        message: `Veuillez attendre ${cooldown}s avant de renvoyer l'OTP`,
      };
    }

    // Generate new OTP
    const otpCode = generateOTPCode();
    const expiresAt = calculateExpiryTime();
    const now = new Date().toISOString();

    // Update order with OTP details
    await table.updateItem(OTP_TABLE_ID, {
      _uid: order._uid,
      _id: order._id,
      otpCode,
      otpExpiresAt: expiresAt,
      otpAttempts: 0, // Reset attempts
      otpLastSentAt: now,
      otpGeneratedAt: now,
      updatedAt: now,
    });

    // Send OTP via SMS/WhatsApp (if phone number provided)
    if (userPhone) {
      try {
        await sendOTPNotification(userPhone, otpCode, orderNumber);
      } catch (error) {
        console.warn('⚠️ Failed to send OTP notification:', error);
        // Don't fail the OTP generation if notification fails
      }
    }

    console.log(`✅ OTP generated for order ${orderNumber}: ${otpCode} (expires: ${expiresAt})`);

    return {
      success: true,
      otpCode,
      expiresAt,
      message: userPhone 
        ? `OTP envoyé par SMS/WhatsApp au ***${userPhone.slice(-4)}` 
        : 'OTP généré avec succès',
    };
  } catch (error) {
    console.error('❌ Error generating OTP:', error);
    return {
      success: false,
      otpCode: '',
      expiresAt: '',
      message: 'Erreur lors de la génération de l\'OTP',
    };
  }
}

/**
 * Verify OTP code for an order
 */
export async function verifyOTP(
  orderNumber: string,
  otpCode: string
): Promise<OTPVerificationResult> {
  try {
    // Get order by order number
    const ordersResult = await table.getItems(OTP_TABLE_ID);
    const orders = (ordersResult.items || []) as any[];
    const order = orders.find(o => o.orderNumber === orderNumber);

    if (!order) {
      return {
        success: false,
        message: 'Commande introuvable',
      };
    }

    // Check if OTP exists
    if (!order.otpCode || !order.otpExpiresAt) {
      return {
        success: false,
        message: 'Aucun OTP généré pour cette commande',
      };
    }

    // Check if OTP is expired
    if (isOTPExpired(order.otpExpiresAt)) {
      return {
        success: false,
        message: 'L\'OTP a expiré. Veuillez en générer un nouveau.',
      };
    }

    // Check remaining attempts
    const attempts = order.otpAttempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return {
        success: false,
        message: 'Nombre maximum de tentatives atteint. Générez un nouvel OTP.',
        remainingAttempts: 0,
      };
    }

    // Verify OTP code
    if (order.otpCode !== otpCode) {
      // Increment attempts
      const newAttempts = attempts + 1;
      await table.updateItem(OTP_TABLE_ID, {
        _uid: order._uid,
        _id: order._id,
        otpAttempts: newAttempts,
        updatedAt: new Date().toISOString(),
      });

      const remaining = OTP_MAX_ATTEMPTS - newAttempts;
      return {
        success: false,
        message: `Code OTP incorrect. ${remaining} tentative(s) restante(s).`,
        remainingAttempts: remaining,
      };
    }

    // OTP is valid! Clear OTP data and mark as verified
    const now = new Date().toISOString();
    await table.updateItem(OTP_TABLE_ID, {
      _uid: order._uid,
      _id: order._id,
      otpVerifiedAt: now,
      otpCode: '', // Clear OTP for security
      otpExpiresAt: '',
      otpAttempts: 0,
      status: 'in_progress', // Move to in_progress after OTP verification
      updatedAt: now,
    });

    console.log(`✅ OTP verified successfully for order ${orderNumber}`);

    return {
      success: true,
      message: 'OTP vérifié avec succès',
      orderId: order._id,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    return {
      success: false,
      message: 'Erreur lors de la vérification de l\'OTP',
    };
  }
}

/**
 * Get OTP status for an order
 */
export async function getOTPStatus(orderNumber: string): Promise<OTPStatus> {
  try {
    const ordersResult = await table.getItems(OTP_TABLE_ID);
    const orders = (ordersResult.items || []) as any[];
    const order = orders.find(o => o.orderNumber === orderNumber);

    if (!order || !order.otpCode) {
      return {
        exists: false,
        isExpired: true,
        attemptsRemaining: OTP_MAX_ATTEMPTS,
        canResend: true,
      };
    }

    const isExpired = isOTPExpired(order.otpExpiresAt);
    const attempts = order.otpAttempts || 0;
    const canResend = canResendOTP(order.otpLastSentAt);
    const cooldown = getCooldownSeconds(order.otpLastSentAt);

    return {
      exists: true,
      isExpired,
      attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
      canResend,
      cooldownSeconds: canResend ? 0 : cooldown,
    };
  } catch (error) {
    console.error('❌ Error getting OTP status:', error);
    return {
      exists: false,
      isExpired: true,
      attemptsRemaining: 0,
      canResend: false,
    };
  }
}

/**
 * Send OTP notification via SMS/WhatsApp
 * Uses real SMS/WhatsApp service (Sprint 3+ implementation)
 */
async function sendOTPNotification(
  phoneNumber: string,
  otpCode: string,
  orderNumber: string
): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { sendOTPNotification: sendOTP, formatPhoneNumber } = await import('@/services/sms-notification-service');
  
  // Format phone number to E.164 (Mali by default: +223)
  const formattedPhone = phoneNumber.startsWith('+') 
    ? phoneNumber 
    : formatPhoneNumber(phoneNumber, '223');
  
  // Send OTP via SMS/WhatsApp
  // Tries WhatsApp first, falls back to SMS
  const result = await sendOTP(formattedPhone, otpCode, orderNumber, {
    preferWhatsApp: true,
    provider: 'twilio', // or 'africas-talking' for better African coverage
  });

  if (!result.success) {
    console.error('❌ Failed to send OTP notification:', result.message);
    // Don't throw error - we still want to allow manual OTP entry
    // But log the failure for monitoring
  } else {
    console.log(`✅ OTP sent successfully via ${result.provider}: ${result.messageId}`);
  }
}

/**
 * Invalidate OTP (for security or cancellation)
 */
export async function invalidateOTP(orderNumber: string): Promise<boolean> {
  try {
    const ordersResult = await table.getItems(OTP_TABLE_ID);
    const orders = (ordersResult.items || []) as any[];
    const order = orders.find(o => o.orderNumber === orderNumber);

    if (!order) {
      return false;
    }

    await table.updateItem(OTP_TABLE_ID, {
      _uid: order._uid,
      _id: order._id,
      otpCode: '',
      otpExpiresAt: '',
      otpAttempts: 0,
      updatedAt: new Date().toISOString(),
    });

    console.log(`🔒 OTP invalidated for order ${orderNumber}`);
    return true;
  } catch (error) {
    console.error('❌ Error invalidating OTP:', error);
    return false;
  }
}
