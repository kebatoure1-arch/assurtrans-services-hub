// QR Code Generator Component for Fuel Orders

import { Download, Printer, QrCode as QrCodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadQRCode, printQRCode } from '../services/qr-service';
import type { OrderQRData } from '@/lib/qr-utils';

interface QRCodeGeneratorProps {
  qrCodeDataURL: string;
  orderData: OrderQRData;
  orderNumber: string;
}

export function QRCodeGenerator({ qrCodeDataURL, orderData, orderNumber }: QRCodeGeneratorProps) {
  const handleDownload = () => {
    try {
      downloadQRCode(qrCodeDataURL, `QR-${orderNumber}`);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handlePrint = () => {
    try {
      printQRCode(qrCodeDataURL, orderData);
    } catch (error) {
      console.error('Print failed:', error);
    }
  };

  return (
    <Card className="border-[#789D9A]/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCodeIcon className="h-5 w-5 text-[#789D9A]" />
          QR Code de la Commande
        </CardTitle>
        <CardDescription>
          Présentez ce QR Code à la station-service pour le traitement de votre commande
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Display */}
        <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-[#789D9A]/20">
          <img
            src={qrCodeDataURL}
            alt={`QR Code ${orderNumber}`}
            className="w-64 h-64"
          />
        </div>

        {/* Validation Code */}
        <div className="text-center p-3 bg-[#789D9A]/10 rounded-lg border border-[#789D9A]/30">
          <p className="text-sm text-muted-foreground mb-1">Code de validation</p>
          <p className="text-3xl font-bold text-[#789D9A] tracking-wider">
            {orderData.validationCode}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            À communiquer à la station
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleDownload}
            variant="outline"
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex-1"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p className="font-semibold text-foreground">Instructions :</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Présentez ce QR Code à la station-service</li>
            <li>Le responsable scannera le code</li>
            <li>Confirmez avec le code de validation</li>
            <li>Attendez le traitement de votre commande</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
