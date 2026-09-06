/**
 * TPE Terminal Component
 * 
 * Payment terminal interface for OLA ENERGY stations to process
 * card payments for fuel orders.
 * 
 * Features:
 * - QR Code scanning and validation
 * - Card payment processing
 * - Receipt generation and printing
 * - Offline transaction support
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Smartphone,
  Scan,
  Check,
  X,
  Printer,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  validateQRAtTPE,
  processTPETransaction,
  generateTPEReceipt,
  getOfflineTransactionCount,
  syncOfflineTransactions,
} from '../services/tpe-service';
import type {
  TPEStatus,
  TPEPaymentMethod,
  TPEValidationResponse,
  TPETransactionResponse,
  TPEReceipt,
} from '../types/tpe.types';
import { DownloadReceiptButton } from '@/components/ReceiptPDFButton';
import type { TPETransactionReceiptData } from '@/services/receipt-pdf-service';

interface TPETerminalProps {
  terminalId: string;
  stationId: string;
  stationName: string;
}

export default function TPETerminal({
  terminalId,
  stationId,
  stationName,
}: TPETerminalProps) {
  const { toast } = useToast();

  // State
  const [status, setStatus] = useState<TPEStatus>('idle');
  const [qrCode, setQrCode] = useState('');
  const [validationData, setValidationData] = useState<TPEValidationResponse | null>(null);
  const [transactionResponse, setTransactionResponse] = useState<TPETransactionResponse | null>(null);
  const [receipt, setReceipt] = useState<TPEReceipt | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<TPEPaymentMethod>('visa');
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load offline count
  useEffect(() => {
    setOfflineCount(getOfflineTransactionCount());
  }, [status]);

  // Handle QR Code scan
  const handleScanQR = async () => {
    if (!qrCode.trim()) {
      toast({
        title: 'QR Code manquant',
        description: 'Veuillez scanner ou saisir le QR Code',
        variant: 'destructive',
      });
      return;
    }

    setStatus('validating');

    try {
      const validation = await validateQRAtTPE({
        qrCode,
        terminalId,
        stationId,
      });

      setValidationData(validation);

      if (validation.valid && validation.canProceed) {
        setStatus('scanning');
        toast({
          title: 'QR Code validé',
          description: `Commande: ${validation.orderId}`,
        });
      } else {
        setStatus('failed');
        toast({
          title: 'Validation échouée',
          description: validation.reason || 'QR Code invalide',
          variant: 'destructive',
        });
      }

    } catch (err: any) {
      setStatus('failed');
      toast({
        title: 'Erreur de validation',
        description: err?.message || 'Impossible de valider le QR Code',
        variant: 'destructive',
      });
    }
  };

  // Handle payment processing
  const handleProcessPayment = async () => {
    if (!validationData || !validationData.valid) {
      toast({
        title: 'Validation requise',
        description: 'Veuillez d\'abord valider le QR Code',
        variant: 'destructive',
      });
      return;
    }

    setStatus('processing_payment');

    try {
      // Determine payment amount
      const paymentAmount = validationData.paymentRequired
        ? validationData.paymentAmount || 0
        : validationData.amount;

      const response = await processTPETransaction({
        orderId: validationData.orderId,
        amount: paymentAmount,
        currency: validationData.currency,
        paymentMethod: selectedPaymentMethod,
        terminalId,
        stationId,
        customerId: validationData.orderId,
      });

      setTransactionResponse(response);

      if (response.success) {
        setStatus('success');
        
        // Generate receipt
        const receiptData = await generateTPEReceipt(response);
        setReceipt(receiptData);

        toast({
          title: 'Paiement réussi',
          description: `Transaction: ${response.transactionId}`,
        });

      } else {
        setStatus('failed');
        toast({
          title: 'Paiement refusé',
          description: response.errorMessage || 'La transaction a échoué',
          variant: 'destructive',
        });
      }

    } catch (err: any) {
      setStatus('failed');
      toast({
        title: 'Erreur de paiement',
        description: err?.message || 'Impossible de traiter le paiement',
        variant: 'destructive',
      });
    }
  };

  // Handle print receipt
  const handlePrintReceipt = () => {
    if (!receipt) return;

    // Create printable receipt
    const printContent = `
      <div style="font-family: monospace; width: 300px; margin: 0 auto;">
        <h2 style="text-align: center;">${receipt.stationName}</h2>
        <p style="text-align: center;">${receipt.stationAddress}</p>
        <hr />
        <p><strong>Date:</strong> ${receipt.date} ${receipt.time}</p>
        <p><strong>Reçu N°:</strong> ${receipt.receiptNumber}</p>
        <p><strong>Terminal:</strong> ${receipt.terminalId}</p>
        <hr />
        <p><strong>Chauffeur:</strong> ${receipt.driverName}</p>
        ${receipt.vehicleRegistration ? `<p><strong>Véhicule:</strong> ${receipt.vehicleRegistration}</p>` : ''}
        <hr />
        <p><strong>Produit:</strong> ${receipt.fuelType}</p>
        <p><strong>Quantité:</strong> ${receipt.quantity} L</p>
        <p><strong>Prix unitaire:</strong> ${receipt.unitPrice} ${receipt.currency}</p>
        <p style="font-size: 1.2em;"><strong>TOTAL:</strong> ${receipt.totalAmount} ${receipt.currency}</p>
        <hr />
        <p><strong>Paiement:</strong> ${receipt.paymentMethod.toUpperCase()}</p>
        ${receipt.cardMask ? `<p><strong>Carte:</strong> ${receipt.cardMask}</p>` : ''}
        ${receipt.authorizationCode ? `<p><strong>Autorisation:</strong> ${receipt.authorizationCode}</p>` : ''}
        <hr />
        ${receipt.loyaltyPointsEarned ? `<p><strong>Points gagnés:</strong> ${receipt.loyaltyPointsEarned}</p>` : ''}
        <p style="text-align: center; margin-top: 20px;">Merci de votre confiance!</p>
      </div>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }

    toast({
      title: 'Impression',
      description: 'Reçu envoyé à l\'imprimante',
    });
  };

  // Handle sync offline transactions
  const handleSyncOffline = async () => {
    toast({
      title: 'Synchronisation',
      description: 'Synchronisation des transactions en cours...',
    });

    try {
      await syncOfflineTransactions();
      setOfflineCount(getOfflineTransactionCount());
      
      toast({
        title: 'Synchronisation réussie',
        description: 'Toutes les transactions ont été synchronisées',
      });

    } catch (err: any) {
      toast({
        title: 'Erreur de synchronisation',
        description: err?.message || 'Impossible de synchroniser',
        variant: 'destructive',
      });
    }
  };

  // Reset terminal
  const handleReset = () => {
    setStatus('idle');
    setQrCode('');
    setValidationData(null);
    setTransactionResponse(null);
    setReceipt(null);
  };

  // Render payment method buttons
  const paymentMethods: { value: TPEPaymentMethod; label: string; icon: typeof CreditCard }[] = [
    { value: 'visa', label: 'Visa', icon: CreditCard },
    { value: 'mastercard', label: 'Mastercard', icon: CreditCard },
    { value: 'qr_prepaid', label: 'QR Prépayé', icon: Smartphone },
  ];

  return (
    <div className="space-y-6">
      {/* Terminal Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">TPE OLA ENERGY</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {stationName} • Terminal {terminalId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isOnline ? 'default' : 'destructive'} className="flex items-center gap-1">
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </Badge>
              {offlineCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncOffline}
                  disabled={!isOnline}
                >
                  Sync ({offlineCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Terminal Interface */}
      <Card>
        <CardContent className="pt-6">
          {/* Status Badge */}
          <div className="mb-6">
            <StatusBadge status={status} />
          </div>

          {/* Step 1: QR Code Scanning */}
          {(status === 'idle' || status === 'validating') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Scanner le QR Code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ou saisir manuellement..."
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    disabled={status === 'validating'}
                  />
                  <Button
                    onClick={handleScanQR}
                    disabled={status === 'validating' || !qrCode.trim()}
                  >
                    {status === 'validating' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scan className="h-4 w-4" />
                    )}
                    <span className="ml-2">Valider</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Order Details & Payment Method */}
          {(status === 'scanning' || status === 'processing_payment') && validationData && (
            <div className="space-y-6">
              {/* Order Details */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold">Détails de la commande</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Commande:</span>
                    <p className="font-medium">{validationData.orderId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Chauffeur:</span>
                    <p className="font-medium">{validationData.driverName}</p>
                  </div>
                  {validationData.vehicleRegistration && (
                    <div>
                      <span className="text-muted-foreground">Véhicule:</span>
                      <p className="font-medium">{validationData.vehicleRegistration}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Carburant:</span>
                    <p className="font-medium">{validationData.fuelType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantité:</span>
                    <p className="font-medium">{validationData.quantity} L</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Montant total:</span>
                    <p className="font-medium text-lg">{validationData.amount.toLocaleString()} {validationData.currency}</p>
                  </div>
                </div>

                {/* Wallet Balance Info */}
                {validationData.paymentRequired && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          Paiement par carte requis
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 mt-1">
                          Solde wallet: {validationData.walletBalance.toLocaleString()} {validationData.currency}<br />
                          Montant à payer: <strong>{validationData.paymentAmount?.toLocaleString()} {validationData.currency}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label>Méthode de paiement</Label>
                <div className="grid grid-cols-3 gap-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <Button
                        key={method.value}
                        variant={selectedPaymentMethod === method.value ? 'default' : 'outline'}
                        onClick={() => setSelectedPaymentMethod(method.value)}
                        disabled={status === 'processing_payment'}
                        className="h-auto py-4 flex flex-col items-center gap-2"
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs">{method.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Process Payment Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleProcessPayment}
                disabled={status === 'processing_payment'}
              >
                {status === 'processing_payment' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Payer {validationData.paymentRequired 
                      ? validationData.paymentAmount?.toLocaleString() 
                      : validationData.amount.toLocaleString()} {validationData.currency}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: Success/Failure Result */}
          {(status === 'success' || status === 'failed') && (
            <div className="space-y-6">
              {/* Result Message */}
              <div className={`p-6 rounded-lg ${
                status === 'success' 
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-start gap-3">
                  {status === 'success' ? (
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-8 w-8 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      status === 'success' 
                        ? 'text-green-900 dark:text-green-100' 
                        : 'text-red-900 dark:text-red-100'
                    }`}>
                      {status === 'success' ? 'Paiement réussi' : 'Paiement échoué'}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      status === 'success' 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {status === 'success' 
                        ? `Transaction: ${transactionResponse?.transactionId}` 
                        : transactionResponse?.errorMessage || 'La transaction a échoué'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Receipt Preview (success only) */}
              {status === 'success' && receipt && (
                <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                  <h4 className="font-semibold">Reçu</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reçu N°:</span>
                      <span className="font-medium">{receipt.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Montant:</span>
                      <span className="font-medium">{receipt.totalAmount} {receipt.currency}</span>
                    </div>
                    {receipt.cardMask && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Carte:</span>
                        <span className="font-medium">{receipt.cardMask}</span>
                      </div>
                    )}
                    {receipt.authorizationCode && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Autorisation:</span>
                        <span className="font-medium">{receipt.authorizationCode}</span>
                      </div>
                    )}
                    {receipt.loyaltyPointsEarned && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Points gagnés:</span>
                        <span className="font-medium text-primary">+{receipt.loyaltyPointsEarned}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {status === 'success' && receipt && validationData && (
                  <>
                    {/* PDF Receipt Download Button */}
                    <DownloadReceiptButton
                      type="tpe"
                      data={{
                        transactionId: transactionResponse?.transactionId || receipt.receiptNumber,
                        transactionDate: new Date(),
                        terminalId: terminalId,
                        stationName: stationName,
                        orderNumber: validationData.orderId, // Use orderId, not orderNumber
                        driverName: receipt.driverName,
                        vehicleRegistration: receipt.vehicleRegistration || '',
                        fuelType: receipt.fuelType,
                        quantity: receipt.quantity,
                        totalAmount: receipt.totalAmount,
                        paymentMethod: selectedPaymentMethod === 'qr_prepaid' ? 'mobile_money' : 'card',
                        cardType: selectedPaymentMethod === 'visa' ? 'visa' : selectedPaymentMethod === 'mastercard' ? 'mastercard' : undefined,
                        cardLastFour: receipt.cardMask?.slice(-4),
                        qrCodeData: qrCode, // Use the scanned QR code string
                        authorizationCode: receipt.authorizationCode
                      } as TPETransactionReceiptData}
                      variant="default"
                      className="flex-1"
                    />
                    {/* Print Receipt Button */}
                    <Button variant="outline" onClick={handlePrintReceipt} className="flex-1">
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimer
                    </Button>
                  </>
                )}
                <Button onClick={handleReset} className={status === 'success' ? 'flex-1' : 'w-full'}>
                  Nouvelle transaction
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: TPEStatus }) {
  const config = {
    idle: { label: 'En attente', variant: 'secondary' as const, icon: Scan },
    scanning: { label: 'Commande validée', variant: 'default' as const, icon: Check },
    validating: { label: 'Validation...', variant: 'default' as const, icon: Loader2 },
    processing_payment: { label: 'Paiement en cours...', variant: 'default' as const, icon: Loader2 },
    success: { label: 'Paiement réussi', variant: 'default' as const, icon: Check },
    failed: { label: 'Échec', variant: 'destructive' as const, icon: X },
    cancelled: { label: 'Annulé', variant: 'secondary' as const, icon: X },
  };

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className="flex items-center gap-2 w-fit px-4 py-2 text-sm">
      <Icon className={`h-4 w-4 ${status === 'validating' || status === 'processing_payment' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}
