// Station Profile Page - Station avec livraisons et revenus

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Shield, ArrowLeft, Building2, QrCode, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';

export default function StationProfilePage() {
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
            <h1 className="text-3xl font-bold">Profil Station</h1>
            <p className="text-muted-foreground">Traitement des commandes et livraisons</p>
          </div>
          <Badge variant="outline">
            <Shield className="h-3 w-3 mr-1" />
            Station
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

        {/* Quick Access to QR Scanner */}
        <Card className="border-[#789D9A]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#789D9A]" />
              Scanner QR Code
            </CardTitle>
            <CardDescription>
              Scannez les QR Codes des commandes pour traitement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <Link to="/station/scanner">
                <QrCode className="h-5 w-5 mr-2" />
                Ouvrir le Scanner
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
