import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { LoyaltyReward, LoyaltyRedemption } from '../types';

interface RedeemRewardDialogProps {
  reward: LoyaltyReward | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reward: LoyaltyReward) => Promise<{ success: boolean; message: string; voucher?: LoyaltyRedemption }>;
  userPoints: number;
}

export function RedeemRewardDialog({
  reward,
  isOpen,
  onClose,
  onConfirm,
  userPoints
}: RedeemRewardDialogProps) {
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redemptionResult, setRedemptionResult] = useState<{ success: boolean; message: string; voucher?: LoyaltyRedemption } | null>(null);

  if (!reward) return null;

  const handleConfirm = async () => {
    setIsRedeeming(true);
    const result = await onConfirm(reward);
    setRedemptionResult(result);
    setIsRedeeming(false);
  };

  const handleClose = () => {
    setRedemptionResult(null);
    onClose();
  };

  const pointsAfterRedemption = userPoints - reward.points_required;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!redemptionResult ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Confirmer l'échange
              </DialogTitle>
              <DialogDescription>
                Vérifiez les détails avant d'échanger vos points
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Reward Details */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-lg">{reward.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{reward.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Points requis</p>
                    <p className="font-bold text-primary text-lg">
                      {reward.points_required.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valeur</p>
                    <p className="font-semibold text-lg">
                      {reward.value_type === 'percentage' 
                        ? `${reward.value}%` 
                        : `${reward.value.toLocaleString()} FCFA`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Points Balance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Points actuels</span>
                  <span className="font-semibold">{userPoints.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Points à déduire</span>
                  <span className="font-semibold text-red-600">
                    -{reward.points_required.toLocaleString()}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Nouveau solde</span>
                  <span className="font-bold text-lg text-primary">
                    {pointsAfterRedemption.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Terms */}
              {reward.terms && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {reward.terms}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose} disabled={isRedeeming}>
                Annuler
              </Button>
              <Button onClick={handleConfirm} disabled={isRedeeming}>
                {isRedeeming ? 'Échange en cours...' : 'Confirmer l\'échange'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {redemptionResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Échange réussi!
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Échec de l'échange
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Alert variant={redemptionResult.success ? 'default' : 'destructive'}>
                <AlertDescription>
                  {redemptionResult.message}
                </AlertDescription>
              </Alert>

              {redemptionResult.success && redemptionResult.voucher && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Votre code voucher</p>
                    <p className="font-mono font-bold text-xl tracking-wider text-primary">
                      {redemptionResult.voucher.voucher_code}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Présentez ce code lors de l'utilisation</p>
                    <p>• Valide jusqu'au {new Date(redemptionResult.voucher.expiry_date).toLocaleDateString('fr-FR')}</p>
                    <p>• Retrouvez ce code dans "Mes Échanges"</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
