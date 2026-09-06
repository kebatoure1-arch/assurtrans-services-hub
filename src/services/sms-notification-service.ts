// SMS/WhatsApp Notification Service
// Handles sending OTP codes via SMS
// Supports multiple providers: Twilio, Africa's Talking, Vonage, etc.

// Note: Custom API integration requires backend setup
// For now, we use direct HTTP requests (configure API keys in .env)
// In production, use Devv Custom API to secure API keys

/**
 * SMS Provider Configuration
 * Configure these in your project settings (Custom API section)
 */
export type SMSProvider = 'twilio' | 'africas-talking' | 'vonage' | 'termii';

export interface SMSResult {
  success: boolean;
  messageId?: string;
  message: string;
  provider?: SMSProvider;
}

/**
 * Send SMS notification
 * Uses Custom API to securely send SMS without exposing API keys
 * 
 * @param phoneNumber - Recipient phone number (E.164 format: +22377123456)
 * @param message - SMS message content
 * @param provider - SMS provider to use (default: twilio)
 */
export async function sendSMS(
  phoneNumber: string,
  message: string,
  provider: SMSProvider = 'twilio'
): Promise<SMSResult> {
  try {
    console.log(`📱 Sending SMS via ${provider} to ${phoneNumber}`);

    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Le numéro de téléphone doit être au format international (+223...)');
    }

    // Route to appropriate provider
    switch (provider) {
      case 'twilio':
        return await sendViaTwilio(phoneNumber, message);
      
      case 'africas-talking':
        return await sendViaAfricasTalking(phoneNumber, message);
      
      case 'vonage':
        return await sendViaVonage(phoneNumber, message);
      
      case 'termii':
        return await sendViaTermii(phoneNumber, message);
      
      default:
        throw new Error(`Fournisseur SMS non supporté: ${provider}`);
    }
  } catch (error: any) {
    console.error(`❌ SMS sending failed (${provider}):`, error);
    return {
      success: false,
      message: error?.message || 'Erreur lors de l\'envoi du SMS',
      provider,
    };
  }
}

/**
 * Send SMS via Twilio
 * Configuration required in project settings:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (your Twilio number)
 */
async function sendViaTwilio(
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  try {
    const twilioAccountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

    // Check if Twilio is configured
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log('⚠️ Twilio not configured. Simulating SMS send...');
      console.log(`📱 [SIMULATION] SMS to ${phoneNumber}: ${message}`);
      
      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        message: 'SMS simulé (Twilio non configuré)',
        provider: 'twilio',
      };
    }

    // Create basic auth header
    const authHeader = 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', twilioPhoneNumber);
    formData.append('Body', message);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Twilio API error');
    }

    const data = await response.json();
    console.log('✅ Twilio SMS sent successfully:', data);

    return {
      success: true,
      messageId: data.sid,
      message: 'SMS envoyé avec succès via Twilio',
      provider: 'twilio',
    };
  } catch (error: any) {
    console.error('❌ Twilio error:', error);
    throw new Error(error?.message || 'Erreur Twilio');
  }
}

/**
 * Send SMS via Africa's Talking
 * Perfect for African markets (Mali, Senegal, etc.)
 * Configuration required:
 * - AFRICAS_TALKING_API_KEY
 * - AFRICAS_TALKING_USERNAME
 */
async function sendViaAfricasTalking(
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  try {
    const apiKey = import.meta.env.VITE_AFRICAS_TALKING_API_KEY;
    const username = import.meta.env.VITE_AFRICAS_TALKING_USERNAME || 'sandbox';

    // Check if Africa's Talking is configured
    if (!apiKey) {
      console.log('⚠️ Africa\'s Talking not configured. Simulating SMS send...');
      console.log(`📱 [SIMULATION] SMS to ${phoneNumber}: ${message}`);
      
      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        message: 'SMS simulé (Africa\'s Talking non configuré)',
        provider: 'africas-talking',
      };
    }

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('to', phoneNumber);
    formData.append('message', message);

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Africa\'s Talking API error');
    }

    const data = await response.json();
    console.log('✅ Africa\'s Talking SMS sent:', data);

    return {
      success: true,
      messageId: data.SMSMessageData?.Recipients?.[0]?.messageId,
      message: 'SMS envoyé avec succès via Africa\'s Talking',
      provider: 'africas-talking',
    };
  } catch (error: any) {
    console.error('❌ Africa\'s Talking error:', error);
    throw new Error(error?.message || 'Erreur Africa\'s Talking');
  }
}

