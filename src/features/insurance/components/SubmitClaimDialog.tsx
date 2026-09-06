import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { insuranceClaimService } from '../services/insurance-claim-service';
import { healthProviderService } from '../services/health-provider-service';
import { InsurancePolicy, HealthProvider, SubmitClaimInput } from '../types';
import { Loader2 } from 'lucide-react';

interface SubmitClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: InsurancePolicy | null;
  onSuccess?: () => void;
}

export function SubmitClaimDialog({
  open,
  onOpenChange,
  policy,
  onSuccess,
}: SubmitClaimDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<HealthProvider[]>([]);
  const [formData, setFormData] = useState({
    claimType: 'consultation' as SubmitClaimInput['claimType'],
    claimAmount: '',
    incidentDate: '',
    providerId: '',
    providerName: '',
    diagnosis: '',
    treatment: '',
  });

  useEffect(() => {
    if (open) {
      loadProviders();
    }
  }, [open]);

  const loadProviders = async () => {
    const result = await healthProviderService.getAllProviders();
    setProviders(result);
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((p) => p._id === providerId);
    setFormData({
      ...formData,
      providerId,
      providerName: provider?.providerName || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!policy) {
      toast({
        title: 'Erreur',
        description: 'Aucune police d\'assurance sélectionnée',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const claimData: SubmitClaimInput = {
        policyId: policy._id,
        policyNumber: policy.policyNumber,
        driverId: policy.driverId,
        driverName: policy.driverName,
        claimType: formData.claimType,
        claimAmount: parseFloat(formData.claimAmount),
        incidentDate: new Date(formData.incidentDate).toISOString(),
        providerId: formData.providerId || undefined,
        providerName: formData.providerName,
        diagnosis: formData.diagnosis,
        treatment: formData.treatment,
        documents: [], // File upload can be added in future
      };

      await insuranceClaimService.submitClaim(claimData);

      toast({
        title: 'Succès',
        description: 'Réclamation soumise avec succès',
      });

      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setFormData({
        claimType: 'consultation',
        claimAmount: '',
        incidentDate: '',
        providerId: '',
        providerName: '',
        diagnosis: '',
        treatment: '',
      });
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la réclamation',
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
          <DialogTitle>Soumettre une réclamation</DialogTitle>
          <DialogDescription>
            Police: {policy?.policyNumber} - {policy?.planName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Claim Type */}
          <div className="space-y-2">
            <Label htmlFor="claimType">Type de réclamation *</Label>
            <Select
              value={formData.claimType}
              onValueChange={(value: any) =>
                setFormData({ ...formData, claimType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="hospitalization">Hospitalisation</SelectItem>
                <SelectItem value="medication">Médicaments</SelectItem>
                <SelectItem value="emergency">Urgence</SelectItem>
                <SelectItem value="dental">Dentaire</SelectItem>
                <SelectItem value="optical">Optique</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Claim Amount */}
          <div className="space-y-2">
            <Label htmlFor="claimAmount">Montant réclamé (XOF) *</Label>
            <Input
              id="claimAmount"
              type="number"
              value={formData.claimAmount}
              onChange={(e) =>
                setFormData({ ...formData, claimAmount: e.target.value })
              }
              placeholder="50000"
              required
            />
          </div>

          {/* Incident Date */}
          <div className="space-y-2">
            <Label htmlFor="incidentDate">Date de l'incident *</Label>
            <Input
              id="incidentDate"
              type="date"
              value={formData.incidentDate}
              onChange={(e) =>
                setFormData({ ...formData, incidentDate: e.target.value })
              }
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Health Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Prestataire de santé</Label>
            <Select
              value={formData.providerId}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un prestataire" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider._id} value={provider._id}>
                    {provider.providerName} - {provider.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.providerId && (
              <Input
                placeholder="Ou entrez le nom manuellement"
                value={formData.providerName}
                onChange={(e) =>
                  setFormData({ ...formData, providerName: e.target.value })
                }
              />
            )}
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnostic *</Label>
            <Textarea
              id="diagnosis"
              value={formData.diagnosis}
              onChange={(e) =>
                setFormData({ ...formData, diagnosis: e.target.value })
              }
              placeholder="Description du diagnostic médical"
              rows={3}
              required
            />
          </div>

          {/* Treatment */}
          <div className="space-y-2">
            <Label htmlFor="treatment">Traitement reçu *</Label>
            <Textarea
              id="treatment"
              value={formData.treatment}
              onChange={(e) =>
                setFormData({ ...formData, treatment: e.target.value })
              }
              placeholder="Description du traitement et des soins reçus"
              rows={3}
              required
            />
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="text-blue-900">
              <strong>Note:</strong> Assurez-vous d'avoir tous les documents nécessaires
              (factures, ordonnances, rapports médicaux) avant de soumettre votre réclamation.
              Vous pourrez les télécharger après la soumission initiale.
            </p>
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
              Soumettre
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
