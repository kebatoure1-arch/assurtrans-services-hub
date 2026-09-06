import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InsuranceClaim } from '../types';
import { insuranceClaimService } from '../services/insurance-claim-service';
import { FileText, Search, Calendar, DollarSign, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClaimsListProps {
  driverId?: string;
  policyId?: string;
  onSelectClaim?: (claim: InsuranceClaim) => void;
  onReviewClaim?: (claim: InsuranceClaim) => void;
  showReviewActions?: boolean;
}

export function ClaimsList({
  driverId,
  policyId,
  onSelectClaim,
  onReviewClaim,
  showReviewActions = false,
}: ClaimsListProps) {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadClaims();
  }, [driverId, policyId]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      let result: InsuranceClaim[];
      if (driverId) {
        result = await insuranceClaimService.getClaimsByDriver(driverId);
      } else if (policyId) {
        result = await insuranceClaimService.getClaimsByPolicy(policyId);
      } else {
        result = await insuranceClaimService.getAllClaims();
      }
      // Sort by most recent first
      result.sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime());
      setClaims(result);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: InsuranceClaim['status']) => {
    const variants: Record<InsuranceClaim['status'], { className: string; label: string }> = {
      submitted: { className: 'bg-blue-100 text-blue-700', label: 'Soumis' },
      under_review: { className: 'bg-yellow-100 text-yellow-700', label: 'En révision' },
      approved: { className: 'bg-green-100 text-green-700', label: 'Approuvé' },
      rejected: { className: 'bg-red-100 text-red-700', label: 'Rejeté' },
      paid: { className: 'bg-purple-100 text-purple-700', label: 'Payé' },
    };
    const config = variants[status];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getClaimTypeLabel = (type: InsuranceClaim['claimType']) => {
    const labels: Record<InsuranceClaim['claimType'], string> = {
      consultation: 'Consultation',
      hospitalization: 'Hospitalisation',
      medication: 'Médicaments',
      emergency: 'Urgence',
      dental: 'Dentaire',
      optical: 'Optique',
      other: 'Autre',
    };
    return labels[type];
  };

  const filteredClaims = claims.filter((claim) =>
    claim.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    claim.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    claim.providerName.toLowerCase().includes(searchQuery.toLowerCase())
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
          placeholder="Rechercher par numéro, chauffeur ou prestataire..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Claims Cards */}
      {filteredClaims.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucune réclamation trouvée</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClaims.map((claim) => (
            <Card key={claim._id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{claim.claimNumber}</h3>
                    {getStatusBadge(claim.status)}
                    <Badge variant="outline">{getClaimTypeLabel(claim.claimType)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{claim.driverName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Building2 className="w-4 h-4" />
                    {claim.providerName}
                  </p>
                </div>
                <div className="flex gap-2">
                  {showReviewActions && claim.status === 'submitted' && onReviewClaim && (
                    <Button
                      size="sm"
                      onClick={() => onReviewClaim(claim)}
                    >
                      Examiner
                    </Button>
                  )}
                  {onSelectClaim && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectClaim(claim)}
                    >
                      Voir détails
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Montant réclamé</p>
                  <p className="font-medium flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {claim.claimAmount.toLocaleString()} XOF
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Montant approuvé</p>
                  <p className={`font-medium ${claim.approvedAmount > 0 ? 'text-green-600' : ''}`}>
                    {claim.approvedAmount.toLocaleString()} XOF
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date de l'incident</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(claim.incidentDate), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date de soumission</p>
                  <p className="font-medium">
                    {format(new Date(claim.submittedDate), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              {/* Diagnosis */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-1">Diagnostic:</p>
                <p className="text-sm text-muted-foreground">{claim.diagnosis}</p>
              </div>

              {/* Rejection Reason */}
              {claim.status === 'rejected' && claim.rejectionReason && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Raison du rejet:</p>
                      <p className="text-sm text-red-700">{claim.rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Approved Amount */}
              {claim.status === 'approved' && claim.approvedAmount > 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-green-900">
                      Réclamation approuvée pour {claim.approvedAmount.toLocaleString()} XOF
                    </p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
