// Deposit Dialog - Wallet top-up interface with Mobile Money integration

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Wallet } from 'lucide-react';
import { depositToWallet } from '../services/wallet-service';
import { MobileMoneyDialogEnhanced } from '@/features/payments/components/MobileMoneyDialogEnhanced';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const quickAmounts = [5000, 10000, 25000, 50000, 100000, 200000];

export function DepositDialog({ open, onOpenChange, onSuccess }: DepositDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [depositReferenceId, setDepositReferenceId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const depositAmount = parseFloat(amount);
    if (!depositAmount || depositAmount <= 0) {
      toast({
        title: 'Montant invalide',
        description: 'Veuillez entrer un montant valide',
        variant: 'destructive'
      });
      return;
    }

    if (depositAmount < 1000) {
      toast({
        title: 'Montant minimum',
        description: 'Le montant minimum de dépôt est de 1,000 FCFA',
        variant: 'destructive'
      });
      return;
    }

    // Generate reference ID for this deposit
    const refId = `DEP-${Date.now()}`;
    setDepositReferenceId(refId);
    
    // Close amount dialog and open payment dialog
    onOpenChange(false);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = async () => {
    try {
      const depositAmount = parseFloat(amount);
      
      // Record deposit in wallet (payment already recorded by payment service)
      await depositToWallet(
        depositAmount,
        'mobile_money_wave', // This is just for legacy compatibility
        depositReferenceId
      );

      toast({
        title: 'Dépôt réussi',
        description: `${depositAmount.toLocaleString()} FCFA ont été ajoutés à votre portefeuille`
      });

      // Reset form
      setAmount('');
      setDepositReferenceId('');
      
      onSuccess?.();
    } catch (error) {
      console.error('Error recording deposit:', error);
      toast({
        title: 'Erreur',
        description: 'Paiement effectué mais erreur lors de l\'enregistrement',
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Recharger le Portefeuille
            </DialogTitle>
            <DialogDescription>
              Choisissez le montant à recharger via Mobile Money
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quick Amount Selection */}
            <div className="space-y-3">
              <Label>Montants rapides</Label>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    type="button"
                    variant={amount === quickAmount.toString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    className="text-sm"
                  >
                    {(quickAmount / 1000).toFixed(0)}K
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Montant personnalisé (FCFA) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                min="1000"
                step="100"
                placeholder="Ex: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Montant minimum: 1,000 FCFA
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Continuer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mobile Money Payment Dialog */}
      <MobileMoneyDialogEnhanced
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        amount={parseFloat(amount) || 0}
        purpose="wallet_deposit"
        referenceId={depositReferenceId}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
}
