// Product Management - For Petroliers to manage fuel, oil, and service catalog

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Product, ProductType } from '../types';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../services/product-service';

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    productType: 'fuel' as ProductType,
    name: '',
    category: '',
    unit: 'liters',
    basePrice: '',
    description: '',
    isActive: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, filterType]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les produits',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const seedInitialProducts = async () => {
    try {
      const initialProducts = [
        // Fuel products
        { name: 'Essence Super', productType: 'fuel' as ProductType, category: 'Carburant', unit: 'liters', basePrice: 650, description: 'Essence sans plomb 95', isActive: 'active' as const },
        { name: 'Gasoil', productType: 'fuel' as ProductType, category: 'Carburant', unit: 'liters', basePrice: 580, description: 'Diesel pour véhicules', isActive: 'active' as const },
        { name: 'Essence Ordinaire', productType: 'fuel' as ProductType, category: 'Carburant', unit: 'liters', basePrice: 600, description: 'Essence standard', isActive: 'active' as const },
        // Oil products
        { name: 'Huile Moteur 5W30', productType: 'oil' as ProductType, category: 'Lubrifiants', unit: 'liters', basePrice: 8500, description: 'Huile synthétique premium', isActive: 'active' as const },
        { name: 'Huile Moteur 10W40', productType: 'oil' as ProductType, category: 'Lubrifiants', unit: 'liters', basePrice: 7000, description: 'Huile semi-synthétique', isActive: 'active' as const },
        // Services
        { name: 'Vidange Complete', productType: 'service' as ProductType, category: 'Services', unit: 'service', basePrice: 15000, description: 'Vidange avec changement filtre', isActive: 'active' as const },
        { name: 'Lavage Premium', productType: 'service' as ProductType, category: 'Services', unit: 'service', basePrice: 5000, description: 'Lavage intérieur et extérieur', isActive: 'active' as const },
      ];

      for (const product of initialProducts) {
        await createProduct(product);
      }

      toast({
        title: 'Succès',
        description: `${initialProducts.length} produits initialisés`,
      });
      
      loadProducts();
    } catch (error) {
      console.error('Error seeding products:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'initialiser les produits',
        variant: 'destructive',
      });
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.productType === filterType);
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProduct) {
        await updateProduct(editingProduct._id, editingProduct._uid, {
          ...formData,
          basePrice: parseFloat(formData.basePrice),
        });
        toast({
          title: 'Succès',
          description: 'Produit modifié avec succès',
        });
      } else {
        await createProduct({
          ...formData,
          basePrice: parseFloat(formData.basePrice),
        });
        toast({
          title: 'Succès',
          description: 'Produit créé avec succès',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le produit',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${product.name} ?`)) return;

    try {
      await deleteProduct(product._id, product._uid);
      toast({
        title: 'Succès',
        description: 'Produit supprimé avec succès',
      });
      loadProducts();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le produit',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      productType: product.productType,
      name: product.name,
      category: product.category,
      unit: product.unit,
      basePrice: product.basePrice.toString(),
      description: product.description,
      isActive: product.isActive,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      productType: 'fuel',
      name: '',
      category: '',
      unit: 'liters',
      basePrice: '',
      description: '',
      isActive: 'active',
    });
  };

  const getProductTypeColor = (type: ProductType) => {
    const colors = {
      fuel: 'bg-blue-500',
      oil: 'bg-orange-500',
      service: 'bg-purple-500',
    };
    return colors[type];
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
        <div className="text-muted-foreground">Chargement des produits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Catalogue de Produits</h2>
          <p className="text-muted-foreground">Gérez vos carburants, huiles et services</p>
        </div>
        <div className="flex gap-2">
          {products.length === 0 && (
            <Button variant="outline" onClick={seedInitialProducts}>
              Initialiser Catalogue
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Produit
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Modifier le Produit' : 'Nouveau Produit'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de Produit</Label>
                  <Select
                    value={formData.productType}
                    onValueChange={(value: ProductType) =>
                      setFormData({ ...formData, productType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fuel">Carburant</SelectItem>
                      <SelectItem value="oil">Huile</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nom du Produit</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Gasoil, Super 91"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Input
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: diesel, premium"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="liters">Litres</SelectItem>
                      <SelectItem value="units">Unités</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prix de Base (XOF)</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={formData.isActive}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setFormData({ ...formData, isActive: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails et spécifications du produit"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingProduct ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="fuel">Carburants</SelectItem>
            <SelectItem value="oil">Huiles</SelectItem>
            <SelectItem value="service">Services</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            {searchTerm || filterType !== 'all'
              ? 'Aucun produit trouvé'
              : 'Aucun produit. Commencez par créer votre catalogue.'}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <Card key={product._id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getProductTypeColor(product.productType)}`} />
                      <h3 className="font-semibold">{product.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
                  </div>
                  <Badge variant={product.isActive === 'active' ? 'default' : 'secondary'}>
                    {product.isActive === 'active' ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(product.basePrice)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ {product.unit}</span>
                </div>

                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(product)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(product)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
