// QR Scanner Page for Station-Service - Scan and Validate Fuel Orders

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ScanLine, 
  Camera, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  Calendar,
  Building2,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { decodeOrderQR, formatQRDataForDisplay, type OrderQRData } from '@/lib/qr-utils';
import { getOrderById, startOrder, completeOrder } from '@/features/fuel/services/order-service';
import { 
  validateQRCode, 
  markQRCodeAsUsed 
} from '@/features/fuel/services/qr-validation-service';
import type { 
  QRValidationRequest,
  QRValidationResult 
} from '@/features/fuel/services/qr-validation-service';
import { 
  checkRateLimit, 
  logSecurityEvent 
} from '@/features/fuel/services/anti-fraud-service';
import { OTPFallbackDialog } from '@/components/OTPFallbackDialog';
import { table } from '@devvai/devv-code-backend';
import type { Order } from '@/features/fuel/types';

const ORDERS_TABLE_ID = 'f4f186q7i03l';

export default function QRScannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuthStore();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<OrderQRData | null>(null);
  const [validationCode, setValidationCode] = useState('');
  const [manualOrderNumber, setManualOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [validationResult, setValidationResult] = useState<QRValidationResult | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    totalTime: number;
    decodingTime: number;
    dbQueryTime: number;
  } | null>(null);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpOrderNumber, setOtpOrderNumber] = useState('');
  const [otpUserPhone, setOtpUserPhone] = useState<string | undefined>(undefined);

  // Check auth and role
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }

    // Admin has unrestricted access
    if (user.activeRole !== 'station_operator' && user.activeRole !== 'admin') {
      navigate('/unauthorized');
    }
  }, [isAuthenticated, user, navigate]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && scanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, [scanning]);

  const startScanning = async () => {
    try {
      setError(null);
      
      // Check camera permission
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraPermission(permission.state);

      if (permission.state === 'denied') {
        setError('Accès caméra refusé. Veuillez autoriser l\'accès dans les paramètres.');
        return;
      }

      // Initialize scanner
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanError
      );

      setScanning(true);
    } catch (err) {
      console.error('Scanner start failed:', err);
      setError('Impossible de démarrer le scanner. Vérifiez les permissions caméra.');
      setCameraPermission('denied');
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        setScanning(false);
      } catch (err) {
        console.error('Scanner stop failed:', err);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // Stop scanner immediately
    await stopScanning();

    // Decode QR data with signature verification (Sprint 2.2)
    const data = await decodeOrderQR(decodedText);
    
    if (!data) {
      toast({
        title: 'QR Code invalide',
        description: 'Le QR Code scanné est invalide ou corrompu (vérification signature échouée)',
        variant: 'destructive',
      });
      return;
    }

    setScannedData(data);
    
    // Load order details
    loadOrderDetails(data.orderNumber);
  };

  const onScanError = (errorMessage: string) => {
    // Ignore common scanning errors
    if (!errorMessage.includes('NotFoundException')) {
      console.warn('QR Scan error:', errorMessage);
    }
  };

  const loadOrderDetails = async (orderNumber: string) => {
    setLoading(true);
    setError(null);

    try {
      // Query by orderNumber
      const result = await table.getItems(ORDERS_TABLE_ID);
      const orders = (result.items || []) as Order[];
      const order = orders.find(o => o.orderNumber === orderNumber);

      if (!order) {
        setError('Commande introuvable');
        toast({
          title: 'Erreur',
          description: 'Aucune commande trouvée avec ce numéro',
          variant: 'destructive',
        });
        return;
      }

      setOrderDetails(order);
    } catch (err) {
      console.error('Failed to load order:', err);
      setError('Erreur lors du chargement de la commande');
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les détails de la commande',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateAndProcess = async () => {
    if (!scannedData || !orderDetails || !user) return;

    // Validate code
    if (validationCode !== scannedData.validationCode) {
      toast({
        title: 'Code invalide',
        description: 'Le code de validation ne correspond pas',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Update order with scan info
      await table.updateItem(ORDERS_TABLE_ID, {
        _uid: orderDetails._uid,
        _id: orderDetails._id,
        scannedAt: new Date().toISOString(),
        scannedBy: user.uid,
        status: 'in_progress',
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: 'Validation réussie',
        description: 'La commande a été validée avec succès',
      });

      // Reload order
      await loadOrderDetails(scannedData.orderNumber);
      setValidationCode('');
    } catch (err) {
      console.error('Validation failed:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de valider la commande',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = () => {
    if (!manualOrderNumber.trim()) {
      toast({
        title: 'Numéro requis',
        description: 'Veuillez saisir un numéro de commande',
        variant: 'destructive',
      });
      return;
    }

    loadOrderDetails(manualOrderNumber.trim());
  };

  const handleOTPFallback = () => {
    if (!manualOrderNumber.trim()) {
      toast({
        title: 'Numéro requis',
        description: 'Veuillez saisir un numéro de commande pour utiliser l\'OTP',
        variant: 'destructive',
      });
      return;
    }

    setOtpOrderNumber(manualOrderNumber.trim());
    setOtpUserPhone(undefined); // Could be extracted from order in future
    setOtpDialogOpen(true);
  };

  const handleOTPSuccess = async (orderId: string, orderNumber: string) => {
    toast({
      title: 'OTP vérifié',
      description: 'Validation réussie par code OTP',
    });

    // Load order details after OTP verification
    await loadOrderDetails(orderNumber);
    setManualOrderNumber('');
  };

  const handleStartOrder = async () => {
    if (!orderDetails) return;

    setLoading(true);
    try {
      await startOrder(orderDetails._id, orderDetails._uid);
      await loadOrderDetails(orderDetails.orderNumber);
      
      toast({
        title: 'Commande démarrée',
        description: 'Le traitement de la commande a commencé',
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de démarrer la commande',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!orderDetails) return;

    setLoading(true);
    try {
      await completeOrder(orderDetails._id, orderDetails._uid);
      
      toast({
        title: 'Commande terminée',
        description: 'La commande a été complétée avec succès',
      });

      // Reset
      setScannedData(null);
      setOrderDetails(null);
      setValidationCode('');
      setManualOrderNumber('');
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de terminer la commande',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScannedData(null);
    setOrderDetails(null);
    setValidationCode('');
    setManualOrderNumber('');
    setError(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: 'outline', label: 'En attente' },
      dispatched: { variant: 'secondary', label: 'Dispatchée' },
      in_progress: { variant: 'default', label: 'En cours' },
      completed: { variant: 'secondary', label: 'Terminée' },
      cancelled: { variant: 'destructive', label: 'Annulée' },
    };

    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/station')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Scanner QR Code</h1>
            <p className="text-muted-foreground">
              Scannez les QR Codes des commandes de carburant
            </p>
          </div>
        </div>

        {/* Scanner Card */}
        {!scannedData && !orderDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#789D9A]" />
                Scanner QR Code
              </CardTitle>
              <CardDescription>
                Utilisez la caméra pour scanner le QR Code de la commande
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scanner View */}
              {!scanning && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#789D9A]/30 rounded-lg bg-[#789D9A]/5">
                  <ScanLine className="h-16 w-16 text-[#789D9A] mb-4" />
                  <Button onClick={startScanning} size="lg">
                    <Camera className="h-5 w-5 mr-2" />
                    Démarrer le Scanner
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Autorisation caméra requise
                  </p>
                </div>
              )}

              {scanning && (
                <div className="space-y-3">
                  <div id="qr-reader" className="rounded-lg overflow-hidden border-2 border-[#789D9A]" />
                  <Button onClick={stopScanning} variant="destructive" className="w-full">
                    <X className="h-4 w-4 mr-2" />
                    Arrêter le Scanner
                  </Button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Manual Entry */}
              <div className="pt-4 border-t">
                <Label htmlFor="manual-order">Ou saisissez le numéro manuellement</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="manual-order"
                    placeholder="ORD-20250120-456"
                    value={manualOrderNumber}
                    onChange={(e) => setManualOrderNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  />
                  <Button onClick={handleManualSearch} variant="outline">
                    Rechercher
                  </Button>
                </div>
              </div>

              {/* OTP Fallback */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-muted-foreground">Scanner indisponible ?</Label>
                  <Badge variant="secondary" className="text-xs">
                    <KeyRound className="h-3 w-3 mr-1" />
                    Alternative
                  </Badge>
                </div>
                <Button 
                  onClick={handleOTPFallback} 
                  variant="outline" 
                  className="w-full"
                  disabled={!manualOrderNumber.trim()}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Utiliser Code OTP
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Validation par code OTP à 6 chiffres (SMS)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OTP Fallback Dialog */}
        <OTPFallbackDialog
          open={otpDialogOpen}
          onOpenChange={setOtpDialogOpen}
          orderNumber={otpOrderNumber}
          userPhone={otpUserPhone}
          onSuccess={handleOTPSuccess}
        />

        {/* Scanned Order Details */}
        {scannedData && orderDetails && (
          <Card className="border-[#789D9A]/30">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    QR Code Scanné
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Commande {scannedData.orderNumber}
                  </CardDescription>
                </div>
                {getStatusBadge(orderDetails.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Order Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Produit
                  </Label>
                  <p className="font-medium">{scannedData.productName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Véhicule
                  </Label>
                  <p className="font-medium">{scannedData.vehicleRegistration}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Montant
                  </Label>
                  <p className="font-bold text-lg text-[#789D9A]">
                    {scannedData.amount.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date
                  </Label>
                  <p className="font-medium">
                    {new Date(scannedData.timestamp).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                {scannedData.stationName && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Station assignée
                    </Label>
                    <p className="font-medium">{scannedData.stationName}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Validation Code Input */}
              {orderDetails.status === 'dispatched' && (
                <div className="space-y-3">
                  <Label htmlFor="validation-code">Code de validation</Label>
                  <div className="flex gap-2">
                    <Input
                      id="validation-code"
                      type="text"
                      maxLength={4}
                      placeholder="1234"
                      value={validationCode}
                      onChange={(e) => setValidationCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl font-bold tracking-wider"
                    />
                    <Button
                      onClick={validateAndProcess}
                      disabled={validationCode.length !== 4 || loading}
                    >
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Valider
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Demandez le code à 4 chiffres au client
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {orderDetails.status === 'in_progress' && (
                  <Button onClick={handleCompleteOrder} disabled={loading} className="flex-1">
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Terminer la Commande
                  </Button>
                )}
                
                <Button onClick={resetScanner} variant="outline" className="flex-1">
                  Scanner un Autre QR
                </Button>
              </div>

              {/* Scan Info */}
              {orderDetails.scannedAt && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Scanné le {new Date(orderDetails.scannedAt).toLocaleString('fr-FR')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Performance Metrics (Dev Mode) */}
              {performanceMetrics && process.env.NODE_ENV === 'development' && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-xs space-y-1">
                    <div className="font-semibold text-blue-900">⚡ Performance Metrics</div>
                    <div>Total: {performanceMetrics.totalTime}ms</div>
                    <div>Décodage: {performanceMetrics.decodingTime}ms</div>
                    <div>DB Query: {performanceMetrics.dbQueryTime}ms</div>
                    <div className={performanceMetrics.totalTime < 2000 ? 'text-green-600' : 'text-red-600'}>
                      {performanceMetrics.totalTime < 2000 ? '✅ < 2s' : '❌ > 2s'}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Warnings */}
              {validationResult?.warnings && validationResult.warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Avertissements</div>
                    <ul className="text-xs list-disc list-inside">
                      {validationResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
