// Pétrolier Profile Page - Pétrolier avec stations et produits

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Shield, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';

export default function PetrolierProfilePage() {
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
            <h1 className="text-3xl font-bold">Profil Pétrolier</h1>
            <p className="text-muted-foreground">Gestion du réseau de stations</p>
          </div>
          <Badge variant="secondary">
            <Shield className="h-3 w-3 mr-1" />
            Pétrolier
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
      </div>
    </div>
  );
}
