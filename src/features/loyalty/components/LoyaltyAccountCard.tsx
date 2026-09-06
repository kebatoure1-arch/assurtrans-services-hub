import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Award } from 'lucide-react';
import type { LoyaltyAccount } from '../types';
import { TIER_CONFIGS } from '../types';

interface LoyaltyAccountCardProps {
  account: LoyaltyAccount;
}

export function LoyaltyAccountCard({ account }: LoyaltyAccountCardProps) {
  const tierConfig = TIER_CONFIGS[account.tier];

  return (
    <Card className="relative overflow-hidden">
      {/* Background gradient based on tier */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          background: `linear-gradient(135deg, ${tierConfig.color} 0%, transparent 100%)`
        }}
      />

      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Programme Fidélité
            </CardTitle>
            <CardDescription>Votre compte et avantages</CardDescription>
          </div>
          <Badge 
            variant="secondary"
            className="text-lg font-semibold px-3 py-1"
            style={{ backgroundColor: tierConfig.color + '20', color: tierConfig.color }}
          >
            {tierConfig.icon} {account.tier.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 relative">
        {/* Points Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Points disponibles</p>
            <p className="text-3xl font-bold text-primary">{account.available_points.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Points totaux gagnés</p>
            <p className="text-2xl font-semibold">{account.lifetime_points.toLocaleString()}</p>
          </div>
        </div>

        {/* Tier Progress */}
        {account.next_tier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression vers {account.next_tier.toUpperCase()}</span>
              <span className="font-medium">{account.tier_progress}%</span>
            </div>
            <Progress value={account.tier_progress} className="h-2" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Plus que {account.points_to_next_tier.toLocaleString()} points</span>
            </div>
          </div>
        )}

        {/* Tier Benefits */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Award className="h-4 w-4 text-primary" />
            <span>Vos avantages {account.tier.toUpperCase()}</span>
          </div>
          <ul className="space-y-1">
            {tierConfig.benefits.map((benefit, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
