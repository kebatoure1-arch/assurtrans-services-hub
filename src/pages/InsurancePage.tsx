import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth-store';
import { InsurancePlanCard } from '@/features/insurance/components/InsurancePlanCard';
import { EnrollPolicyDialog } from '@/features/insurance/components/EnrollPolicyDialog';
import { PolicyList } from '@/features/insurance/components/PolicyList';
import { SubmitClaimDialog } from '@/features/insurance/components/SubmitClaimDialog';
import { ClaimsList } from '@/features/insurance/components/ClaimsList';
import { insurancePlanService } from '@/features/insurance/services/insurance-plan-service';
import { healthProviderService } from '@/features/insurance/services/health-provider-service';
import { InsurancePlan, InsurancePolicy } from '@/features/insurance/types';
import {
  Heart,
  FileText,
  Shield,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InsurancePage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const result = await insurancePlanService.getAllPlans();
      setPlans(result);
    } catch (error) {
      console.error('Error loading insurance plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await insurancePlanService.seedPlans();
      await healthProviderService.seedProviders();
      
      toast({
        title: 'Succès',
        description: 'Plans d\'assurance et prestataires créés avec succès',
      });
      
      await loadPlans();
    } catch (error) {
      console.error('Error seeding data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer les données initiales',
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleSelectPlan = (plan: InsurancePlan) => {
    setSelectedPlan(plan);
    if (user?.activeRole === 'driver') {
      setShowEnrollDialog(true);
    }
  };

  const handleSelectPolicy = (policy: InsurancePolicy) => {
    setSelectedPolicy(policy);
  };

  const handleSubmitClaim = (policy: InsurancePolicy) => {
    setSelectedPolicy(policy);
    setShowClaimDialog(true);
  };

  const isDriver = user?.activeRole === 'driver';
  const isFleetManager = user?.activeRole === 'fleet_manager';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Assurance Santé</h1>
              <p className="text-muted-foreground">
                Protection santé complète pour les chauffeurs
              </p>
            </div>
          </div>

          {/* Seed Button (only for admin/agent) */}
          {(user?.activeRole === 'admin' || user?.activeRole === 'assur_agent') && plans.length === 0 && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">
                      Créer les plans d'assurance initiaux
                    </p>
                    <p className="text-sm text-blue-700">
                      Cliquez pour créer les plans Basic, Standard, Premium et Famille
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {seeding ? 'Création...' : 'Créer les plans'}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="plans">
              <Shield className="w-4 h-4 mr-2" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="policies">
              <FileText className="w-4 h-4 mr-2" />
              Mes polices
            </TabsTrigger>
            <TabsTrigger value="claims">
              <Heart className="w-4 h-4 mr-2" />
              Réclamations
            </TabsTrigger>
          </TabsList>

          {/* Insurance Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Plans d'assurance disponibles</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : plans.length === 0 ? (
              <Card className="p-8 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Aucun plan d'assurance disponible pour le moment
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {plans.map((plan) => (
                  <InsurancePlanCard
                    key={plan._id}
                    plan={plan}
                    onSelect={handleSelectPlan}
                    selected={selectedPlan?._id === plan._id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Mes polices d'assurance</h2>
              {isDriver && (
                <Button
                  onClick={() => setShowEnrollDialog(true)}
                  disabled={plans.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle inscription
                </Button>
              )}
            </div>

            <PolicyList
              driverId={isDriver ? user?.uid : undefined}
              fleetId={isFleetManager ? user?.uid : undefined}
              onSelectPolicy={handleSelectPolicy}
            />
          </TabsContent>

          {/* Claims Tab */}
          <TabsContent value="claims" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Mes réclamations</h2>
            </div>

            <ClaimsList
              driverId={isDriver ? user?.uid : undefined}
              onSelectClaim={(claim) => console.log('Selected claim:', claim)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <EnrollPolicyDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
        selectedPlan={selectedPlan}
        driverId={user?.uid}
        driverName={user?.name || ''}
        onSuccess={() => {
          // Refresh policies list
          window.location.reload();
        }}
      />

      <SubmitClaimDialog
        open={showClaimDialog}
        onOpenChange={setShowClaimDialog}
        policy={selectedPolicy}
        onSuccess={() => {
          // Refresh claims list
          window.location.reload();
        }}
      />
    </div>
  );
}