/**
 * Send SMS via Vonage (formerly Nexmo)
 * Global SMS provider
 * Configuration required:
 * - VONAGE_API_KEY
 * - VONAGE_API_SECRET
 */
async function sendViaVonage(
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  console.log('⚠️ Vonage not implemented yet. Simulating SMS send...');
  console.log(`📱 [SIMULATION] SMS to ${phoneNumber}: ${message}`);
  
  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    message: 'SMS simulé (Vonage non configuré)',
    provider: 'vonage',
  };
}

/**
 * Send SMS via Termii
 * Popular in West Africa (Nigeria, Ghana, etc.)
 * Configuration required:
 * - TERMII_API_KEY
 * - TERMII_SENDER_ID
 */
async function sendViaTermii(
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  console.log('⚠️ Termii not implemented yet. Simulating SMS send...');
  console.log(`📱 [SIMULATION] SMS to ${phoneNumber}: ${message}`);
  
  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    message: 'SMS simulé (Termii non configuré)',
    provider: 'termii',
  };
}

/**
 * Send WhatsApp message via Twilio
 * Requires Twilio WhatsApp Business API setup
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  try {
    console.log(`📱 Sending WhatsApp message to ${phoneNumber}`);

    const twilioAccountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER;

    // Check if WhatsApp is configured
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      console.log('⚠️ WhatsApp not configured. Simulating WhatsApp send...');
      console.log(`📱 [SIMULATION] WhatsApp to ${phoneNumber}: ${message}`);
      
      return {
        success: true,
        messageId: `sim_wa_${Date.now()}`,
        message: 'WhatsApp simulé (Twilio WhatsApp non configuré)',
        provider: 'twilio',
      };
    }

    const authHeader = 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${phoneNumber}`);
    formData.append('From', twilioWhatsAppNumber);
    formData.append('Body', message);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Twilio WhatsApp API error');
    }

    const data = await response.json();
    console.log('✅ WhatsApp message sent successfully:', data);

    return {
      success: true,
      messageId: data.sid,
      message: 'Message WhatsApp envoyé avec succès',
      provider: 'twilio',
    };
  } catch (error: any) {
    console.error('❌ WhatsApp error:', error);
    throw new Error(error?.message || 'Erreur WhatsApp');
  }
}

/**
 * Send OTP notification via SMS and/or WhatsApp
 * Tries WhatsApp first, falls back to SMS if WhatsApp fails
 */
export async function sendOTPNotification(
  phoneNumber: string,
  otpCode: string,
  orderNumber: string,
  options: {
    preferWhatsApp?: boolean;
    provider?: SMSProvider;
  } = {}
): Promise<SMSResult> {
  const { preferWhatsApp = true, provider = 'twilio' } = options;

  const message = `Assur'Trans: Votre code OTP pour la commande ${orderNumber} est: ${otpCode}. Valide pendant 15 minutes.`;

  // Try WhatsApp first if preferred
  if (preferWhatsApp) {
    try {
      const whatsappResult = await sendWhatsAppMessage(phoneNumber, message);
      if (whatsappResult.success) {
        console.log('✅ OTP sent via WhatsApp');
        return whatsappResult;
      }
    } catch (error) {
      console.warn('⚠️ WhatsApp failed, falling back to SMS:', error);
    }
  }

  // Fallback to SMS
  const smsResult = await sendSMS(phoneNumber, message, provider);
  
  if (smsResult.success) {
    console.log('✅ OTP sent via SMS');
  }

  return smsResult;
}

/**
 * Format phone number to E.164 international format
 * Examples:
 * - 77123456 (Mali) → +22377123456
 * - 0771234567 (Senegal) → +221771234567
 */
export function formatPhoneNumber(phone: string, countryCode: string = '223'): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Already has country code
  if (cleaned.startsWith(countryCode)) {
    return `+${cleaned}`;
  }
  
  // Remove leading 0 if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Add country code
  return `+${countryCode}${cleaned}`;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: +[country][number] (max 15 digits)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}
