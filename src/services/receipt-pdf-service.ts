/**
 * ========================================
 * 🧾 PDF Receipt Generation Service
 * ========================================
 * 
 * Service de génération de reçus PDF professionnels pour :
 * - Commandes de carburant (fuel orders)
 * - Transactions TPE (card payments)
 * 
 * Features:
 * - QR Code intégré pour validation
 * - Branding Assur'Trans (logo, couleurs)
 * - Format imprimable optimisé (80mm thermal printer)
 * - Détails complets de transaction
 * - Timestamps et numéros de référence
 * 
 * Technologies:
 * - jsPDF pour génération PDF
 * - qrcode pour génération QR Code en base64
 * 
 * @module receipt-pdf-service
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

/**
 * Fuel Order Receipt Data
 */
export interface FuelOrderReceiptData {
  orderNumber: string;
  orderDate: Date;
  driverName: string;
  driverPhone?: string;
  vehicleRegistration: string;
  fuelType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  stationName?: string;
  stationAddress?: string;
  validationCode: string;
  qrCodeData: string;
  paymentMethod: 'prepaid' | 'tpe' | 'mixed';
  walletBalance?: number;
}

/**
 * TPE Transaction Receipt Data
 */
export interface TPETransactionReceiptData {
  transactionId: string;
  transactionDate: Date;
  terminalId: string;
  stationName: string;
  stationAddress?: string;
  orderNumber: string;
  driverName: string;
  vehicleRegistration: string;
  fuelType: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: 'card' | 'mobile_money';
  cardType?: 'visa' | 'mastercard';
  cardLastFour?: string;
  mobileMoneyOperator?: string;
  mobileMoneyNumber?: string;
  qrCodeData: string;
  authorizationCode?: string;
}

/**
 * Receipt PDF Options
 */
export interface ReceiptPDFOptions {
  format?: 'thermal' | 'a4'; // Format d'impression
  includeQRCode?: boolean; // Inclure le QR Code
  includeLogo?: boolean; // Inclure le logo Assur'Trans
  language?: 'fr' | 'en'; // Langue du reçu
}

// ========================================
// Constants
// ========================================

const COLORS = {
  primary: '#789D9A', // Sage Green
  secondary: '#D9744B', // Warm Earth
  accent: '#E6B31E', // Rich Gold
  text: '#1a1a1a',
  textLight: '#666666',
  border: '#e0e0e0'
};

const THERMAL_WIDTH = 80; // mm
const A4_WIDTH = 210; // mm

// ========================================
// Service Functions
// ========================================

/**
 * Generate QR Code as Base64 image
 */
async function generateQRCodeImage(data: string): Promise<string> {
  try {
    const qrDataURL = await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrDataURL;
  } catch (error) {
    console.error('❌ QR Code generation failed:', error);
    throw new Error('Failed to generate QR Code');
  }
}

/**
 * Format currency (XOF)
 */
