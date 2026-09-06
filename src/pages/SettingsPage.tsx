/**
 * Settings Page - Admin settings and configuration panel
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Database, Fuel, Shield, Award, CreditCard, Lock, Bell, RefreshCw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { SettingCard } from '@/features/settings/components/SettingCard';
import { CreateSettingDialog } from '@/features/settings/components/CreateSettingDialog';
import { SystemHealthCard } from '@/features/settings/components/SystemHealthCard';
import { PlatformStatsCard } from '@/features/settings/components/PlatformStatsCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import {
  getAllSettings,
  getSettingsByCategory,
  saveSetting,
  deleteSetting,
  getPlatformStats,
  getSystemHealth,
  initializeDefaultSettings
} from '@/features/settings/services/settings-service';
import { seedService } from '@/services/seed-service';
import type { SystemSetting, SettingCategory, SettingFormData, PlatformStats, SystemHealth } from '@/features/settings/types';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSeedingAdmin, setIsSeedingAdmin] = useState(false);
  const [isSeedingAll, setIsSeedingAll] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, statsData, healthData] = await Promise.all([
        getAllSettings(),
        getPlatformStats(),
        getSystemHealth()
      ]);
      setSettings(settingsData);
      setStats(statsData);
      setHealth(healthData);
    } catch (error) {
      console.error('Error loading settings data:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les paramètres'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeDefaults = async () => {
    if (!user?.uid) return;
    
    setIsInitializing(true);
    try {
      await initializeDefaultSettings(user.uid);
      await loadData();
      toast({
        title: 'Succès',
        description: 'Paramètres par défaut initialisés'
      });
    } catch (error) {
      console.error('Error initializing defaults:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'initialiser les paramètres'
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCreateSetting = async (data: SettingFormData) => {
    if (!user?.uid) return;

    try {
      await saveSetting(data, user.uid);
      await loadData();
      toast({
        title: 'Succès',
        description: 'Paramètre créé avec succès'
      });
    } catch (error) {
      console.error('Error creating setting:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le paramètre'
      });
    }
  };

  const handleUpdateSetting = async (settingId: string, value: string) => {
    if (!user?.uid) return;

    const setting = settings.find(s => s._id === settingId);
    if (!setting) return;

    try {
      await saveSetting({
        setting_key: setting.setting_key,
        setting_value: value,
        category: setting.category,
        data_type: setting.data_type,
        description: setting.description,
        is_public: setting.is_public
      }, user.uid);
      
      await loadData();
      toast({
        title: 'Succès',
        description: 'Paramètre mis à jour'
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour le paramètre'
      });
    }
  };

  const handleDeleteSetting = async (settingId: string) => {
    if (!user?.uid) return;
    
    try {
      await deleteSetting(settingId, user.uid);
      await loadData();
      toast({
        title: 'Succès',
        description: 'Paramètre supprimé'
      });
    } catch (error) {
      console.error('Error deleting setting:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer le paramètre'
      });
    }
  };

  const handleSeedAdmin = async () => {
    if (!user?.uid) return;

    setIsSeedingAdmin(true);
    setSeedResult(null);
    try {
      const result = await seedService.seedDemoAdmin(user.uid);
      setSeedResult(result);
      if (result.success) {
        toast({
          title: 'Succès',
          description: result.message
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Attention',
          description: result.message
        });
      }
    } catch (error) {
      console.error('Error seeding admin:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le compte admin'
      });
    } finally {
      setIsSeedingAdmin(false);
    }
  };

  const handleSeedAll = async () => {
    if (!user?.uid) return;

    setIsSeedingAll(true);
    setSeedResult(null);
    try {
      const result = await seedService.seedAll(user.uid);
      setSeedResult(result);
      if (result.success) {
        await loadData(); // Refresh stats
        toast({
          title: 'Succès',
          description: result.message
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Attention',
          description: result.message
        });
      }
    } catch (error) {
      console.error('Error seeding all:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer les données de démonstration'
      });
    } finally {
      setIsSeedingAll(false);
    }
  };

  const getSettingsByTab = (category: SettingCategory) => {
    return settings.filter(s => s.category === category);
  };

  const categoryIcons = {
    platform: Database,
    fuel: Fuel,
    insurance: Shield,
    loyalty: Award,
    payment: CreditCard,
    security: Lock,
    notification: Bell
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">Paramètres système</h1>
            </div>
            <p className="text-muted-foreground">
              Configuration et administration de la plateforme Assur'Trans©
            </p>
          </div>
          <div className="flex items-center gap-3">
            {settings.length === 0 && (
              <Button
                variant="outline"
                onClick={handleInitializeDefaults}
                disabled={isInitializing}
              >
                <Database className="w-4 h-4 mr-2" />
                {isInitializing ? 'Initialisation...' : 'Initialiser les défauts'}
              </Button>
            )}
            <CreateSettingDialog onSubmit={handleCreateSetting} />
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="demo" className="bg-primary/10 data-[state=active]:bg-primary">
              <Database className="w-3.5 h-3.5 mr-1" />
              Données démo
            </TabsTrigger>
            <TabsTrigger value="platform">Plateforme</TabsTrigger>
            <TabsTrigger value="fuel">Carburant</TabsTrigger>
            <TabsTrigger value="insurance">Assurance</TabsTrigger>
            <TabsTrigger value="loyalty">Fidélité</TabsTrigger>
            <TabsTrigger value="payment">Paiement</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="notification">Notification</TabsTrigger>
          </TabsList>

          {/* Demo Data Tab */}
          <TabsContent value="demo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Données de démonstration
                </CardTitle>
                <CardDescription>
                  Créez des données de test pour explorer et tester la plateforme Assur'Trans©
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seed Admin Account */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">Compte administrateur démo</h3>
                      <p className="text-sm text-muted-foreground">
                        Créer un compte admin avec email: admin@assurtrans.com
                      </p>
                    </div>
                    <Button
                      onClick={handleSeedAdmin}
                      disabled={isSeedingAdmin}
                      size="sm"
                    >
                      {isSeedingAdmin ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Création...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Créer Admin
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Seed All Data */}
                <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-br from-primary/5 to-accent/5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">Initialisation complète</h3>
                      <p className="text-sm text-muted-foreground">
                        Créer toutes les données de démonstration: admin, produits, stations, assurances, etc.
                      </p>
                    </div>
                    <Button
                      onClick={handleSeedAll}
                      disabled={isSeedingAll}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isSeedingAll ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Initialisation...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4 mr-2" />
                          Tout initialiser
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Seed Result Display */}
                {seedResult && (
                  <div className={`border rounded-lg p-4 space-y-3 ${
                    seedResult.success 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      {seedResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-2">
                        <h3 className={`font-semibold ${
                          seedResult.success ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'
                        }`}>
                          {seedResult.message}
                        </h3>
                        {seedResult.details && seedResult.details.length > 0 && (
                          <div className={`text-sm space-y-1 ${
                            seedResult.success ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'
                          }`}>
                            {seedResult.details.map((detail, index) => (
                              <div key={index} className="font-mono">
                                {detail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Card */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-semibold mb-2">ℹ️ Information importante</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Les données de démonstration sont créées avec votre compte actuel</li>
                    <li>Le compte admin démo utilise l'email: admin@assurtrans.com</li>
                    <li>Utilisez le système OTP pour vous connecter avec ce compte</li>
                    <li>Ces données sont utiles pour tester toutes les fonctionnalités</li>
                    <li>Vous pouvez réinitialiser en supprimant et recréant les données</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {stats && <PlatformStatsCard stats={stats} />}
              {health && <SystemHealthCard health={health} />}
            </div>

            {/* Quick summary of all settings */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(categoryIcons).map(([category, Icon]) => {
                const count = getSettingsByTab(category as SettingCategory).length;
                return (
                  <Button
                    key={category}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => setActiveTab(category)}
                  >
                    <Icon className="w-6 h-6 text-primary" />
                    <div className="text-center">
                      <p className="font-medium capitalize">{category}</p>
                      <p className="text-xs text-muted-foreground">{count} paramètre{count > 1 ? 's' : ''}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </TabsContent>

          {/* Category-specific tabs */}
          {(['platform', 'fuel', 'insurance', 'loyalty', 'payment', 'security', 'notification'] as SettingCategory[]).map((category) => (
            <TabsContent key={category} value={category} className="space-y-4">
              {getSettingsByTab(category).length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Aucun paramètre dans cette catégorie</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Cliquez sur "Nouveau paramètre" pour en ajouter un
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getSettingsByTab(category).map((setting) => (
                    <SettingCard
                      key={setting._id}
                      setting={setting}
                      onSave={handleUpdateSetting}
                      onDelete={handleDeleteSetting}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
