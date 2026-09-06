import { useState } from 'react';
import { Loader2, Smartphone, Check, X } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { initiatePayment } from '../services/payment-service';
import type { MobileMoneyProvider } from '../types';

interface MobileMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  purpose: 'wallet_deposit' | 'order_payment' | 'insurance_premium';
  referenceId: string;
  onSuccess?: () => void;
}

const PROVIDER_CONFIG = {
  mtn: {
    name: 'MTN Mobile Money',
    color: 'bg-yellow-500',
    icon: '📱',
    prefixes: ['77', '78', '76'],
  },
  orange: {
    name: 'Orange Money',
    color: 'bg-orange-500',
    icon: '🍊',
    prefixes: ['70', '75', '79'],
  },
  wave: {
    name: 'Wave',
    color: 'bg-blue-500',
    icon: '🌊',
    prefixes: ['71', '72', '73'],
  },
};

export function MobileMoneyDialog({
  open,
  onOpenChange,
  amount,
  purpose,
  referenceId,
  onSuccess,
}: MobileMoneyDialogProps) {
  const [provider, setProvider] = useState<MobileMoneyProvider>('mtn');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber || phoneNumber.length < 9) {
      toast({
        title: 'Erreur',
        description: 'Veuillez saisir un numéro de téléphone valide',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const payment = await initiatePayment({
        amount,
        provider,
        phoneNumber,
        purpose,
        referenceId,
      });

      // Simulate payment processing (in real implementation, this would poll the payment status)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate successful payment (in production, check actual payment status)
      setPaymentStatus('success');
      
      toast({
        title: 'Paiement réussi',
        description: `${amount.toLocaleString()} FCFA ont été payés avec succès`,
      });

      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
        resetForm();
      }, 1500);
    } catch (error) {
      setPaymentStatus('failed');
      toast({
        title: 'Échec du paiement',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
      
      setTimeout(() => {
        setPaymentStatus('pending');
        setIsProcessing(false);
      }, 2000);
    }
  };

  const resetForm = () => {
    setProvider('mtn');
    setPhoneNumber('');
    setPaymentStatus('pending');
    setIsProcessing(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!isProcessing) {
      onOpenChange(open);
      if (!open) resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paiement Mobile Money</DialogTitle>
          <DialogDescription>
            Payez {amount.toLocaleString()} FCFA via Mobile Money
          </DialogDescription>
        </DialogHeader>

        {paymentStatus === 'pending' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="provider">Opérateur</Label>
              <Select
                value={provider}
                onValueChange={(value) => setProvider(value as MobileMoneyProvider)}
                disabled={isProcessing}
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  maxLength={9}
                  disabled={isProcessing}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Préfixes acceptés: {PROVIDER_CONFIG[provider].prefixes.join(', ')}
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
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
                <span className="font-bold text-lg">{amount.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isProcessing}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isProcessing} className="flex-1">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Payer
                  </>
                )}
              </Button>
            </div>

            {isProcessing && (
              <div className="rounded-lg bg-muted p-4 text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm font-medium">
                  Vérifiez votre téléphone pour confirmer le paiement
                </p>
                <p className="text-xs text-muted-foreground">
                  Composez *XXX# et suivez les instructions
                </p>
              </div>
            )}
          </form>
        )}

        {paymentStatus === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Paiement réussi !</h3>
              <p className="text-sm text-muted-foreground">
                Votre transaction a été effectuée avec succès
              </p>
            </div>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <X className="h-8 w-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Paiement échoué</h3>
              <p className="text-sm text-muted-foreground">
                Une erreur est survenue lors du paiement
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
