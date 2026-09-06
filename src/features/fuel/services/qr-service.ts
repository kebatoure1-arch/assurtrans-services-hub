// QR Code Service - Generation and Validation for Fuel Orders

import QRCode from 'qrcode';
import { encodeOrderQR, decodeOrderQR, type OrderQRData } from '@/lib/qr-utils';
import type { Order } from '../types';

/**
 * Generate QR Code as base64 PNG image
 * 
 * Sprint 2.2: Now supports HMAC-SHA256 signature (async encoding)
 */
export async function generateQRCode(data: OrderQRData): Promise<string> {
  try {
    // Encode QR data with HMAC-SHA256 signature (async)
    const qrString = await encodeOrderQR(data);
    
    // Generate QR Code as base64 PNG
    const qrCodeDataURL = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Failed to generate QR Code:', error);
    throw new Error('Impossible de générer le QR Code');
  }
}

/**
 * Generate QR Code data from order
 */
export function createOrderQRData(order: Order): OrderQRData {
  return {
    orderNumber: order.orderNumber,
    validationCode: order.validationCode || '',
    amount: order.totalAmount,
    productName: order.productName,
    vehicleRegistration: order.vehicleRegistration,
    customerId: order.customerId,
    stationId: order.stationId,
    stationName: order.stationName,
    timestamp: order.createdAt,
  };
}

/**
 * Validate scanned QR Code
 * 
 * Sprint 2.2: Now verifies HMAC-SHA256 signature
 */
export async function validateScannedQR(
  qrString: string,
  expectedValidationCode?: string
): Promise<{ valid: boolean; data?: OrderQRData; error?: string }> {
  // Decode QR Code with signature verification
  const data = await decodeOrderQR(qrString);
  
  if (!data) {
    return {
      valid: false,
      error: 'QR Code invalide ou corrompu',
    };
  }
  
  // Check if validation code matches (if provided)
  if (expectedValidationCode && data.validationCode !== expectedValidationCode) {
    return {
      valid: false,
      error: 'Code de validation incorrect',
    };
  }
  
  return {
    valid: true,
    data,
  };
}

/**
 * Download QR Code as PNG file
 */
export function downloadQRCode(qrCodeDataURL: string, filename: string): void {
  try {
    const link = document.createElement('a');
    link.href = qrCodeDataURL;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to download QR Code:', error);
    throw new Error('Impossible de télécharger le QR Code');
  }
}

/**
 * Print QR Code
 */
export function printQRCode(qrCodeDataURL: string, orderData: OrderQRData): void {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Popup bloqué');
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${orderData.orderNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #789D9A;
              margin: 0 0 10px 0;
            }
            .qr-container {
              border: 2px solid #789D9A;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
            }
            .details {
              margin-top: 20px;
              text-align: center;
            }
            .details p {
              margin: 5px 0;
            }
            .code {
              font-size: 24px;
              font-weight: bold;
              color: #789D9A;
              margin: 15px 0;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Assur'Trans©</h1>
            <p>Commande de Carburant</p>
          </div>
          <div class="qr-container">
            <img src="${qrCodeDataURL}" alt="QR Code" style="width: 250px; height: 250px;" />
            <div class="details">
              <p><strong>N° Commande:</strong> ${orderData.orderNumber}</p>
              <p><strong>Produit:</strong> ${orderData.productName}</p>
              <p><strong>Véhicule:</strong> ${orderData.vehicleRegistration}</p>
              <p><strong>Montant:</strong> ${orderData.amount.toLocaleString('fr-FR')} FCFA</p>
              <div class="code">Code: ${orderData.validationCode}</div>
              ${orderData.stationName ? `<p><strong>Station:</strong> ${orderData.stationName}</p>` : ''}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  } catch (error) {
    console.error('Failed to print QR Code:', error);
    throw new Error('Impossible d\'imprimer le QR Code');
  }
}
