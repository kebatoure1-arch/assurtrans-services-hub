// Fleet Profile Page - Chef de flotte avec véhicules et chauffeurs

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';
import UserStatsCards from '@/components/UserStatsCards';
import UserActivityTimeline from '@/components/UserActivityTimeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FleetProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Profil Chef de Flotte</h1>
            <p className="text-muted-foreground">Gestion de la flotte et des chauffeurs</p>
          </div>
          <Badge variant="default">
            <Shield className="h-3 w-3 mr-1" />
            Gestionnaire
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{user.name || user.email}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {user.email}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
            <TabsTrigger value="activity">Activité</TabsTrigger>
          </TabsList>
          <TabsContent value="stats" className="space-y-4">
            <UserStatsCards userRole="fleet" stats={{}} loading={false} />
          </TabsContent>
          <TabsContent value="activity">
            <UserActivityTimeline userId={user.uid} userRole="fleet" limit={15} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
