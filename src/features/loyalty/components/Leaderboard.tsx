import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import type { LoyaltyAccount } from '../types';
import { TIER_CONFIGS } from '../types';

interface LeaderboardProps {
  leaders: LoyaltyAccount[];
  currentUserId?: string;
}

export function Leaderboard({ leaders, currentUserId }: LeaderboardProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500">🥇 1er</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400">🥈 2ème</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600">🥉 3ème</Badge>;
    return <Badge variant="outline">{rank}ème</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Classement Fidélité
        </CardTitle>
        <CardDescription>Les meilleurs membres de notre programme</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaders.map((leader, index) => {
            const rank = index + 1;
            const tierConfig = TIER_CONFIGS[leader.tier];
            const isCurrentUser = leader.user_id === currentUserId;

            return (
              <div
                key={leader._id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isCurrentUser 
                    ? 'bg-primary/5 border-primary shadow-sm' 
                    : 'bg-card hover:bg-accent/50'
                }`}
              >
                {/* Rank */}
                <div className="flex items-center justify-center w-10 shrink-0">
                  {getRankIcon(rank)}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate">
                      {isCurrentUser ? 'Vous' : `Membre ${leader.user_id.slice(-6)}`}
                    </p>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-xs">C'est vous!</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{ 
                        backgroundColor: tierConfig.color + '20', 
                        color: tierConfig.color,
                        borderColor: tierConfig.color
                      }}
                    >
                      {tierConfig.icon} {leader.tier.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {leader.lifetime_points.toLocaleString()} pts lifetime
                    </span>
                  </div>
                </div>

                {/* Rank Badge */}
                <div className="shrink-0">
                  {getRankBadge(rank)}
                </div>
              </div>
            );
          })}

          {leaders.length === 0 && (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucune donnée de classement</p>
              <p className="text-sm text-muted-foreground mt-1">
                Soyez le premier à gagner des points!
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
