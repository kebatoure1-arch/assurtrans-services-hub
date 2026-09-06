// Admin Profile Page - Administrateur avec accès système complet

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Calendar,
  Settings,
  ArrowLeft,
  Edit,
  Save,
  X,
  CheckCircle,
  BarChart3,
  Users,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { table } from '@devvai/devv-code-backend';

const USER_PROFILES_TABLE_ID = 'f4eyoj561clc';

interface UserProfile {
  _id: string;
  _uid: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  bio?: string;
}

export default function AdminProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }

    loadProfile();
  }, [isAuthenticated, user, navigate]);

  const loadProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await table.getItems(USER_PROFILES_TABLE_ID);
      const profiles = ((result as any).items || []) as UserProfile[];
      const userProfile = profiles.find(p => p._uid === user.uid);
      
      if (userProfile) {
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Profil Administrateur</h1>
            <p className="text-muted-foreground">Gestion complète de la plateforme Assur'Trans</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/settings">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Link>
          </Button>
        </div>

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
              <Badge variant="destructive" className="text-sm">
                <Shield className="h-3 w-3 mr-1" />
                Administrateur
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations du compte
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Actif
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Membre depuis
                  </p>
                  <p className="text-sm font-medium">
                    {new Date(user.createdTime).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {!loading && profile && (
              <>
                <Separator />
                
                {/* Personal Info */}
                <div>
                  <h3 className="font-semibold mb-3">Informations personnelles</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Téléphone</p>
                      <p className="text-sm font-medium">{profile.phone || 'Non renseigné'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Ville</p>
                      <p className="text-sm font-medium">{profile.city || 'Non renseignée'}</p>
                    </div>
                    {profile.address && (
                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs text-muted-foreground">Adresse</p>
                        <p className="text-sm font-medium">{profile.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Admin Quick Actions */}
            <div>
              <h3 className="font-semibold mb-3">Actions rapides</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <Link to="/settings">
                  <Card className="hover:border-[#789D9A] transition-colors cursor-pointer">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Settings className="h-8 w-8 text-[#789D9A]" />
                      <p className="text-sm font-medium">Paramètres Système</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/analytics">
                  <Card className="hover:border-[#789D9A] transition-colors cursor-pointer">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <BarChart3 className="h-8 w-8 text-[#789D9A]" />
                      <p className="text-sm font-medium">Analytics</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/dashboard">
                  <Card className="hover:border-[#789D9A] transition-colors cursor-pointer">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Users className="h-8 w-8 text-[#789D9A]" />
                      <p className="text-sm font-medium">Gestion Utilisateurs</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
