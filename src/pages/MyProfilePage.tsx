import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Building2,
  ArrowLeft,
  Edit,
  Save,
  X,
  Shield,
  Calendar,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { table } from '@devvai/devv-code-backend';
import { profileStatsService } from '@/services/profile-stats-service';
import UserStatsCards from '@/components/UserStatsCards';
import UserActivityTimeline from '@/components/UserActivityTimeline';

const USER_PROFILES_TABLE_ID = 'f4eyoj561clc';

interface UserProfile {
  _id: string;
  _uid: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  company_name?: string;
  position?: string;
  license_number?: string;
  station_count?: number;
  bio?: string;
  emergency_contact?: string;
  emergency_phone?: string;
}

interface UserStats {
  totalOrders?: number;
  totalSpent?: number;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  vehiclesCount?: number;
  lastActivity?: string;
  walletBalance?: number;
  activePolicies?: number;
  pendingClaims?: number;
  maintenanceAlerts?: number;
}

export default function MyProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !user) {
        navigate('/login');
      } else {
        loadUserProfile();
      }
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const loadUserProfile = async () => {
    if (!user) return;

    setLoadingProfile(true);
    try {
      // Load user profile from database (optional - for extended profile data)
      const profilesResult = await table.getItems(USER_PROFILES_TABLE_ID);
      const profiles = ((profilesResult as any).items || []) as UserProfile[];
      const userProfile = profiles.find(p => p._uid === user.uid);
      
      if (userProfile) {
        setProfile(userProfile);
        setEditedProfile(userProfile);
      }

      // Load user statistics (non-blocking)
      if (user.activeRole) {
        loadUserStats(user.uid, user.activeRole).catch(err => {
          console.warn('Failed to load user stats:', err);
        });
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // Don't show error toast - profile is optional
      // User info from auth-store is enough to display basic profile
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadUserStats = async (uid: string, role: string) => {
    setLoadingStats(true);
    try {
      const stats = await profileStatsService.getUserStats(uid, role);
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const validateProfile = (): boolean => {
    const errors: Record<string, string> = {};

    if (!editedProfile.full_name || editedProfile.full_name.trim().length < 2) {
      errors.full_name = 'Le nom complet doit contenir au moins 2 caractères';
    }

    if (!editedProfile.phone || !/^\+?[0-9\s-]{8,}$/.test(editedProfile.phone)) {
      errors.phone = 'Numéro de téléphone invalide';
    }

    if (!editedProfile.city || editedProfile.city.trim().length < 2) {
      errors.city = 'La ville est requise';
    }

    if (editedProfile.emergency_phone && !/^\+?[0-9\s-]{8,}$/.test(editedProfile.emergency_phone)) {
      errors.emergency_phone = 'Numéro d\'urgence invalide';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!profile || !user) return;

    if (!validateProfile()) {
      toast({
        title: 'Validation échouée',
        description: 'Veuillez corriger les erreurs dans le formulaire',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await table.updateItem(USER_PROFILES_TABLE_ID, {
        _uid: profile._uid,
        _id: profile._id,
        ...editedProfile
      });
      
      setProfile({ ...profile, ...editedProfile });
      setEditing(false);
      setValidationErrors({});
      
      toast({
        title: 'Succès',
        description: 'Profil mis à jour avec succès',
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le profil',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile || {});
    setEditing(false);
    setValidationErrors({});
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      agent: 'Agent',
      petrolier: 'Pétrolier',
      station: 'Station',
      fleet: 'Gestionnaire de flotte',
      driver: 'Chauffeur',
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: 'destructive',
      agent: 'default',
      petrolier: 'secondary',
      station: 'outline',
      fleet: 'default',
      driver: 'secondary',
    };
    return variants[role] || 'outline';
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement sécurisé de votre profil Assur'Trans…</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-xl mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Vous n&apos;êtes pas connecté</h2>
            <p className="text-muted-foreground mb-6">
              Veuillez vous reconnecter pour accéder à votre profil.
            </p>
            <Button onClick={() => navigate('/login')}>
              Se reconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Mon Profil</h1>
            <p className="text-muted-foreground">
              Gérez vos informations personnelles
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.activeRole === 'admin' && (
              <Button variant="outline" asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </Link>
              </Button>
            )}
            {!editing && profile && (
              <Button onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Validation errors alert */}
        {editing && Object.keys(validationErrors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Veuillez corriger les erreurs dans le formulaire avant d'enregistrer.
            </AlertDescription>
          </Alert>
        )}

        {/* Edit mode indicator */}
        {editing && (
          <Alert>
            <Edit className="h-4 w-4" />
            <AlertDescription>
              Mode édition activé. Modifiez vos informations et cliquez sur Enregistrer.
            </AlertDescription>
          </Alert>
        )}

        {/* Info banner: Profile loaded from auth-store */}
        {!loadingProfile && !profile && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ces informations sont directement issues de votre session Assur&apos;Trans.
                {user.activeRole === 'admin' && (
                  <> Créez un profil complet dans les <Link to="/settings?tab=demo" className="underline font-semibold">Paramètres</Link>.</>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* User Statistics and Activity Tabs */}
        {user.activeRole && (user.activeRole === 'fleet_manager' || user.activeRole === 'driver' || user.activeRole === 'assur_agent') && (
          <Tabs defaultValue="stats" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stats">Statistiques</TabsTrigger>
              <TabsTrigger value="activity">Activité</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stats" className="space-y-4">
              <UserStatsCards
                userRole={user.activeRole}
                stats={userStats || {}}
                loading={loadingStats}
              />
            </TabsContent>
            
            <TabsContent value="activity">
              <UserActivityTimeline
                userId={user.uid}
                userRole={user.activeRole}
                limit={15}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {profile?.full_name || user.name || user.email}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </CardDescription>
              </div>
              {user.activeRole && (
                <Badge variant={getRoleBadgeVariant(user.activeRole)} className="text-sm">
                  <Shield className="h-3 w-3 mr-1" />
                  {getRoleLabel(user.activeRole)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Information */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations du compte
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Statut du compte</Label>
                  <div>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Actif
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Membre depuis
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user.createdTime).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {loadingProfile && (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chargement du profil détaillé...</p>
              </div>
            )}

            {!loadingProfile && profile && (
              <>
                <Separator />

                {/* Personal Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Informations personnelles
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">
                        Nom complet <span className="text-red-500">*</span>
                      </Label>
                      {editing ? (
                        <div className="space-y-1">
                          <Input
                            id="full_name"
                            value={editedProfile.full_name || ''}
                            onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                            className={validationErrors.full_name ? 'border-red-500' : ''}
                          />
                          {validationErrors.full_name && (
                            <p className="text-xs text-red-500">{validationErrors.full_name}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        Téléphone <span className="text-red-500">*</span>
                      </Label>
                      {editing ? (
                        <div className="space-y-1">
                          <Input
                            id="phone"
                            value={editedProfile.phone || ''}
                            onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                            placeholder="+221 XX XXX XX XX"
                            className={validationErrors.phone ? 'border-red-500' : ''}
                          />
                          {validationErrors.phone && (
                            <p className="text-xs text-red-500">{validationErrors.phone}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{profile.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Bio Section */}
                  {(editing || profile.bio) && (
                    <div className="space-y-2 mt-4">
                      <Label htmlFor="bio">Biographie</Label>
                      {editing ? (
                        <Textarea
                          id="bio"
                          value={editedProfile.bio || ''}
                          onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                          placeholder="Parlez-nous un peu de vous..."
                          rows={3}
                        />
                      ) : profile.bio ? (
                        <p className="text-sm text-muted-foreground">{profile.bio}</p>
                      ) : null}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Location */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Localisation
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="address">Adresse</Label>
                      {editing ? (
                        <Input
                          id="address"
                          value={editedProfile.address || ''}
                          onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                          placeholder="Rue, quartier..."
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{profile.address || 'Non renseignée'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">
                        Ville <span className="text-red-500">*</span>
                      </Label>
                      {editing ? (
                        <div className="space-y-1">
                          <Input
                            id="city"
                            value={editedProfile.city || ''}
                            onChange={(e) => setEditedProfile({ ...editedProfile, city: e.target.value })}
                            className={validationErrors.city ? 'border-red-500' : ''}
                          />
                          {validationErrors.city && (
                            <p className="text-xs text-red-500">{validationErrors.city}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{profile.city}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role-specific information */}
                {(user.activeRole === 'assur_agent' || user.activeRole === 'fleet_manager') && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Informations professionnelles
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="company_name" className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            Entreprise
                          </Label>
                          {editing ? (
                            <Input
                              id="company_name"
                              value={editedProfile.company_name || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, company_name: e.target.value })}
                              placeholder="Nom de l'entreprise"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">{profile.company_name || 'Non renseignée'}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="position">Poste</Label>
                          {editing ? (
                            <Input
                              id="position"
                              value={editedProfile.position || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, position: e.target.value })}
                              placeholder="Titre du poste"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">{profile.position || 'Non renseigné'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Emergency Contact */}
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Contact d&apos;urgence
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="emergency_contact">Nom du contact</Label>
                      {editing ? (
                        <Input
                          id="emergency_contact"
                          value={editedProfile.emergency_contact || ''}
                          onChange={(e) => setEditedProfile({ ...editedProfile, emergency_contact: e.target.value })}
                          placeholder="Nom complet"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{profile.emergency_contact || 'Non renseigné'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency_phone">Téléphone d&apos;urgence</Label>
                      {editing ? (
                        <div className="space-y-1">
                          <Input
                            id="emergency_phone"
                            value={editedProfile.emergency_phone || ''}
                            onChange={(e) => setEditedProfile({ ...editedProfile, emergency_phone: e.target.value })}
                            placeholder="+221 XX XXX XX XX"
                            className={validationErrors.emergency_phone ? 'border-red-500' : ''}
                          />
                          {validationErrors.emergency_phone && (
                            <p className="text-xs text-red-500">{validationErrors.emergency_phone}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{profile.emergency_phone || 'Non renseigné'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Driver-specific: License number */}
                {user.activeRole === 'driver' && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Informations de conduite
                      </h3>
                      <div className="space-y-2">
                        <Label htmlFor="license_number">Numéro de permis</Label>
                        {editing ? (
                          <Input
                            id="license_number"
                            value={editedProfile.license_number || ''}
                            onChange={(e) => setEditedProfile({ ...editedProfile, license_number: e.target.value })}
                            placeholder="Numéro de permis de conduire"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">{profile.license_number || 'Non renseigné'}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
