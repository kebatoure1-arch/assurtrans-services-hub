import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gift, Copy, Check, Clock, X } from 'lucide-react';
import { useState } from 'react';
import type { LoyaltyRedemption } from '../types';
import { useToast } from '@/hooks/use-toast';

interface RedemptionListProps {
  redemptions: LoyaltyRedemption[];
}

export function RedemptionList({ redemptions }: RedemptionListProps) {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const getStatusBadge = (status: string, usedDate?: string, expiryDate?: string) => {
    if (usedDate) {
      return <Badge variant="outline" className="border-gray-400 text-gray-600">Utilisé</Badge>;
    }

    if (expiryDate && new Date(expiryDate) < new Date()) {
      return <Badge variant="outline" className="border-red-400 text-red-600">Expiré</Badge>;
    }

    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: any }> = {
      pending: { variant: 'secondary', icon: Clock },
      approved: { variant: 'default', icon: Check },
      delivered: { variant: 'default', icon: Gift },
      cancelled: { variant: 'destructive', icon: X }
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {status === 'approved' ? 'Actif' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const copyVoucherCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Code copié",
      description: "Le code voucher a été copié dans le presse-papiers"
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  if (redemptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mes Échanges</CardTitle>
          <CardDescription>Vos récompenses échangées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun échange pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">
              Échangez vos points contre des récompenses
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes Échanges</CardTitle>
        <CardDescription>{redemptions.length} récompenses échangées</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {redemptions.map((redemption) => {
              const expired = isExpired(redemption.expiry_date);
              const used = !!redemption.used_date;

              return (
                <Card key={redemption._id} className={expired || used ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold">{redemption.reward_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {redemption.points_spent.toLocaleString()} points
                          </p>
                        </div>
                        {getStatusBadge(redemption.status, redemption.used_date, redemption.expiry_date)}
                      </div>

                      {/* Voucher Code */}
                      {!expired && !used && (
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Code Voucher</p>
                            <p className="font-mono font-bold text-lg tracking-wider">
                              {redemption.voucher_code}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyVoucherCode(redemption.voucher_code)}
                          >
                            {copiedCode === redemption.voucher_code ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Échangé le</p>
                          <p className="font-medium">{formatDate(redemption.created_at)}</p>
                        </div>
                        {used ? (
                          <div>
                            <p className="text-muted-foreground">Utilisé le</p>
                            <p className="font-medium">{formatDate(redemption.used_date!)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-muted-foreground">Expire le</p>
                            <p className={`font-medium ${expired ? 'text-red-600' : ''}`}>
                              {formatDate(redemption.expiry_date)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {redemption.notes && (
                        <div className="text-xs text-muted-foreground border-t pt-2">
                          <p>{redemption.notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
