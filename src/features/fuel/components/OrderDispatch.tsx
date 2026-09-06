// Order Dispatch - For Petroliers to dispatch orders to stations

import { useState, useEffect } from 'react';
import { Send, MapPin, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Order } from '../types';
import { Station } from '../types';
import { getPendingOrders, dispatchOrder } from '../services/order-service';
import { getActiveStations } from '../services/station-service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function OrderDispatch() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, stationsData] = await Promise.all([
        getPendingOrders(),
        getActiveStations(),
      ]);
      setOrders(ordersData);
      setStations(stationsData);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedOrder || !selectedStation) return;

    const station = stations.find(s => s._id === selectedStation);
    if (!station) return;

    try {
      setDispatching(true);
      await dispatchOrder(
        selectedOrder._id,
        selectedOrder._uid,
        station._id,
        station.stationName
      );

      toast({
        title: 'Succès',
        description: `Commande dispatché à ${station.stationName}`,
      });

      setSelectedOrder(null);
      setSelectedStation('');
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de dispatcher la commande',
        variant: 'destructive',
      });
    } finally {
      setDispatching(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Chargement des commandes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Dispatch des Commandes</h2>
        <p className="text-muted-foreground">
          Assignez les commandes en attente aux stations
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En Attente</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stations Actives</p>
              <p className="text-2xl font-bold">{stations.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taux de Dispatch</p>
              <p className="text-2xl font-bold">
                {stations.length > 0 ? Math.round((orders.length / stations.length) * 100) / 100 : 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-2">
            <div className="text-muted-foreground">Aucune commande en attente</div>
            <p className="text-sm text-muted-foreground">
              Les nouvelles commandes apparaîtront ici
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order._id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{order.orderNumber}</h3>
                    <Badge variant="secondary">{order.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Client: </span>
                      <span className="font-medium">{order.customerName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Véhicule: </span>
                      <span className="font-medium">{order.vehicleRegistration}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Produit: </span>
                      <span className="font-medium">{order.productName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quantité: </span>
                      <span className="font-medium">{order.quantity} L</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Montant: </span>
                      <span className="font-medium text-primary">{formatPrice(order.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="font-medium">
                        {format(new Date(order.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">{order.notes}</p>
                    </div>
                  )}
                </div>

                <Button onClick={() => setSelectedOrder(order)}>
                  <Send className="mr-2 h-4 w-4" />
                  Dispatcher
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dispatch Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatcher la Commande</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedOrder && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="font-semibold">{selectedOrder.orderNumber}</div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Produit: </span>
                    <span>{selectedOrder.productName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantité: </span>
                    <span>{selectedOrder.quantity} L</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Véhicule: </span>
                    <span>{selectedOrder.vehicleRegistration}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Sélectionner une Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une station..." />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station._id} value={station._id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{station.stationName}</span>
                        <span className="text-xs text-muted-foreground">
                          {station.city} • {station.stationType}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {stations.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Aucune station active disponible. Veuillez créer une station d'abord.
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Annuler
              </Button>
              <Button
                onClick={handleDispatch}
                disabled={!selectedStation || dispatching}
              >
                {dispatching ? 'Dispatch...' : 'Confirmer le Dispatch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
