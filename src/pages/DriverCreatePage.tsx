/**
 * Driver Create Page
 * Form to create a new driver in the system
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDriver, type NewDriverInput } from '@/services/driver-service';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Truck, UserPlus, Loader2 } from 'lucide-react';

const DriverCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<NewDriverInput>({
    name: '',
    email: '',
    phone: '',
    vehicleRegistration: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.phone) {
      toast({
        title: 'Champs manquants',
        description: 'Le nom et le téléphone du chauffeur sont obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const driver = await createDriver(form);

      toast({
        title: '✅ Chauffeur créé',
        description: `Le chauffeur ${driver.name} a été ajouté avec succès.`,
      });

      // Redirect to drivers list or dashboard
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de créer le chauffeur.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container max-w-2xl mx-auto px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </button>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Ajouter un Chauffeur</CardTitle>
              <CardDescription className="text-sm">
                Créez un nouveau profil chauffeur pour Assur'Trans.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Nom complet */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Nom complet <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex : Mamadou Ndiaye"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              {/* Téléphone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Téléphone <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="Ex : 77 123 45 67"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email <span className="text-slate-400">(optionnel)</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Ex : chauffeur@assurtrans.com"
                  value={form.email}
                  onChange={handleChange}
                  className="h-11"
                />
              </div>

              {/* Immatriculation */}
              <div className="space-y-2">
                <Label htmlFor="vehicleRegistration" className="text-sm font-medium">
                  Immatriculation du véhicule{' '}
                  <span className="text-slate-400">(optionnel)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="vehicleRegistration"
                    name="vehicleRegistration"
                    placeholder="Ex : DK-1234-AB"
                    value={form.vehicleRegistration}
                    onChange={handleChange}
                    className="h-11"
                  />
                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                  className="min-w-[100px]"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-w-[180px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Enregistrer le chauffeur
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Help card */}
        <Card className="mt-4 border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Astuce :</strong> Après la création, le chauffeur
              pourra se connecter avec son email via le système OTP. Il aura
              accès à son tableau de bord personnel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverCreatePage;
