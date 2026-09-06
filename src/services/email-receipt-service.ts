/**
 * ========================================
 * 📧 Email Receipt Service
 * ========================================
 * 
 * Service d'envoi automatique de reçus par email après transaction
 * - Commandes de carburant (fuel orders)
 * - Transactions TPE (card payments)
 * 
 * Features:
 * - Génération automatique du PDF
 * - Envoi via Resend API
 * - Template HTML professionnel
 * - Pièce jointe PDF avec QR Code
 * - Fallback graceful si email échoue
 * 
 * Technologies:
 * - Devv Email SDK (Resend backend)
 * - receipt-pdf-service pour génération PDF
 * 
 * @module email-receipt-service
 */

import { email } from '@devvai/devv-code-backend';
import {
  generateFuelOrderReceiptPDF,
  generateTPETransactionReceiptPDF,
  type FuelOrderReceiptData,
  type TPETransactionReceiptData,
} from './receipt-pdf-service';

// ========================================
// Constants
// ========================================

/**
 * Sender email address (Assur'Trans official)
 */
const FROM_EMAIL = 'noreply@assurtrans.com';

/**
 * Company branding
 */
const COMPANY_NAME = 'Assur\'Trans©';
const COMPANY_TAGLINE = 'Votre partenaire carburant et assurance santé';

// ========================================
// Types
// ========================================

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

// ========================================
// HTML Email Templates
// ========================================

/**
 * Generate HTML email template for fuel order receipt
 */
function generateFuelOrderEmailHTML(data: FuelOrderReceiptData): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de Commande - ${data.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #789D9A 0%, #5a7876 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                ${COMPANY_NAME}
              </h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.95;">
                ${COMPANY_TAGLINE}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;">
                Bonjour ${data.driverName},
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Votre commande de carburant a été enregistrée avec succès. Vous trouverez ci-joint le reçu détaillé au format PDF.
              </p>
              
              <!-- Order Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8faf9; border: 2px solid #789D9A; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    
                    <h3 style="margin: 0 0 16px 0; color: #789D9A; font-size: 18px; font-weight: 600;">
                      Détails de la Commande
                    </h3>
                    
                    <table width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Numéro de commande:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.orderNumber}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Date:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${new Date(data.orderDate).toLocaleDateString('fr-FR', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Véhicule:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.vehicleRegistration}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Carburant:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.fuelType}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Quantité:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.quantity.toLocaleString()} L
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #ddd; padding-top: 12px; margin-top: 8px;"></td>
                      </tr>
                      <tr>
                        <td style="color: #789D9A; font-size: 16px; font-weight: 700; padding: 4px 0;">Montant Total:</td>
                        <td style="color: #789D9A; font-size: 18px; font-weight: 700; text-align: right; padding: 4px 0;">
                          ${data.totalAmount.toLocaleString()} XOF
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
              </table>
              
              <!-- Instructions -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                  <strong>Code de validation:</strong> <span style="font-size: 18px; font-weight: 700;">${data.validationCode}</span><br>
                  Présentez ce reçu et votre code de validation à la station-service.
                </p>
              </div>
              
              <!-- Call to Action -->
              <p style="margin: 0 0 12px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                Le reçu PDF complet est joint à cet email. Vous pouvez également le télécharger depuis votre espace client.
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 24px 30px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px 0; color: #666; font-size: 13px; line-height: 1.5; text-align: center;">
                Cet email a été envoyé automatiquement par ${COMPANY_NAME}.<br>
                Pour toute question, contactez-nous à support@assurtrans.com
              </p>
              <p style="margin: 8px 0 0 0; color: #999; font-size: 12px; text-align: center;">
                © 2025 ${COMPANY_NAME}. Tous droits réservés.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML email template for TPE transaction receipt
 */
