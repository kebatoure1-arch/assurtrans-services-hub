import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { UserRole } from '@/features/users/types';
import {
  Shield,
  Users,
  Building2,
  Store,
  Truck,
  User,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface RoleSelectionDialogProps {
  open: boolean;
  onComplete: (role: UserRole) => Promise<void>;
}

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const roleOptions: RoleOption[] = [
  {
    value: 'admin',
    label: 'Administrateur',
    description: 'Gestion complète de la plateforme',
    icon: Shield,
    color: 'text-purple-600',
  },
  {
    value: 'agent',
    label: 'Agent',
    description: 'Gestion des pétroliers et revenus',
    icon: Users,
    color: 'text-blue-600',
  },
  {
    value: 'petrolier',
    label: 'Pétrolier',
    description: 'Gestion du réseau de stations',
    icon: Building2,
    color: 'text-emerald-600',
  },
  {
    value: 'station',
    label: 'Station-service',
    description: 'Gestion des livraisons',
    icon: Store,
    color: 'text-orange-600',
  },
  {
    value: 'fleet',
    label: 'Chef de flotte',
    description: 'Gestion de véhicules et chauffeurs',
    icon: Truck,
    color: 'text-indigo-600',
  },
  {
    value: 'driver',
    label: 'Chauffeur',
    description: 'Commandes carburant et assurance',
    icon: User,
    color: 'text-teal-600',
  },
];

export default function RoleSelectionDialog({
  open,
  onComplete,
}: RoleSelectionDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [isLoading, setIsLoading] = useState(false);

  // Debug log when component mounts/updates
  console.log('🎭 RoleSelectionDialog rendered with:', { open, selectedRole, isLoading });

  const handleComplete = async () => {
    if (!selectedRole) {
      console.log('⚠️ No role selected, cannot proceed');
      return;
    }

    console.log('🚀 Creating profile with role:', selectedRole);
    setIsLoading(true);
    try {
      await onComplete(selectedRole);
      console.log('✅ Profile creation completed');
    } catch (error) {
      console.error('❌ Failed to create profile:', error);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {
      console.log('🚫 Dialog close prevented (non-closable)');
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              <Sparkles className="w-16 h-16 text-primary relative z-10" />
            </div>
          </div>
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            Bienvenue sur Assur'Trans !
          </DialogTitle>
          <DialogDescription className="text-base">
            Pour personnaliser votre expérience, veuillez choisir votre rôle
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <RadioGroup
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as UserRole)}
            className="grid gap-3"
          >
            {roleOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedRole === option.value;

              return (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className="cursor-pointer"
                >
                  <Card
                    className={`
                      p-4 transition-all duration-200 hover:shadow-lg
                      ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                          : 'hover:border-primary/50 hover:bg-primary/[0.02]'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-1"
                      />
                      <div className="flex-shrink-0">
                        <div
                          className={`
                          w-12 h-12 rounded-lg flex items-center justify-center
                          ${isSelected ? 'bg-primary/10' : 'bg-muted'}
                          transition-colors
                        `}
                        >
                          <Icon
                            className={`w-6 h-6 ${
                              isSelected ? 'text-primary' : option.color
                            } transition-colors`}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={`font-semibold text-base ${
                              isSelected ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {option.label}
                          </h3>
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-primary animate-scale-in" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Label>
              );
            })}
          </RadioGroup>

          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">
                Vous pourrez toujours modifier votre profil plus tard
              </p>
              <p className="text-muted-foreground">
                Cette sélection nous aide à personnaliser votre tableau de bord et vos
                fonctionnalités
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleComplete}
              disabled={!selectedRole || isLoading}
              className="flex-1 h-12 text-base bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Création du profil...
                </>
              ) : (
                <>
                  Continuer
                  <CheckCircle2 className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
