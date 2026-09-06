import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Lock, Package } from 'lucide-react';
import type { LoyaltyReward, LoyaltyTier } from '../types';

interface RewardCardProps {
  reward: LoyaltyReward;
  userPoints: number;
  userTier: LoyaltyTier;
  onRedeem: (reward: LoyaltyReward) => void;
}

export function RewardCard({ reward, userPoints, userTier, onRedeem }: RewardCardProps) {
  const canAfford = userPoints >= reward.points_required;
  
  // Check tier requirement
  const tierOrder: Record<LoyaltyTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
  const hasNoTierRequirement = !reward.tier_required || reward.tier_required === '';
  const meetsRequirement = hasNoTierRequirement || 
    tierOrder[userTier] >= tierOrder[reward.tier_required as LoyaltyTier];

  const canRedeem = canAfford && meetsRequirement && reward.stock !== 0;

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      fuel_discount: 'Réduction Carburant',
      service_discount: 'Service',
      cash_voucher: 'Bon d\'achat',
      premium_upgrade: 'Premium',
      insurance_benefit: 'Assurance'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fuel_discount: 'bg-blue-500/10 text-blue-600 border-blue-200',
      service_discount: 'bg-green-500/10 text-green-600 border-green-200',
      cash_voucher: 'bg-amber-500/10 text-amber-600 border-amber-200',
      premium_upgrade: 'bg-purple-500/10 text-purple-600 border-purple-200',
      insurance_benefit: 'bg-rose-500/10 text-rose-600 border-rose-200'
    };
    return colors[category] || 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  return (
    <Card className={`flex flex-col ${!canRedeem ? 'opacity-60' : ''} hover:shadow-lg transition-shadow`}>
      {/* Image */}
      {reward.image_url && (
        <div className="aspect-video relative overflow-hidden bg-muted">
          <img 
            src={reward.image_url} 
            alt={reward.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {reward.stock > 0 && reward.stock <= 10 && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              <Package className="h-3 w-3 mr-1" />
              {reward.stock} restants
            </Badge>
          )}
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{reward.name}</CardTitle>
          <Badge variant="outline" className={getCategoryColor(reward.category)}>
            {getCategoryLabel(reward.category)}
          </Badge>
        </div>
        <CardDescription>{reward.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Points Required */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Points requis</span>
          <span className="text-xl font-bold text-primary">{reward.points_required.toLocaleString()}</span>
        </div>

        {/* Value Display */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Valeur</span>
          <span className="font-semibold">
            {reward.value_type === 'percentage' 
              ? `${reward.value}%` 
              : `${reward.value.toLocaleString()} FCFA`}
          </span>
        </div>

        {/* Tier Requirement */}
        {!hasNoTierRequirement && (
          <div className="flex items-center gap-2 text-xs">
            {meetsRequirement ? (
              <Badge variant="secondary" className="text-xs">
                <Gift className="h-3 w-3 mr-1" />
                {reward.tier_required.toUpperCase()}+
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-destructive text-destructive">
                <Lock className="h-3 w-3 mr-1" />
                Nécessite {reward.tier_required.toUpperCase()}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button 
          className="w-full" 
          disabled={!canRedeem}
          onClick={() => onRedeem(reward)}
        >
          {!meetsRequirement ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Niveau requis
            </>
          ) : reward.stock === 0 ? (
            'Épuisé'
          ) : !canAfford ? (
            `${(reward.points_required - userPoints).toLocaleString()} points manquants`
          ) : (
            <>
              <Gift className="h-4 w-4 mr-2" />
              Échanger
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
