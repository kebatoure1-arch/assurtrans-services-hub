/**
 * System Health Card Component - Display system health status
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, HardDrive, Bell, CreditCard, Activity } from 'lucide-react';
import type { SystemHealth } from '../types';

interface SystemHealthCardProps {
  health: SystemHealth;
}

export function SystemHealthCard({ health }: SystemHealthCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Opérationnel';
      case 'warning':
        return 'Attention';
      case 'error':
        return 'Erreur';
      default:
        return 'Inconnu';
    }
  };

  const services = [
    { name: 'Base de données', icon: Database, status: health.database },
    { name: 'Stockage', icon: HardDrive, status: health.storage },
    { name: 'Notifications', icon: Bell, status: health.notifications },
    { name: 'Paiements', icon: CreditCard, status: health.payments }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <CardTitle>État du système</CardTitle>
        </div>
        <CardDescription>
          Statut des services en temps réel
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div key={service.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)} animate-pulse`} />
                  <Badge variant={service.status === 'healthy' ? 'default' : service.status === 'warning' ? 'secondary' : 'destructive'}>
                    {getStatusText(service.status)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
