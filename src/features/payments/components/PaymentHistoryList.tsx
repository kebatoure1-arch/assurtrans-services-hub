import { useEffect, useState } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getUserPayments } from '../services/payment-service';
import type { Payment } from '../types';

const PROVIDER_ICONS: Record<string, string> = {
  mtn: '📱',
  orange: '🍊',
  wave: '🌊',
};

const STATUS_CONFIG = {
  pending: {
    label: 'En attente',
    variant: 'secondary' as const,
    icon: Clock,
  },
  completed: {
    label: 'Complété',
    variant: 'default' as const,
    icon: CheckCircle2,
  },
  failed: {
    label: 'Échoué',
    variant: 'destructive' as const,
    icon: XCircle,
  },
};

const PURPOSE_LABELS = {
  wallet_deposit: 'Rechargement portefeuille',
  order_payment: 'Paiement commande',
  insurance_premium: 'Prime d\'assurance',
};

export function PaymentHistoryList() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredPayments(
        payments.filter(
          (payment) =>
            payment.phone_number.includes(query) ||
            payment.transaction_id.toLowerCase().includes(query) ||
            PURPOSE_LABELS[payment.purpose].toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredPayments(payments);
    }
  }, [searchQuery, payments]);

  const loadPayments = async () => {
    try {
      const data = await getUserPayments();
      setPayments(data);
      setFilteredPayments(data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'historique des paiements',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun paiement effectué</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des paiements</CardTitle>
        <Input
          placeholder="Rechercher par numéro, transaction, motif..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-4"
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Aucun paiement trouvé pour "{searchQuery}"
              </p>
            </div>
          ) : (
            filteredPayments.map((payment) => {
              const statusConfig = STATUS_CONFIG[payment.status];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={payment._id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                      {PROVIDER_ICONS[payment.provider]}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">
                        {PURPOSE_LABELS[payment.purpose]}
                      </p>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{payment.phone_number}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(payment.created_at)}
                      </span>
                    </div>
                    {payment.transaction_id && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {payment.transaction_id}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="font-bold text-lg">
                      {payment.amount.toLocaleString()} <span className="text-sm">FCFA</span>
                    </p>
                    <Button variant="ghost" size="sm" className="h-8 px-2 mt-1">
                      Détails
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
