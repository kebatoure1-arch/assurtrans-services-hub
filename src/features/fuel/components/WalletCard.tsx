// Wallet Card - Display wallet balance and quick actions

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, Plus, Eye, EyeOff } from 'lucide-react';
import { getUserWallet } from '../services/wallet-service';
import { Wallet as WalletType } from '../types';

interface WalletCardProps {
  onDeposit?: () => void;
  onViewTransactions?: () => void;
}

export function WalletCard({ onDeposit, onViewTransactions }: WalletCardProps) {
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const data = await getUserWallet();
      setWallet(data);
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="h-16 w-16 mb-4 opacity-80" />
          <p className="text-lg font-semibold mb-2">Portefeuille non disponible</p>
          <p className="text-sm opacity-90">Impossible de charger votre portefeuille</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary to-primary/80 text-white overflow-hidden relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Wallet className="h-5 w-5" />
            Mon Portefeuille
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setBalanceVisible(!balanceVisible)}
          >
            {balanceVisible ? (
              <Eye className="h-5 w-5" />
            ) : (
              <EyeOff className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        {/* Balance Display */}
        <div>
          <p className="text-sm opacity-90 mb-2">Solde disponible</p>
          {balanceVisible ? (
            <p className="text-4xl font-bold tracking-tight">
              {wallet.balance.toLocaleString()} <span className="text-2xl">XOF</span>
            </p>
          ) : (
            <p className="text-4xl font-bold tracking-tight">••••••</p>
          )}
        </div>

        {/* Limits Info */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-xs opacity-80 mb-1">Limite journalière</p>
            <p className="text-sm font-semibold">
              {wallet.dailyLimit.toLocaleString()} XOF
            </p>
          </div>
          <div>
            <p className="text-xs opacity-80 mb-1">Limite mensuelle</p>
            <p className="text-sm font-semibold">
              {wallet.monthlyLimit.toLocaleString()} XOF
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            className="flex-1 bg-white text-primary hover:bg-white/90"
            onClick={onDeposit}
          >
            <Plus className="h-4 w-4 mr-2" />
            Recharger
          </Button>
          <Button
            variant="ghost"
            className="flex-1 text-white border-white/40 hover:bg-white/20"
            onClick={onViewTransactions}
          >
            Historique
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
