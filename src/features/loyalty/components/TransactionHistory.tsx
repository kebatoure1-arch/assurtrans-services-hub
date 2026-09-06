import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import type { LoyaltyTransaction } from '../types';

interface TransactionHistoryProps {
  transactions: LoyaltyTransaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const getTransactionIcon = (type: string) => {
    return type === 'earned' ? TrendingUp : TrendingDown;
  };

  const getTransactionColor = (type: string) => {
    return type === 'earned' 
      ? 'text-green-600 bg-green-50 border-green-200' 
      : 'text-red-600 bg-red-50 border-red-200';
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      fuel_purchase: 'Achat carburant',
      insurance_payment: 'Paiement assurance',
      referral: 'Parrainage',
      bonus: 'Bonus',
      redemption: 'Échange'
    };
    return labels[source] || source;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des Points</CardTitle>
          <CardDescription>Toutes vos transactions de fidélité</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucune transaction pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vos points gagnés et échangés apparaîtront ici
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des Points</CardTitle>
        <CardDescription>{transactions.length} transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const Icon = getTransactionIcon(transaction.type);
              const isEarned = transaction.type === 'earned';

              return (
                <div 
                  key={transaction._id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-full ${getTransactionColor(transaction.type)}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{transaction.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getSourceLabel(transaction.source)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(transaction.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-bold ${isEarned ? 'text-green-600' : 'text-red-600'}`}>
                          {isEarned ? '+' : ''}{transaction.points.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solde: {transaction.balance_after.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