function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} XOF`;
}

/**
 * Format date
 */
function formatDate(date: Date): string {
  return format(date, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
}

/**
 * Generate Fuel Order Receipt PDF
 * 
 * @param data - Fuel order receipt data
 * @param options - PDF generation options
 * @returns PDF blob
 */
export async function generateFuelOrderReceiptPDF(
  data: FuelOrderReceiptData,
  options: ReceiptPDFOptions = {}
): Promise<Blob> {
  const {
    format: pdfFormat = 'thermal',
    includeQRCode = true,
    includeLogo = true,
    language = 'fr'
  } = options;

  const width = pdfFormat === 'thermal' ? THERMAL_WIDTH : A4_WIDTH;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pdfFormat === 'thermal' ? [width, 297] : 'a4'
  });

  let yPos = 10; // Current Y position

  // ========================================
  // Header - Assur'Trans Branding
  // ========================================
  
  pdf.setFontSize(20);
  pdf.setTextColor(COLORS.primary);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Assur\'Trans©', width / 2, yPos, { align: 'center' });
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.textLight);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Plateforme de Carburant Prépayé', width / 2, yPos, { align: 'center' });
  yPos += 10;

  // Separator line
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Receipt Type
  // ========================================
  
  pdf.setFontSize(14);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REÇU DE COMMANDE CARBURANT', width / 2, yPos, { align: 'center' });
  yPos += 10;

  // ========================================
  // Order Information
  // ========================================
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const leftMargin = 10;
  const lineHeight = 6;

  // Order Number
  pdf.setFont('helvetica', 'bold');
  pdf.text('N° Commande:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.orderNumber, leftMargin + 30, yPos);
  yPos += lineHeight;

  // Order Date
  pdf.setFont('helvetica', 'bold');
  pdf.text('Date:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDate(data.orderDate), leftMargin + 30, yPos);
  yPos += lineHeight;

  // Validation Code
  pdf.setFont('helvetica', 'bold');
  pdf.text('Code Validation:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(14);
  pdf.setTextColor(COLORS.accent);
  pdf.text(data.validationCode, leftMargin + 30, yPos);
  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);
  yPos += lineHeight + 3;

  // Separator
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Driver & Vehicle Information
  // ========================================
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary);
  pdf.text('CHAUFFEUR & VÉHICULE', leftMargin, yPos);
  yPos += lineHeight + 2;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'normal');

  // Driver Name
  pdf.setFont('helvetica', 'bold');
  pdf.text('Chauffeur:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.driverName, leftMargin + 25, yPos);
  yPos += lineHeight;

  // Driver Phone
  if (data.driverPhone) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Téléphone:', leftMargin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.driverPhone, leftMargin + 25, yPos);
    yPos += lineHeight;
  }

  // Vehicle Registration
  pdf.setFont('helvetica', 'bold');
  pdf.text('Véhicule:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(data.vehicleRegistration, leftMargin + 25, yPos);
  pdf.setFontSize(10);
  yPos += lineHeight + 3;

  // Separator
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Fuel Details
  // ========================================
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary);
  pdf.text('DÉTAILS CARBURANT', leftMargin, yPos);
  yPos += lineHeight + 2;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'normal');

  // Fuel Type
  pdf.setFont('helvetica', 'bold');
  pdf.text('Type:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.fuelType, leftMargin + 25, yPos);
  yPos += lineHeight;

  // Quantity
  pdf.setFont('helvetica', 'bold');
  pdf.text('Quantité:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.quantity.toFixed(2)} L`, leftMargin + 25, yPos);
  yPos += lineHeight;

  // Unit Price
  pdf.setFont('helvetica', 'bold');
  pdf.text('Prix Unitaire:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatCurrency(data.unitPrice), leftMargin + 25, yPos);
  yPos += lineHeight + 3;

  // Total Amount (highlighted)
  pdf.setDrawColor(COLORS.primary);
  pdf.setFillColor(COLORS.primary);
  pdf.rect(10, yPos - 4, width - 20, 10, 'F');
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text('MONTANT TOTAL:', leftMargin + 2, yPos + 2);
  pdf.setFontSize(14);
  pdf.text(formatCurrency(data.totalAmount), width - leftMargin - 2, yPos + 2, { align: 'right' });
  yPos += 12;

  // Payment Method
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.textLight);
  pdf.setFont('helvetica', 'italic');
  const paymentMethodText = data.paymentMethod === 'prepaid' 
    ? 'Payé par Portefeuille Prépayé'
    : data.paymentMethod === 'tpe'
    ? 'Payé par Carte Bancaire (TPE)'
    : 'Payé par Portefeuille + Carte';
  pdf.text(paymentMethodText, width / 2, yPos, { align: 'center' });
  yPos += 8;

  // Station Information (if available)
  if (data.stationName) {
    pdf.setDrawColor(COLORS.border);
    pdf.line(10, yPos, width - 10, yPos);
    yPos += 6;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.primary);
    pdf.text('STATION DE SERVICE', leftMargin, yPos);
    yPos += lineHeight + 2;

    pdf.setFontSize(10);
    pdf.setTextColor(COLORS.text);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.stationName, leftMargin, yPos);
    yPos += lineHeight;

    if (data.stationAddress) {
      pdf.setFontSize(9);
      pdf.setTextColor(COLORS.textLight);
      pdf.text(data.stationAddress, leftMargin, yPos);
      yPos += lineHeight + 3;
    }
  }

  // ========================================
  // QR Code
  // ========================================
  
  if (includeQRCode) {
    yPos += 5;
    const qrImage = await generateQRCodeImage(data.qrCodeData);
    const qrSize = 40; // mm
    const qrX = (width - qrSize) / 2;
    
    pdf.addImage(qrImage, 'PNG', qrX, yPos, qrSize, qrSize);
    yPos += qrSize + 5;

    pdf.setFontSize(8);
    pdf.setTextColor(COLORS.textLight);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Scannez ce QR Code à la station pour valider', width / 2, yPos, { align: 'center' });
    yPos += 6;
  }

  // ========================================
  // Footer
  // ========================================
  
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 5;

  pdf.setFontSize(8);
  pdf.setTextColor(COLORS.textLight);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Merci de votre confiance • Assur\'Trans©', width / 2, yPos, { align: 'center' });
  yPos += 4;
  pdf.text('Pour toute assistance: contact@assurtrans.com', width / 2, yPos, { align: 'center' });

  // Generate blob
  return pdf.output('blob');
}

