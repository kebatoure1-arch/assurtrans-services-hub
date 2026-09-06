import { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { offlineSyncService } from '@/services/offline-sync-service';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(offlineSyncService.getOnlineStatus());
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0, completed: 0 });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineSyncService.subscribe((online) => {
      setIsOnline(online);
      updateSyncStatus();
    });

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const updateSyncStatus = () => {
    setSyncStatus(offlineSyncService.getSyncStatus());
  };

  const handleRetrySync = async () => {
    await offlineSyncService.retryFailed();
    updateSyncStatus();
  };

  const handleClearCompleted = () => {
    offlineSyncService.clearCompleted();
    updateSyncStatus();
  };

  const hasPendingChanges = syncStatus.pending > 0 || syncStatus.failed > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'relative h-9 gap-2',
            !isOnline && 'text-orange-500'
          )}
        >
          {isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4 animate-pulse" />
          )}
          <span className="text-sm">
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
          {hasPendingChanges && (
            <Badge 
              variant={syncStatus.failed > 0 ? 'destructive' : 'secondary'}
              className="h-5 px-1.5 text-xs"
            >
              {syncStatus.pending + syncStatus.failed}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  Connexion active
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-orange-500" />
                  Mode hors ligne
                </>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isOnline ? (
                'Vous êtes connecté. Toutes les données sont synchronisées.'
              ) : (
                'Vous travaillez hors ligne. Vos modifications seront synchronisées lors de la reconnexion.'
              )}
            </p>
          </div>

          {hasPendingChanges && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-sm font-medium">État de synchronisation</h4>
              
              <div className="space-y-2">
                {syncStatus.pending > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">En attente</span>
                    <Badge variant="secondary">{syncStatus.pending}</Badge>
                  </div>
                )}
                
                {syncStatus.failed > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      Échecs
                    </span>
                    <Badge variant="destructive">{syncStatus.failed}</Badge>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {syncStatus.failed > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetrySync}
                    disabled={!isOnline}
                    className="flex-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Réessayer
                  </Button>
                )}
                {syncStatus.completed > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearCompleted}
                    className="flex-1"
                  >
                    Nettoyer
                  </Button>
                )}
              </div>
            </div>
          )}

          {!isOnline && (
            <div className="pt-3 border-t">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-800">
                  💡 <strong>Astuce:</strong> Vous pouvez continuer à travailler normalement. Vos modifications seront automatiquement synchronisées.
                </p>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
