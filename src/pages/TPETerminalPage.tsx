/**
 * TPE Terminal Page
 * 
 * Dedicated page for OLA ENERGY station staff to process
 * card payments via TPE terminal.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TPETerminal from '@/features/payments/components/TPETerminal';
import { useAuthStore } from '@/store/auth-store';
import { table } from '@devvai/devv-code-backend';

const STATIONS_TABLE_ID = 'f4f5fpwkqagg';

export default function TPETerminalPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stationData, setStationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStationData();
  }, [user]);

  const loadStationData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get station for current user (station operator)
      const result = await table.getItems(STATIONS_TABLE_ID, {
        query: { operatorId: user.uid || user.id },
        limit: 1,
      });

      const station = result?.items?.[0];

      if (station) {
        setStationData(station);
      } else {
        // Default station data (fallback)
        setStationData({
          _id: 'STATION-DEFAULT',
          name: 'OLA ENERGY Station',
          operatorId: user.uid || user.id,
        });
      }

    } catch (err: any) {
      console.warn('⚠️ Failed to load station data:', err?.message);
      // Default station data (fallback)
      setStationData({
        _id: 'STATION-DEFAULT',
        name: 'OLA ENERGY Station',
        operatorId: user?.uid || user?.id,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  // Generate terminal ID from user ID (last 6 chars)
  const terminalId = `TPE-${(user?.uid || user?.id || '000000').slice(-6).toUpperCase()}`;
  const stationId = stationData?._id || 'STATION-DEFAULT';
  const stationName = stationData?.name || 'OLA ENERGY Station';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Terminal de Paiement</h1>
                <p className="text-sm text-muted-foreground">
                  Traiter les paiements par carte bancaire
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TPE Terminal */}
      <div className="container max-w-3xl mx-auto px-4 py-6">
        <TPETerminal
          terminalId={terminalId}
          stationId={stationId}
          stationName={stationName}
        />
      </div>
    </div>
  );
}
