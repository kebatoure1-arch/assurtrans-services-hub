import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { insurancePolicyService } from '../services/insurance-policy-service';
import { InsurancePlan, EnrollPolicyInput } from '../types';
import { Loader2 } from 'lucide-react';

interface EnrollPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: InsurancePlan | null;
  driverId?: string;
  driverName?: string;
  fleetId?: string;
  onSuccess?: () => void;
}

export function EnrollPolicyDialog({
  open,
  onOpenChange,
  selectedPlan,
  driverId,
  driverName,
  fleetId,
  onSuccess,
}: EnrollPolicyDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    paymentFrequency: 'monthly' as 'monthly' | 'annual',
    beneficiary: '',
    beneficiaryRelation: '',
    beneficiaryPhone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlan) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un plan d\'assurance',
        variant: 'destructive',
      });
      return;
    }

    if (!driverId || !driverName) {
      toast({
        title: 'Erreur',
        description: 'Informations du chauffeur manquantes',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 year policy

      const nextPaymentDue = new Date(startDate);
      if (formData.paymentFrequency === 'monthly') {
        nextPaymentDue.setMonth(nextPaymentDue.getMonth() + 1);
      } else {
        nextPaymentDue.setFullYear(nextPaymentDue.getFullYear() + 1);
      }

      const enrollData: EnrollPolicyInput = {
        driverId,
        driverName,
        fleetId,
        planId: selectedPlan._id,
        planName: selectedPlan.planName,
        premiumAmount:
          formData.paymentFrequency === 'monthly'
            ? selectedPlan.monthlyPremium
            : selectedPlan.annualPremium,
        paymentFrequency: formData.paymentFrequency,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        nextPaymentDue: nextPaymentDue.toISOString(),
        beneficiary: formData.beneficiary,
        beneficiaryRelation: formData.beneficiaryRelation,
        beneficiaryPhone: formData.beneficiaryPhone,
      };

      await insurancePolicyService.enrollPolicy(enrollData);

      toast({
        title: 'Succès',
        description: 'Inscription à l\'assurance santé réussie',
      });

      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setFormData({
        paymentFrequency: 'monthly',
        beneficiary: '',
        beneficiaryRelation: '',
        beneficiaryPhone: '',
      });
    } catch (error) {
      console.error('Error enrolling policy:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'inscrire à l\'assurance',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscription à l'assurance santé</DialogTitle>
          <DialogDescription>
            Inscrivez un chauffeur au plan {selectedPlan?.planName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Summary */}
          {selectedPlan && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">{selectedPlan.planName}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Mensuel</p>
                  <p className="font-semibold">
                    {selectedPlan.monthlyPremium.toLocaleString()} XOF
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Annuel</p>
                  <p className="font-semibold">
                    {selectedPlan.annualPremium.toLocaleString()} XOF
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Couverture max</p>
                  <p className="font-semibold">
                    {selectedPlan.maxCoverage.toLocaleString()} XOF
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Franchise</p>
                  <p className="font-semibold">
                    {selectedPlan.deductible.toLocaleString()} XOF
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Frequency */}
          <div className="space-y-2">
            <Label htmlFor="paymentFrequency">Fréquence de paiement *</Label>
            <Select
              value={formData.paymentFrequency}
              onValueChange={(value: 'monthly' | 'annual') =>
                setFormData({ ...formData, paymentFrequency: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensuel</SelectItem>
                <SelectItem value="annual">Annuel (économisez plus)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Beneficiary Information */}
          <div className="space-y-4">
            <h3 className="font-semibold">Informations du bénéficiaire</h3>
            
            <div className="space-y-2">
              <Label htmlFor="beneficiary">Nom complet du bénéficiaire *</Label>
              <Input
                id="beneficiary"
                value={formData.beneficiary}
                onChange={(e) =>
                  setFormData({ ...formData, beneficiary: e.target.value })
                }
                placeholder="Nom et prénom"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="beneficiaryRelation">Relation avec le bénéficiaire *</Label>
              <Select
                value={formData.beneficiaryRelation}
                onValueChange={(value) =>
                  setFormData({ ...formData, beneficiaryRelation: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conjoint(e)">Conjoint(e)</SelectItem>
                  <SelectItem value="Enfant">Enfant</SelectItem>
                  <SelectItem value="Parent">Parent</SelectItem>
                  <SelectItem value="Frère/Sœur">Frère/Sœur</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="beneficiaryPhone">Téléphone du bénéficiaire *</Label>
              <Input
                id="beneficiaryPhone"
                type="tel"
                value={formData.beneficiaryPhone}
                onChange={(e) =>
                  setFormData({ ...formData, beneficiaryPhone: e.target.value })
                }
                placeholder="+221XXXXXXXXX"
                required
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Inscrire
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
