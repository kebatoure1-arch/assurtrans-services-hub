// Enhanced Mobile Money Dialog — With Auto-detection, Countdown, and Better UX

import { useState, useEffect } from 'react';
import { Loader2, Smartphone, Check, X, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  initiateMobileMoneyPayment,
  checkTransactionStatus,
  simulatePaymentSuccess
} from '../services/mobile-money-service';
import type { MobileMoneyOperator } from '../types/mobile-money.types';
import {
  OPERATOR_CONFIGS,
  detectOperatorFromPhone,
  validatePhoneNumber,
  formatPhoneNumber
} from '../types/mobile-money.types';

interface MobileMoneyDialogEnhancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  purpose: 'wallet_deposit' | 'order_payment' | 'insurance_premium';
  referenceId: string;
  onSuccess?: () => void;
}

type PaymentStep = 'entry' | 'processing' | 'success' | 'failed';

export function MobileMoneyDialogEnhanced({
  open,
  onOpenChange,
  amount,
  purpose,
  referenceId,
  onSuccess,
}: MobileMoneyDialogEnhancedProps) {
  const [operator, setOperator] = useState<MobileMoneyOperator>('orange');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentStep, setCurrentStep] = useState<PaymentStep>('entry');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { toast } = useToast();

  // Auto-detect operator from phone number
  useEffect(() => {
    if (phoneNumber.length >= 2) {
      const detected = detectOperatorFromPhone(phoneNumber);
      if (detected && detected !== operator) {
        setOperator(detected);
        console.log(`📱 Auto-detected operator: ${OPERATOR_CONFIGS[detected].name}`);
      }
    }
  }, [phoneNumber]);

  // Countdown timer for processing state
  useEffect(() => {
    if (currentStep === 'processing' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timeout reached
            setCurrentStep('failed');
            setErrorMessage('Temps expiré. La transaction a été annulée.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentStep, timeLeft]);

  // Poll transaction status
  useEffect(() => {
    if (currentStep === 'processing' && transactionId) {
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await checkTransactionStatus(transactionId);
          
          if (statusResponse.transaction.status === 'success') {
            setCurrentStep('success');
            clearInterval(pollInterval);
          } else if (statusResponse.transaction.status === 'failed') {
            setCurrentStep('failed');
            setErrorMessage(statusResponse.transaction.errorMessage || 'Paiement échoué');
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(pollInterval);
    }
  }, [currentStep, transactionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!validatePhoneNumber(phoneNumber, operator)) {
      toast({
        title: 'Numéro invalide',
        description: `Veuillez saisir un numéro valide pour ${OPERATOR_CONFIGS[operator].name}`,
        variant: 'destructive',
      });
      return;
    }

    setCurrentStep('processing');
    setTimeLeft(300); // Reset timer
    setErrorMessage('');

    try {
      const response = await initiateMobileMoneyPayment({
        operator,
        phoneNumber,
        amount,
        purpose,
        referenceId,
      });

      setTransactionId(response.transaction.id);
      
      toast({
        title: 'Paiement initié',
        description: response.instructions,
        duration: 8000,
      });

      // For testing: auto-confirm after 3 seconds
      if (process.env.NODE_ENV === 'development') {
        setTimeout(async () => {
          await simulatePaymentSuccess(response.transaction.id);
          setCurrentStep('success');
        }, 3000);
      }
    } catch (error) {
      setCurrentStep('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Une erreur est survenue');
      
      toast({
        title: 'Échec',
        description: error instanceof Error ? error.message : 'Échec de l\'initiation du paiement',
        variant: 'destructive',
      });
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    setCurrentStep('entry');
    setErrorMessage('');
    setTransactionId(null);
    setTimeLeft(300);
  };

  const handleSuccess = () => {
    onSuccess?.();
    setTimeout(() => {
      onOpenChange(false);
      resetForm();
    }, 1500);
  };

  const resetForm = () => {
    setOperator('orange');
    setPhoneNumber('');
    setCurrentStep('entry');
    setTransactionId(null);
    setTimeLeft(300);
    setRetryCount(0);
    setErrorMessage('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (currentStep !== 'processing') {
      onOpenChange(newOpen);
      if (!newOpen) resetForm();
    }
  };

  // Format time left as MM:SS
  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const config = OPERATOR_CONFIGS[operator];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paiement Mobile Money</DialogTitle>
          <DialogDescription>
            Payez {amount.toLocaleString()} FCFA via Mobile Money
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Entry */}
        {currentStep === 'entry' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="operator">Opérateur Mobile Money</Label>
              <Select
                value={operator}
                onValueChange={(value) => setOperator(value as MobileMoneyOperator)}
              >
                <SelectTrigger id="operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATOR_CONFIGS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{cfg.icon}</span>
                        <span>{cfg.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Préfixes: {config.prefixes.join(', ')} • USSD: {config.ussdCode}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 border rounded-md bg-muted">
                  <span className="text-sm text-muted-foreground">+221</span>
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="77 123 45 67"
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    setPhoneNumber(cleaned);
                  }}
                  maxLength={11} // With spaces: XX XXX XX XX
                  className="flex-1"
                  autoComplete="tel"
                />
              </div>
              {phoneNumber && !validatePhoneNumber(phoneNumber, operator) && (
                <p className="text-xs text-destructive">
                  ⚠️ Numéro invalide pour {config.name}
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-semibold">{amount.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frais</span>
                <span className="font-semibold">0 FCFA</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-primary">{amount.toLocaleString()} FCFA</span>
              </div>
            </div>

            {retryCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Tentative {retryCount + 1}/3
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                <Smartphone className="mr-2 h-4 w-4" />
                Payer
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Processing */}
        {currentStep === 'processing' && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">En attente de confirmation</h3>
                <p className="text-sm text-muted-foreground">
                  Composez {config.ussdCode} sur votre téléphone
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-semibold">{formatTimeLeft()}</span>
              </div>
            </div>

            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                <strong>{config.name}</strong>
                <br />
                1. Composez {config.ussdCode} sur votre mobile
                <br />
                2. Suivez les instructions
                <br />
                3. Confirmez le paiement de {amount.toLocaleString()} FCFA
              </AlertDescription>
            </Alert>

            <p className="text-xs text-center text-muted-foreground">
              La transaction sera annulée automatiquement après 5 minutes
            </p>
          </div>
        )}

        {/* Step 3: Success */}
        {currentStep === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-bounce-subtle">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-green-700">Paiement confirmé !</h3>
              <p className="text-sm text-muted-foreground">
                {amount.toLocaleString()} FCFA crédités avec succès
              </p>
            </div>
            <Button onClick={handleSuccess} className="mt-4">
              Continuer
            </Button>
          </div>
        )}

        {/* Step 4: Failed */}
        {currentStep === 'failed' && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-red-700">Paiement échoué</h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage || 'Une erreur est survenue'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Réessayer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
