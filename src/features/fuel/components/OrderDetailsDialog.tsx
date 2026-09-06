// Order Details Dialog - Full Order Information with QR Code

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Fuel, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  Car,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  User,
  QrCode as QrCodeIcon
} from 'lucide-react';
import type { Order, OrderStatus } from '../types';
import { QRCodeGenerator } from './QRCodeGenerator';
import { decodeOrderQR, type OrderQRData } from '@/lib/qr-utils';
import { DownloadReceiptButton, PrintReceiptButton } from '@/components/ReceiptPDFButton';
import type { FuelOrderReceiptData } from '@/services/receipt-pdf-service';
import { useAuthStore } from '@/store/auth-store';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'En attente', color: 'bg-yellow-500', icon: Clock },
  dispatched: { label: 'Assignée', color: 'bg-blue-500', icon: Truck },
  in_progress: { label: 'En cours', color: 'bg-indigo-500', icon: Fuel },
  completed: { label: 'Terminée', color: 'bg-green-500', icon: CheckCircle2 },
  cancelled: { label: 'Annulée', color: 'bg-red-500', icon: XCircle }
};

interface OrderDetailsDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsDialog({ order, open, onOpenChange }: OrderDetailsDialogProps) {
  const [qrData, setQrData] = useState<OrderQRData | null>(null);
  const user = useAuthStore((state) => state.user);
  
  // Load QR data asynchronously (Sprint 2.2: verifies HMAC signature)
  useEffect(() => {
    const loadQRData = async () => {
      if (order?.qrCodeData) {
        const data = await decodeOrderQR(order.qrCodeData);
        setQrData(data);
      } else {
        setQrData(null);
      }
    };
    
    loadQRData();
  }, [order?.qrCodeData]);
  
  if (!order) return null;

  const StatusIcon = statusConfig[order.status].icon;
  
  // Prepare receipt data
  const receiptData: FuelOrderReceiptData | null = qrData ? {
    orderNumber: order.orderNumber,
    orderDate: new Date(order.createdAt),
    driverName: user?.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Chauffeur',
    vehicleRegistration: order.vehicleRegistration,
    fuelType: order.productName,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    totalAmount: order.totalAmount,
    stationName: order.stationName,
    validationCode: order.validationCode || '',
    qrCodeData: order.qrCodeData || '',
    paymentMethod: 'prepaid' // Default, could be enhanced based on actual payment
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold">
                {order.orderNumber}
              </DialogTitle>
              <DialogDescription>
                Créée le {format(new Date(order.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </DialogDescription>
            </div>
            <Badge 
              variant="secondary" 
              className={`${statusConfig[order.status].color} text-white border-0`}
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[order.status].label}
            </Badge>
          </div>
          
          {/* Receipt PDF Buttons */}
          {receiptData && (
            <div className="flex gap-2 pt-4">
              <DownloadReceiptButton
                type="fuel"
                data={receiptData}
                variant="default"
                className="flex-1"
              />
              <PrintReceiptButton
                type="fuel"
                data={receiptData}
                variant="outline"
                className="flex-1"
              />
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* QR Code Section - Only show for pending and dispatched orders */}
            {(order.status === 'pending' || order.status === 'dispatched') && order.qrCode && qrData && (
              <>
                <QRCodeGenerator
                  qrCodeDataURL={order.qrCode}
                  orderData={qrData}
                  orderNumber={order.orderNumber}
                />
                <Separator />
              </>
            )}

            {/* Order Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Informations de la Commande
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vehicle */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Car className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Véhicule</p>
                    <p className="font-semibold">{order.vehicleRegistration}</p>
                  </div>
                </div>

                {/* Product */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Fuel className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Produit</p>
                    <p className="font-semibold">{order.productName}</p>
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Quantité</p>
                    <p className="font-semibold">{order.quantity} L</p>
                  </div>
                </div>

                {/* Unit Price */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Prix Unitaire</p>
                    <p className="font-semibold">{order.unitPrice.toLocaleString()} XOF/L</p>
                  </div>
                </div>

                {/* Total Amount */}
                <div className="md:col-span-2 flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <DollarSign className="h-6 w-6 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Montant Total</p>
                    <p className="text-2xl font-bold text-primary">{order.totalAmount.toLocaleString()} XOF</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Station Information (if dispatched) */}
            {order.stationName && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Station Assignée
                  </h3>
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="font-semibold text-blue-900">{order.stationName}</p>
                    {order.dispatchedAt && (
                      <p className="text-sm text-blue-700 mt-1">
                        Assignée le {format(new Date(order.dispatchedAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Validation Code - Show prominently for active orders */}
            {order.validationCode && (order.status === 'pending' || order.status === 'dispatched' || order.status === 'in_progress') && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <QrCodeIcon className="h-5 w-5 text-primary" />
                    Code de Validation
                  </h3>
                  <div className="p-6 rounded-lg bg-primary/10 border-2 border-primary/30 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Communiquez ce code à la station-service
                    </p>
                    <p className="text-5xl font-bold text-primary tracking-wider font-mono">
                      {order.validationCode}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Timeline */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Historique
              </h3>
              <div className="space-y-2">
                {/* Created */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium">Commande créée</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Dispatched */}
                {order.dispatchedAt && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50">
                    <Truck className="h-4 w-4 text-blue-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Assignée à une station</p>
                      <p className="text-xs text-blue-700">
                        {format(new Date(order.dispatchedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Scanned */}
                {order.scannedAt && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50">
                    <QrCodeIcon className="h-4 w-4 text-indigo-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-indigo-900">QR Code scanné</p>
                      <p className="text-xs text-indigo-700">
                        {format(new Date(order.scannedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Completed */}
                {order.completedAt && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Commande terminée</p>
                      <p className="text-xs text-green-700">
                        {format(new Date(order.completedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Notes
                  </h3>
                  <div className="p-4 rounded-lg bg-muted/50 text-sm">
                    {order.notes}
                  </div>
                </div>
              </>
            )}

            {/* Customer Info */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Client
              </h3>
              <div className="p-3 rounded-lg bg-muted/30 text-sm">
                <p className="font-medium">{order.customerName}</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
