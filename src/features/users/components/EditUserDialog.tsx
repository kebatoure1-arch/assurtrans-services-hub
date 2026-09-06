import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { userService } from '../services/user-service';
import type { User } from '../types';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  allowedRoles: string[];
  onSuccess: () => void;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  agent: 'Agent Assur\'Trans',
  petrolier: 'Pétrolier',
  station: 'Station-Service',
  fleet: 'Chef de Flotte',
  driver: 'Chauffeur'
};

export function EditUserDialog({ 
  open, 
  onOpenChange, 
  user,
  allowedRoles,
  onSuccess 
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    role: '',
    companyName: '',
    address: '',
    city: '',
    country: 'Sénégal',
    status: 'active' as 'active' | 'inactive' | 'suspended'
  });
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyName: user.companyName || '',
        address: user.address || '',
        city: user.city || '',
        country: user.country || 'Sénégal',
        status: user.status
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validation
    if (!formData.email || !formData.phone || !formData.firstName || !formData.lastName) {
      toast({
        title: 'Erreur de validation',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: 'Erreur de validation',
        description: 'Veuillez entrer une adresse email valide',
        variant: 'destructive',
      });
      return;
    }

    // Phone validation (basic)
    if (formData.phone.length < 8) {
      toast({
        title: 'Erreur de validation',
        description: 'Veuillez entrer un numéro de téléphone valide',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await userService.updateUser(user._uid, user._id, formData);
      
      toast({
        title: 'Succès',
        description: 'Utilisateur modifié avec succès',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier l\'utilisateur',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'Utilisateur</DialogTitle>
          <DialogDescription>
            Mettez à jour les informations de l'utilisateur
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* First Name */}
          <div className="space-y-2">
            <Label htmlFor="firstName">
              Prénom <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
              placeholder="Jean"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="lastName">
              Nom <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lastName"
              placeholder="Dupont"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="jean.dupont@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">
              Téléphone <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+221 77 123 45 67"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Rôle <span className="text-red-500">*</span>
            </Label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              disabled={loading}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {allowedRoles.map(role => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>

          {/* Company (optional) */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Entreprise</Label>
            <Input
              id="companyName"
              placeholder="Nom de l'entreprise"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Address (optional) */}
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              placeholder="Adresse complète"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* City (optional) */}
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              placeholder="Dakar"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Statut</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              disabled={loading}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                'Modifier'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
