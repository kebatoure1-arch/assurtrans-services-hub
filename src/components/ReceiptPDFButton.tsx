/**
 * ========================================
 * 🧾 Receipt PDF Button Component
 * ========================================
 * 
 * Composant bouton pour générer et télécharger des reçus PDF
 * avec QR Code intégré. Supporte les commandes carburant et 
 * les transactions TPE.
 * 
 * Features:
 * - Loading state pendant génération
 * - Error handling graceful
 * - Toast notifications
 * - Support print et download
 * 
 * @module components/ReceiptPDFButton
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Printer, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  generateFuelOrderReceiptPDF,
  generateTPETransactionReceiptPDF,
  downloadPDFReceipt,
  printPDFReceipt,
  createReceiptFilename,
  FuelOrderReceiptData,
  TPETransactionReceiptData,
  ReceiptPDFOptions
} from '@/services/receipt-pdf-service';

// ========================================
// Types
// ========================================

export interface ReceiptPDFButtonProps {
  type: 'fuel' | 'tpe';
  data: FuelOrderReceiptData | TPETransactionReceiptData;
  action?: 'download' | 'print';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  options?: ReceiptPDFOptions;
  className?: string;
  children?: React.ReactNode;
}

// ========================================
// Component
// ========================================

export const ReceiptPDFButton: React.FC<ReceiptPDFButtonProps> = ({
  type,
  data,
  action = 'download',
  variant = 'outline',
  size = 'default',
  options,
  className = '',
  children
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  /**
   * Handle PDF generation and download/print
   */
  const handleGeneratePDF = async () => {
    setIsGenerating(true);

    try {
      // Generate PDF blob
      let pdfBlob: Blob;
      let filename: string;

      if (type === 'fuel') {
        const fuelData = data as FuelOrderReceiptData;
        pdfBlob = await generateFuelOrderReceiptPDF(fuelData, options);
        filename = createReceiptFilename('fuel', fuelData.orderNumber);
      } else {
        const tpeData = data as TPETransactionReceiptData;
        pdfBlob = await generateTPETransactionReceiptPDF(tpeData, options);
        filename = createReceiptFilename('tpe', tpeData.orderNumber);
      }

      // Download or print
      if (action === 'download') {
        downloadPDFReceipt(pdfBlob, filename);
        toast({
          title: '✅ Reçu téléchargé',
          description: `Le reçu PDF a été téléchargé avec succès.`
        });
      } else {
        printPDFReceipt(pdfBlob);
        toast({
          title: '🖨️ Impression lancée',
          description: `Le reçu est prêt à être imprimé.`
        });
      }
    } catch (error) {
      console.error(`❌ Failed to generate ${type} receipt PDF:`, error);
      toast({
        variant: 'destructive',
        title: '❌ Erreur',
        description: 'Impossible de générer le reçu PDF. Veuillez réessayer.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Default button content
  const defaultContent = action === 'download' ? (
    <>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="ml-2">Télécharger Reçu</span>
    </>
  ) : (
    <>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
      <span className="ml-2">Imprimer Reçu</span>
    </>
  );

  return (
    <Button
      onClick={handleGeneratePDF}
      disabled={isGenerating}
      variant={variant}
      size={size}
      className={className}
    >
      {children || defaultContent}
    </Button>
  );
};

/**
 * Simplified Download Receipt Button
 */
export const DownloadReceiptButton: React.FC<{
  type: 'fuel' | 'tpe';
  data: FuelOrderReceiptData | TPETransactionReceiptData;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
}> = ({ type, data, variant = 'outline', className }) => {
  return (
    <ReceiptPDFButton
      type={type}
      data={data}
      action="download"
      variant={variant}
      size="sm"
      className={className}
    >
      <FileText className="h-4 w-4 mr-2" />
      Reçu PDF
    </ReceiptPDFButton>
  );
};

/**
 * Simplified Print Receipt Button
 */
export const PrintReceiptButton: React.FC<{
  type: 'fuel' | 'tpe';
  data: FuelOrderReceiptData | TPETransactionReceiptData;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
}> = ({ type, data, variant = 'ghost', className }) => {
  return (
    <ReceiptPDFButton
      type={type}
      data={data}
      action="print"
      variant={variant}
      size="sm"
      className={className}
    >
      <Printer className="h-4 w-4" />
    </ReceiptPDFButton>
  );
};
