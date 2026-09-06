import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Home, ArrowLeft, Lock } from 'lucide-react';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pattern-dots opacity-30" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-destructive/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-destructive/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <Card className="max-w-lg w-full shadow-2xl border-destructive/20 relative z-10 scale-in">
        <CardHeader className="text-center space-y-4 pb-4">
          {/* Icon */}
          <div className="flex justify-center bounce-subtle">
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-destructive/10 to-destructive/20 flex items-center justify-center relative z-10 border-2 border-destructive/30">
                <ShieldAlert className="w-12 h-12 text-destructive" />
              </div>
            </div>
          </div>

          {/* Title and description */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-3xl font-bold text-destructive">
                Accès refusé
              </CardTitle>
            </div>
            <Badge variant="destructive" className="text-xs">
              <Lock className="w-3 h-3 mr-1" />
              Zone protégée
            </Badge>
            <CardDescription className="text-base leading-relaxed">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page. 
              Veuillez contacter votre administrateur si vous pensez qu'il s'agit d'une erreur.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Info box */}
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" />
              Que faire maintenant ?
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Vérifiez que vous êtes connecté avec le bon compte</li>
              <li>Demandez les permissions appropriées à votre administrateur</li>
              <li>Retournez à la page d'accueil</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button 
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="w-full h-12 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] group"
            >
              <Home className="mr-2 w-5 h-5 group-hover:scale-110 transition-transform" />
              Retour au tableau de bord
            </Button>
            
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate(-1)}
              className="w-full h-12 hover:bg-primary/5 hover:border-primary/40 transition-all group"
            >
              <ArrowLeft className="mr-2 w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              Page précédente
            </Button>
          </div>

          {/* Help text */}
          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground">
              Besoin d'aide ? Contactez{' '}
              <a href="#" className="text-primary hover:underline font-medium">
                notre support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
