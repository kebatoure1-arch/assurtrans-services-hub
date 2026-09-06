import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Gift, History, Trophy, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import type { LoyaltyAccount, LoyaltyReward, LoyaltyTransaction, LoyaltyRedemption } from '@/features/loyalty/types';
import { LoyaltyAccountCard } from '@/features/loyalty/components/LoyaltyAccountCard';
import { RewardCard } from '@/features/loyalty/components/RewardCard';
import { TransactionHistory } from '@/features/loyalty/components/TransactionHistory';
import { RedemptionList } from '@/features/loyalty/components/RedemptionList';
import { Leaderboard } from '@/features/loyalty/components/Leaderboard';
import { RedeemRewardDialog } from '@/features/loyalty/components/RedeemRewardDialog';
import { 
  getOrCreateLoyaltyAccount, 
  getUserTransactions,
  getLeaderboard 
} from '@/features/loyalty/services/loyalty-account-service';
import { 
  getActiveRewards, 
  redeemReward,
  getUserRedemptions,
  seedRewards 
} from '@/features/loyalty/services/loyalty-reward-service';

export default function LoyaltyPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('rewards');
  
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [leaders, setLeaders] = useState<LoyaltyAccount[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);

  useEffect(() => {
    loadLoyaltyData();
  }, [user]);

  const loadLoyaltyData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load account
      const accountData = await getOrCreateLoyaltyAccount(user.uid);
      setAccount(accountData);

      // Load rewards
      const rewardsData = await getActiveRewards(accountData?.tier);
      setRewards(rewardsData);

      // Load transactions
      const transactionsData = await getUserTransactions(user.uid);
      setTransactions(transactionsData);

      // Load redemptions
      const redemptionsData = await getUserRedemptions(user.uid);
      setRedemptions(redemptionsData);

      // Load leaderboard
      const leadersData = await getLeaderboard(10);
      setLeaders(leadersData);
    } catch (error) {
      console.error('Error loading loyalty data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de fidélité",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedRewards = async () => {
    setIsSeeding(true);
    try {
      await seedRewards();
      toast({
        title: "Récompenses créées",
        description: "Le catalogue de récompenses a été initialisé avec succès"
      });
      await loadLoyaltyData();
    } catch (error) {
      console.error('Error seeding rewards:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer les récompenses",
        variant: "destructive"
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleRedeemClick = (reward: LoyaltyReward) => {
    setSelectedReward(reward);
    setIsRedeemDialogOpen(true);
  };

  const handleConfirmRedeem = async (reward: LoyaltyReward) => {
    if (!user?.uid || !account) {
      return { success: false, message: 'Utilisateur non connecté' };
    }

    const result = await redeemReward(user.uid, reward._id, account.available_points);
    
    if (result.success) {
      // Reload data
      await loadLoyaltyData();
    }

    return result;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground">Chargement de votre programme fidélité...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                Programme Fidélité
              </h1>
              <p className="text-muted-foreground mt-1">
                Gagnez des points et profitez de récompenses exclusives
              </p>
            </div>
            {user?.activeRole === 'admin' && rewards.length === 0 && (
              <Button onClick={handleSeedRewards} disabled={isSeeding}>
                {isSeeding ? 'Création...' : 'Créer récompenses initiales'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Account Card */}
          <div className="lg:col-span-1">
            {account ? (
              <LoyaltyAccountCard account={account} />
            ) : (
              <div className="text-center p-6 border rounded-lg">
                <p className="text-muted-foreground">Chargement de votre compte...</p>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="rewards" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  <span className="hidden sm:inline">Récompenses</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Historique</span>
                </TabsTrigger>
                <TabsTrigger value="redemptions" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  <span className="hidden sm:inline">Mes Échanges</span>
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">Classement</span>
                </TabsTrigger>
              </TabsList>

              {/* Rewards Tab */}
              <TabsContent value="rewards" className="mt-6">
                {rewards.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {rewards.map((reward) => (
                      <RewardCard
                        key={reward._id}
                        reward={reward}
                        userPoints={account?.available_points || 0}
                        userTier={account?.tier || 'bronze'}
                        onRedeem={handleRedeemClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-lg">
                    <Gift className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">Aucune récompense disponible</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Les récompenses apparaîtront ici bientôt
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-6">
                <TransactionHistory transactions={transactions} />
              </TabsContent>

              {/* Redemptions Tab */}
              <TabsContent value="redemptions" className="mt-6">
                <RedemptionList redemptions={redemptions} />
              </TabsContent>

              {/* Leaderboard Tab */}
              <TabsContent value="leaderboard" className="mt-6">
                <Leaderboard leaders={leaders} currentUserId={user?.uid} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Redeem Dialog */}
      <RedeemRewardDialog
        reward={selectedReward}
        isOpen={isRedeemDialogOpen}
        onClose={() => {
          setIsRedeemDialogOpen(false);
          setSelectedReward(null);
        }}
        onConfirm={handleConfirmRedeem}
        userPoints={account?.available_points || 0}
      />
    </div>
  );
}
