import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InsurancePolicy } from '../types';
import { insurancePolicyService } from '../services/insurance-policy-service';
import { FileText, Search, Calendar, DollarSign, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PolicyListProps {
  driverId?: string;
  fleetId?: string;
  onSelectPolicy?: (policy: InsurancePolicy) => void;
}

export function PolicyList({ driverId, fleetId, onSelectPolicy }: PolicyListProps) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPolicies();
  }, [driverId, fleetId]);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      let result: InsurancePolicy[];
      if (driverId) {
        result = await insurancePolicyService.getPoliciesByDriver(driverId);
      } else if (fleetId) {
        result = await insurancePolicyService.getPoliciesByFleet(fleetId);
      } else {
        result = await insurancePolicyService.getAllPolicies();
      }
      setPolicies(result);
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: InsurancePolicy['status']) => {
    const variants: Record<InsurancePolicy['status'], string> = {
      active: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      suspended: 'bg-orange-100 text-orange-700',
      expired: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<InsurancePolicy['status'], string> = {
      active: 'Actif',
      pending: 'En attente',
      suspended: 'Suspendu',
      expired: 'Expiré',
      cancelled: 'Annulé',
    };
    return (
      <Badge className={variants[status]}>{labels[status]}</Badge>
    );
  };

  const isPaymentDue = (policy: InsurancePolicy) => {
    const nextPayment = new Date(policy.nextPaymentDue);
    const today = new Date();
    return policy.status === 'active' && nextPayment <= today;
  };

  const filteredPolicies = policies.filter((policy) =>
    policy.policyNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    policy.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    policy.planName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Rechercher par numéro de police, chauffeur ou plan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Policy Cards */}
      {filteredPolicies.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucune police d'assurance trouvée</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPolicies.map((policy) => (
            <Card key={policy._id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{policy.policyNumber}</h3>
                    {getStatusBadge(policy.status)}
                    {isPaymentDue(policy) && (
                      <Badge className="bg-red-100 text-red-700">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Paiement dû
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {policy.driverName}
                  </p>
                </div>
                {onSelectPolicy && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPolicy(policy)}
                  >
                    Voir détails
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan</p>
                  <p className="font-medium">{policy.planName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Prime</p>
                  <p className="font-medium flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {policy.premiumAmount.toLocaleString()} XOF
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {policy.paymentFrequency === 'monthly' ? 'par mois' : 'par an'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date d'expiration</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(policy.endDate), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Prochain paiement</p>
                  <p className={`font-medium ${isPaymentDue(policy) ? 'text-red-600' : ''}`}>
                    {format(new Date(policy.nextPaymentDue), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total payé:</span>
                  <span className="font-semibold">{policy.totalPaid.toLocaleString()} XOF</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
