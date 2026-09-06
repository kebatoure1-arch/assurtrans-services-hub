/**
 * Create Setting Dialog Component - Form to create new system settings
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import type { SettingFormData, SettingCategory, SettingDataType } from '../types';

interface CreateSettingDialogProps {
  onSubmit: (data: SettingFormData) => Promise<void>;
}

export function CreateSettingDialog({ onSubmit }: CreateSettingDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SettingFormData>({
    setting_key: '',
    setting_value: '',
    category: 'platform',
    data_type: 'string',
    description: '',
    is_public: 'no'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setOpen(false);
      // Reset form
      setFormData({
        setting_key: '',
        setting_value: '',
        category: 'platform',
        data_type: 'string',
        description: '',
        is_public: 'no'
      });
    } catch (error) {
      console.error('Error creating setting:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau paramètre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer un paramètre système</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau paramètre de configuration système
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setting_key">Clé du paramètre *</Label>
            <Input
              id="setting_key"
              value={formData.setting_key}
              onChange={(e) => setFormData({ ...formData, setting_key: e.target.value })}
              placeholder="ex: platform.name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as SettingCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">Plateforme</SelectItem>
                  <SelectItem value="fuel">Carburant</SelectItem>
                  <SelectItem value="insurance">Assurance</SelectItem>
                  <SelectItem value="loyalty">Fidélité</SelectItem>
                  <SelectItem value="payment">Paiement</SelectItem>
                  <SelectItem value="security">Sécurité</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_type">Type de données *</Label>
              <Select
                value={formData.data_type}
                onValueChange={(value) => setFormData({ ...formData, data_type: value as SettingDataType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">Texte</SelectItem>
                  <SelectItem value="number">Nombre</SelectItem>
                  <SelectItem value="boolean">Booléen</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setting_value">Valeur *</Label>
            <Input
              id="setting_value"
              value={formData.setting_value}
              onChange={(e) => setFormData({ ...formData, setting_value: e.target.value })}
              type={formData.data_type === 'number' ? 'number' : 'text'}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description du paramètre"
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_public"
              checked={formData.is_public === 'yes'}
              onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked ? 'yes' : 'no' })}
            />
            <Label htmlFor="is_public">Visible publiquement</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer le paramètre'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
