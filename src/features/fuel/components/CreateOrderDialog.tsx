// Create Order Dialog - Fuel Order Creation

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Fuel, Plus } from 'lucide-react';
import { getActiveFuelProducts } from '../services/product-service';
import { createOrder } from '../services/order-service';
import { deductFromWallet, getWalletBalance } from '../services/wallet-service';
import { getVehiclesByFleet } from '@/features/fleet/services/vehicle-service';
import { Product } from '../types';
import { Vehicle } from '@/features/fleet/types';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateOrderDialog({ open, onOpenChange, onSuccess }: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  
  const [formData, setFormData] = useState({
    vehicleId: '',
    productId: '',
    quantity: '',
    notes: ''
  });

  // Load products, vehicles, and wallet balance
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [productsData, vehiclesData, balance] = await Promise.all([
        getActiveFuelProducts(),
        getVehiclesByFleet(),
        getWalletBalance()
      ]);
      
      setProducts(productsData);
      setVehicles(vehiclesData);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive'
      });
    } finally {
      setLoadingData(false);
    }
  };

  const selectedProduct = products.find(p => p._id === formData.productId);
  const selectedVehicle = vehicles.find(v => v._id === formData.vehicleId);
  const quantity = parseFloat(formData.quantity) || 0;
  const totalAmount = selectedProduct ? quantity * selectedProduct.basePrice : 0;
  const hasEnoughBalance = totalAmount <= walletBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vehicleId || !formData.productId || !formData.quantity) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive'
      });
      return;
    }

    if (!hasEnoughBalance) {
      toast({
        title: 'Solde insuffisant',
        description: 'Veuillez recharger votre portefeuille',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create order
      await createOrder({
        vehicleId: formData.vehicleId,
        vehicleRegistration: selectedVehicle?.registration || '',
        productId: formData.productId,
        productName: selectedProduct?.name || '',
        quantity,
        unitPrice: selectedProduct?.basePrice || 0,
        notes: formData.notes
      });

      // Deduct from wallet
      await deductFromWallet(
        totalAmount,
        '', // orderId will be set by backend
        `Commande de ${quantity}L de ${selectedProduct?.name}`
      );

      toast({
        title: 'Commande créée',
        description: 'Votre commande a été créée avec succès'
      });

      // Reset form
      setFormData({
        vehicleId: '',
        productId: '',
        quantity: '',
        notes: ''
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la commande',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            Nouvelle Commande de Carburant
          </DialogTitle>
          <DialogDescription>
            Créez une commande de carburant pour vos véhicules
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Wallet Balance */}
            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-sm text-muted-foreground">Solde disponible</p>
              <p className="text-2xl font-bold text-primary">
                {walletBalance.toLocaleString()} XOF
              </p>
            </div>

            {/* Vehicle Selection */}
            <div className="space-y-2">
              <Label htmlFor="vehicleId">
                Véhicule <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un véhicule" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle._id} value={vehicle._id}>
                      {vehicle.registration} - {vehicle.brand} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="productId">
                Type de Carburant <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.productId}
                onValueChange={(value) => setFormData({ ...formData, productId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un carburant" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name} - {product.basePrice.toLocaleString()} XOF/L
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantité (Litres) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="0.01"
                placeholder="Ex: 50"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>

            {/* Total Amount */}
            {totalAmount > 0 && (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Montant Total</span>
                  <span className="text-xl font-bold text-primary">
                    {totalAmount.toLocaleString()} XOF
                  </span>
                </div>
                {!hasEnoughBalance && (
                  <p className="mt-2 text-sm text-destructive">
                    Solde insuffisant. Veuillez recharger votre portefeuille.
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                placeholder="Instructions spéciales..."
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !hasEnoughBalance}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Créer la Commande
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
