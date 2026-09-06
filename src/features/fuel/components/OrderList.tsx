// Order List - Display and manage orders

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Fuel, Clock, CheckCircle2, XCircle, Truck, Eye } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { getCustomerOrders } from '../services/order-service';
import { OrderDetailsDialog } from './OrderDetailsDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'En attente', color: 'bg-yellow-500', icon: Clock },
  dispatched: { label: 'Assignée', color: 'bg-blue-500', icon: Truck },
  in_progress: { label: 'En cours', color: 'bg-indigo-500', icon: Fuel },
  completed: { label: 'Terminée', color: 'bg-green-500', icon: CheckCircle2 },
  cancelled: { label: 'Annulée', color: 'bg-red-500', icon: XCircle }
};

interface OrderListProps {
  onOrderSelect?: (order: Order) => void;
  statusFilter?: string;
}

export function OrderList({ onOrderSelect, statusFilter: initialStatusFilter }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getCustomerOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vehicleRegistration.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsDialogOpen(true);
    onOrderSelect?.(order);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Fuel className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Vous n'avez pas encore de commandes. Créez votre première commande de carburant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro, véhicule, produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="dispatched">Assignée</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="grid gap-4">
        {filteredOrders.map((order) => {
          const StatusIcon = statusConfig[order.status].icon;
          
          return (
            <Card key={order._id} className="hover:shadow-md transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">
                      {order.orderNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`${statusConfig[order.status].color} text-white border-0`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[order.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Véhicule</p>
                    <p className="font-medium">{order.vehicleRegistration}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Produit</p>
                    <p className="font-medium">{order.productName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Quantité</p>
                    <p className="font-medium">{order.quantity} L</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Montant Total</p>
                    <p className="font-bold text-primary">{order.totalAmount.toLocaleString()} XOF</p>
                  </div>
                  {order.stationName && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Station</p>
                      <p className="font-medium">{order.stationName}</p>
                    </div>
                  )}
                  {order.validationCode && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Code de Validation</p>
                      <p className="text-2xl font-bold text-primary tracking-wider">
                        {order.validationCode}
                      </p>
                    </div>
                  )}
                </div>
                
                {onOrderSelect && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onOrderSelect(order)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir les détails
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun résultat</h3>
            <p className="text-sm text-muted-foreground">
              Aucune commande ne correspond à vos critères de recherche.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
