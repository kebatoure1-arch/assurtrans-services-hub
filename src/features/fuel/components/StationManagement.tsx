// Station Management - For Petroliers to manage their station network

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';
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
import { Station, StationType } from '../types';
import { getPetrolierStations, createStation, updateStation, deleteStation } from '../services/station-service';

export function StationManagement() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    stationName: '',
    stationType: 'total' as StationType,
    address: '',
    city: '',
    phone: '',
    email: '',
    operatingHours: '06:00-22:00',
    fuelCapacity: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance',
  });

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    try {
      setLoading(true);
      const data = await getPetrolierStations();
      setStations(data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les stations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get current user ID for petrolier_id
    const authStorage = localStorage.getItem('auth-storage');
    if (!authStorage) {
      toast({
        title: 'Erreur',
        description: 'Utilisateur non authentifié',
        variant: 'destructive',
      });
      return;
    }
    const parsed = JSON.parse(authStorage);
    const userId = parsed.state?.user?.uid;

    try {
      if (editingStation) {
        await updateStation(editingStation._id, editingStation._uid, {
          ...formData,
          fuelCapacity: parseFloat(formData.fuelCapacity),
        });
        toast({
          title: 'Succès',
          description: 'Station modifiée avec succès',
        });
      } else {
        await createStation({
          ...formData,
          petrolier_id: userId,
          country: 'Sénégal',
          fuelCapacity: parseFloat(formData.fuelCapacity),
          servicesOffered: JSON.stringify(['fuel']),
        });
        toast({
          title: 'Succès',
          description: 'Station créée avec succès',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadStations();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder la station',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (station: Station) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${station.stationName} ?`)) return;

    try {
      await deleteStation(station._id, station._uid);
      toast({
        title: 'Succès',
        description: 'Station supprimée avec succès',
      });
      loadStations();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la station',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (station: Station) => {
    setEditingStation(station);
    setFormData({
      stationName: station.stationName,
      stationType: station.stationType,
      address: station.address,
      city: station.city,
      phone: station.phone,
      email: station.email,
      operatingHours: station.operatingHours,
      fuelCapacity: station.fuelCapacity.toString(),
      status: station.status,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingStation(null);
    setFormData({
      stationName: '',
      stationType: 'total',
      address: '',
      city: '',
      phone: '',
      email: '',
      operatingHours: '06:00-22:00',
      fuelCapacity: '',
      status: 'active',
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500',
      inactive: 'bg-gray-500',
      maintenance: 'bg-yellow-500',
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Chargement des stations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Réseau de Stations</h2>
          <p className="text-muted-foreground">Gérez vos stations de service</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStation ? 'Modifier la Station' : 'Nouvelle Station'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la Station</Label>
                  <Input
                    required
                    value={formData.stationName}
                    onChange={(e) => setFormData({ ...formData, stationName: e.target.value })}
                    placeholder="Ex: Station Total Dakar"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type de Station</Label>
                  <Select
                    value={formData.stationType}
                    onValueChange={(value: StationType) =>
                      setFormData({ ...formData, stationType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="shell">Shell</SelectItem>
                      <SelectItem value="oryx">Oryx</SelectItem>
                      <SelectItem value="independant">Indépendant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Adresse</Label>
                  <Input
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Adresse complète"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Ex: Dakar"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+221XXXXXXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="station@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Horaires</Label>
                  <Input
                    required
                    value={formData.operatingHours}
                    onChange={(e) => setFormData({ ...formData, operatingHours: e.target.value })}
                    placeholder="06:00-22:00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Capacité Carburant (L)</Label>
                  <Input
                    required
                    type="number"
                    value={formData.fuelCapacity}
                    onChange={(e) => setFormData({ ...formData, fuelCapacity: e.target.value })}
                    placeholder="50000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'inactive' | 'maintenance') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingStation ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stations Grid */}
      {stations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            Aucune station. Commencez par créer votre réseau.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stations.map((station) => (
            <Card key={station._id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{station.stationName}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{station.stationType}</p>
                  </div>
                  <Badge variant={station.status === 'active' ? 'default' : 'secondary'}>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(station.status)} mr-1`} />
                    {station.status === 'active' ? 'Active' : station.status === 'maintenance' ? 'Maintenance' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{station.address}, {station.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{station.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">{station.email}</span>
                  </div>
                </div>

                <div className="pt-2 border-t text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacité:</span>
                    <span className="font-medium">{station.fuelCapacity.toLocaleString()} L</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Horaires:</span>
                    <span className="font-medium">{station.operatingHours}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(station)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(station)}
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