function generateTPETransactionEmailHTML(data: TPETransactionReceiptData): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de Transaction - ${data.transactionId}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #789D9A 0%, #5a7876 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                ${COMPANY_NAME}
              </h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.95;">
                ${COMPANY_TAGLINE}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;">
                Transaction Réussie
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Votre paiement a été effectué avec succès. Vous trouverez ci-joint le reçu détaillé de votre transaction.
              </p>
              
              <!-- Transaction Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8faf9; border: 2px solid #789D9A; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    
                    <h3 style="margin: 0 0 16px 0; color: #789D9A; font-size: 18px; font-weight: 600;">
                      Détails de la Transaction
                    </h3>
                    
                    <table width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">ID Transaction:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.transactionId}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Date:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${new Date(data.transactionDate).toLocaleDateString('fr-FR', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Station:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.stationName || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Méthode de paiement:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          ${data.paymentMethod === 'card' ? 'Carte bancaire' : 
                            data.paymentMethod === 'mobile_money' ? 'Mobile Money' : 
                            'Portefeuille prépayé'}
                        </td>
                      </tr>
                      ${data.cardLastFour ? `
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 4px 0;">Numéro de carte:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">
                          **** **** **** ${data.cardLastFour}
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #ddd; padding-top: 12px; margin-top: 8px;"></td>
                      </tr>
                      <tr>
                        <td style="color: #789D9A; font-size: 16px; font-weight: 700; padding: 4px 0;">Montant Total:</td>
                        <td style="color: #789D9A; font-size: 18px; font-weight: 700; text-align: right; padding: 4px 0;">
                          ${data.totalAmount.toLocaleString()} XOF
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
              </table>
              
              <!-- Success Message -->
              <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.5;">
                  ✅ <strong>Paiement confirmé</strong><br>
                  Votre transaction a été traitée avec succès.
                </p>
              </div>
              
              <!-- Call to Action -->
              <p style="margin: 0 0 12px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                Le reçu PDF complet est joint à cet email. Conservez-le pour vos dossiers.
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 24px 30px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px 0; color: #666; font-size: 13px; line-height: 1.5; text-align: center;">
                Cet email a été envoyé automatiquement par ${COMPANY_NAME}.<br>
                Pour toute question, contactez-nous à support@assurtrans.com
              </p>
              <p style="margin: 8px 0 0 0; color: #999; font-size: 12px; text-align: center;">
                © 2025 ${COMPANY_NAME}. Tous droits réservés.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ========================================
// Public API Functions
// ========================================

/**
 * Send fuel order receipt by email
 * 
 * @param recipientEmail - User email address
 * @param receiptData - Fuel order receipt data
 * @returns Email send result with success status
 * 
 * @example
 * ```typescript
 * const result = await sendFuelOrderReceipt(
 *   'driver@example.com',
 *   {
 *     orderNumber: 'ORD-2025-001',
 *     orderDate: new Date(),
 *     driverName: 'Jean Dupont',
 *     vehicleRegistration: 'AA-1234-BB',
 *     fuelType: 'Gasoil',
 *     quantity: 50,
 *     unitPrice: 650,
 *     totalAmount: 32500,
 *     validationCode: '1234',
 *     qrCodeData: 'ORD-2025-001|1234|32500',
 *     paymentMethod: 'prepaid'
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log('Email sent:', result.emailId);
 * }
 * ```
 */
export async function sendFuelOrderReceipt(
  recipientEmail: string,
  receiptData: FuelOrderReceiptData
): Promise<EmailSendResult> {
  try {
    console.log('📧 Sending fuel order receipt email to:', recipientEmail);
    
    // 1. Generate PDF receipt
    const pdfBlob = await generateFuelOrderReceiptPDF(receiptData);
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = Array.from(new Uint8Array(pdfBuffer));
    
    // 2. Generate HTML email content
    const htmlContent = generateFuelOrderEmailHTML(receiptData);
    
    // 3. Generate filename
    const filename = `Recu_Commande_${receiptData.orderNumber}_${new Date().getTime()}.pdf`;
    
    // 4. Send email with attachment
    const response = await email.sendEmail({
      from: FROM_EMAIL,
      to: [recipientEmail],
      subject: `Reçu de Commande - ${receiptData.orderNumber}`,
      html: htmlContent,
      attachments: [
        {
          filename,
          content: pdfBytes,
          content_type: 'application/pdf',
        },
      ],
      tags: [
        { name: 'type', value: 'fuel_order_receipt' },
        { name: 'order_number', value: receiptData.orderNumber },
      ],
    });
    
    console.log('✅ Fuel order receipt email sent successfully:', response.id);
    
    return {
      success: true,
      emailId: response.id,
    };
    
  } catch (error) {
    console.error('❌ Failed to send fuel order receipt email:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send TPE transaction receipt by email
 * 
 * @param recipientEmail - User email address
 * @param receiptData - TPE transaction receipt data
 * @returns Email send result with success status
 * 
 * @example
 * ```typescript
 * const result = await sendTPETransactionReceipt(
 *   'driver@example.com',
 *   {
 *     transactionId: 'TPE-2025-001',
 *     transactionDate: new Date(),
 *     stationName: 'OLA ENERGY Dakar',
 *     stationAddress: '123 Avenue Blaise Diagne',
 *     terminalId: 'TPE-001',
 *     amount: 32500,
 *     paymentMethod: 'card',
 *     cardLast4: '4242',
 *     orderNumber: 'ORD-2025-001',
 *     validationCode: '1234'
 *   }
 * );
 * ```
 */
export async function sendTPETransactionReceipt(
  recipientEmail: string,
  receiptData: TPETransactionReceiptData
): Promise<EmailSendResult> {
  try {
    console.log('📧 Sending TPE transaction receipt email to:', recipientEmail);
    
    // 1. Generate PDF receipt
    const pdfBlob = await generateTPETransactionReceiptPDF(receiptData);
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = Array.from(new Uint8Array(pdfBuffer));
    
    // 2. Generate HTML email content
    const htmlContent = generateTPETransactionEmailHTML(receiptData);
    
    // 3. Generate filename
    const filename = `Recu_Transaction_${receiptData.transactionId}_${new Date().getTime()}.pdf`;
    
    // 4. Send email with attachment
    const response = await email.sendEmail({
      from: FROM_EMAIL,
      to: [recipientEmail],
      subject: `Reçu de Transaction - ${receiptData.transactionId}`,
      html: htmlContent,
      attachments: [
        {
          filename,
          content: pdfBytes,
          content_type: 'application/pdf',
        },
      ],
      tags: [
        { name: 'type', value: 'tpe_transaction_receipt' },
        { name: 'transaction_id', value: receiptData.transactionId },
      ],
    });
    
    console.log('✅ TPE transaction receipt email sent successfully:', response.id);
    
    return {
      success: true,
      emailId: response.id,
    };
    
  } catch (error) {
    console.error('❌ Failed to send TPE transaction receipt email:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send receipt email with explicit type parameter
 * 
 * @param recipientEmail - User email address
 * @param receiptData - Either fuel order or TPE transaction data
 * @param type - Type of receipt ('fuel_order' or 'tpe_transaction')
 * @returns Email send result with success status
 */
export async function sendReceiptEmail(
  recipientEmail: string,
  receiptData: FuelOrderReceiptData | TPETransactionReceiptData,
  type: 'fuel_order' | 'tpe_transaction'
): Promise<EmailSendResult> {
  if (type === 'fuel_order') {
    return sendFuelOrderReceipt(recipientEmail, receiptData as FuelOrderReceiptData);
  } else {
    return sendTPETransactionReceipt(recipientEmail, receiptData as TPETransactionReceiptData);
  }
}