/**
 * Generate TPE Transaction Receipt PDF
 * 
 * @param data - TPE transaction receipt data
 * @param options - PDF generation options
 * @returns PDF blob
 */
export async function generateTPETransactionReceiptPDF(
  data: TPETransactionReceiptData,
  options: ReceiptPDFOptions = {}
): Promise<Blob> {
  const {
    format: pdfFormat = 'thermal',
    includeQRCode = true,
    includeLogo = true,
    language = 'fr'
  } = options;

  const width = pdfFormat === 'thermal' ? THERMAL_WIDTH : A4_WIDTH;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pdfFormat === 'thermal' ? [width, 297] : 'a4'
  });

  let yPos = 10;

  // ========================================
  // Header
  // ========================================
  
  pdf.setFontSize(20);
  pdf.setTextColor(COLORS.primary);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Assur\'Trans©', width / 2, yPos, { align: 'center' });
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.textLight);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Station TotalEnergies', width / 2, yPos, { align: 'center' });
  yPos += 10;

  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Receipt Type
  // ========================================
  
  pdf.setFontSize(14);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REÇU TRANSACTION TPE', width / 2, yPos, { align: 'center' });
  yPos += 10;

  // ========================================
  // Transaction Information
  // ========================================
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const leftMargin = 10;
  const lineHeight = 6;

  // Transaction ID
  pdf.setFont('helvetica', 'bold');
  pdf.text('N° Transaction:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(data.transactionId, leftMargin + 32, yPos);
  pdf.setFontSize(10);
  yPos += lineHeight;

  // Date
  pdf.setFont('helvetica', 'bold');
  pdf.text('Date:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDate(data.transactionDate), leftMargin + 32, yPos);
  yPos += lineHeight;

  // Terminal ID
  pdf.setFont('helvetica', 'bold');
  pdf.text('Terminal:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.terminalId, leftMargin + 32, yPos);
  yPos += lineHeight;

  // Authorization Code
  if (data.authorizationCode) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Code Autorisation:', leftMargin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.authorizationCode, leftMargin + 32, yPos);
    yPos += lineHeight;
  }

  yPos += 3;
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Station Information
  // ========================================
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary);
  pdf.text('STATION', leftMargin, yPos);
  yPos += lineHeight + 2;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.stationName, leftMargin, yPos);
  yPos += lineHeight;

  if (data.stationAddress) {
    pdf.setFontSize(9);
    pdf.setTextColor(COLORS.textLight);
    pdf.text(data.stationAddress, leftMargin, yPos);
    yPos += lineHeight;
  }

  yPos += 3;
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Order & Vehicle Information
  // ========================================
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary);
  pdf.text('COMMANDE', leftMargin, yPos);
  yPos += lineHeight + 2;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'normal');

  // Order Number
  pdf.setFont('helvetica', 'bold');
  pdf.text('N° Commande:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.orderNumber, leftMargin + 28, yPos);
  yPos += lineHeight;

  // Driver
  pdf.setFont('helvetica', 'bold');
  pdf.text('Chauffeur:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.driverName, leftMargin + 28, yPos);
  yPos += lineHeight;

  // Vehicle
  pdf.setFont('helvetica', 'bold');
  pdf.text('Véhicule:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.vehicleRegistration, leftMargin + 28, yPos);
  yPos += lineHeight;

  // Fuel Type
  pdf.setFont('helvetica', 'bold');
  pdf.text('Carburant:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.fuelType} (${data.quantity.toFixed(2)} L)`, leftMargin + 28, yPos);
  yPos += lineHeight + 3;

  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 8;

  // ========================================
  // Payment Information
  // ========================================
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.primary);
  pdf.text('PAIEMENT', leftMargin, yPos);
  yPos += lineHeight + 2;

  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'normal');

  // Payment Method
  pdf.setFont('helvetica', 'bold');
  pdf.text('Méthode:', leftMargin, yPos);
  pdf.setFont('helvetica', 'normal');
  const paymentMethodText = data.paymentMethod === 'card'
    ? `Carte Bancaire (${data.cardType?.toUpperCase()})`
    : `Mobile Money (${data.mobileMoneyOperator})`;
  pdf.text(paymentMethodText, leftMargin + 25, yPos);
  yPos += lineHeight;

  // Card/Mobile Money Details
  if (data.paymentMethod === 'card' && data.cardLastFour) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Carte:', leftMargin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`**** **** **** ${data.cardLastFour}`, leftMargin + 25, yPos);
    yPos += lineHeight;
  } else if (data.paymentMethod === 'mobile_money' && data.mobileMoneyNumber) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Numéro:', leftMargin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.mobileMoneyNumber, leftMargin + 25, yPos);
    yPos += lineHeight;
  }

  yPos += 3;

  // Total Amount (highlighted)
  pdf.setDrawColor(COLORS.primary);
  pdf.setFillColor(COLORS.primary);
  pdf.rect(10, yPos - 4, width - 20, 10, 'F');
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('MONTANT PAYÉ:', leftMargin + 2, yPos + 2);
  pdf.setFontSize(14);
  pdf.text(formatCurrency(data.totalAmount), width - leftMargin - 2, yPos + 2, { align: 'right' });
  yPos += 12;

  // Transaction Status
  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.accent);
  pdf.setFont('helvetica', 'bold');
  pdf.text('✓ TRANSACTION APPROUVÉE', width / 2, yPos, { align: 'center' });
  yPos += 8;

  // ========================================
  // QR Code
  // ========================================
  
  if (includeQRCode) {
    yPos += 5;
    const qrImage = await generateQRCodeImage(data.qrCodeData);
    const qrSize = 40;
    const qrX = (width - qrSize) / 2;
    
    pdf.addImage(qrImage, 'PNG', qrX, yPos, qrSize, qrSize);
    yPos += qrSize + 5;

    pdf.setFontSize(8);
    pdf.setTextColor(COLORS.textLight);
    pdf.setFont('helvetica', 'italic');
    pdf.text('QR Code de validation', width / 2, yPos, { align: 'center' });
    yPos += 6;
  }

  // ========================================
  // Footer
  // ========================================
  
  pdf.setDrawColor(COLORS.border);
  pdf.line(10, yPos, width - 10, yPos);
  yPos += 5;

  pdf.setFontSize(8);
  pdf.setTextColor(COLORS.textLight);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Merci pour votre transaction • Assur\'Trans©', width / 2, yPos, { align: 'center' });
  yPos += 4;
  pdf.text('Conservez ce reçu • Pour assistance: contact@assurtrans.com', width / 2, yPos, { align: 'center' });

  return pdf.output('blob');
}

/**
 * Download PDF Receipt
 * 
 * @param blob - PDF blob
 * @param filename - Download filename
 */
export function downloadPDFReceipt(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Print PDF Receipt (open in new window)
 * 
 * @param blob - PDF blob
 */
export function printPDFReceipt(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  } else {
    console.error('❌ Failed to open print window. Popup blocked?');
  }
}

/**
 * Helper: Create receipt filename
 */
export function createReceiptFilename(type: 'fuel' | 'tpe', orderNumber: string): string {
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  return `Assur-Trans_${type === 'fuel' ? 'Commande' : 'TPE'}_${orderNumber}_${timestamp}.pdf`;
}
