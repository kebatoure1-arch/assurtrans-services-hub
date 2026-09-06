import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search, Compass } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pattern-dots opacity-30" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="max-w-2xl w-full text-center relative z-10 space-y-8 fade-in">
        {/* 404 Number */}
        <div className="relative">
          <h1 className="text-[180px] md:text-[240px] font-bold leading-none bg-gradient-to-br from-primary via-primary-dark to-primary bg-clip-text text-transparent opacity-20 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <Compass className="w-24 h-24 md:w-32 md:h-32 text-primary animate-spin" style={{ animationDuration: '10s' }} />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4 -mt-12">
          <h2 className="text-3xl md:text-4xl font-bold">
            Page introuvable
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Oups ! La page que vous recherchez semble s'être égarée. 
            Retournons à un endroit familier.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button 
            size="lg"
            onClick={() => navigate(-1)}
            variant="outline"
            className="h-12 px-6 hover:bg-primary/5 hover:border-primary/40 transition-all group"
          >
            <ArrowLeft className="mr-2 w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Page précédente
          </Button>
          <Button 
            size="lg"
            onClick={() => navigate('/')}
            className="h-12 px-6 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all shadow-lg hover:shadow-xl hover:scale-105 group"
          >
            <Home className="mr-2 w-5 h-5 group-hover:scale-110 transition-transform" />
            Retour à l'accueil
          </Button>
        </div>

        {/* Help text */}
        <div className="pt-8">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Search className="w-4 h-4" />
            Besoin d'aide ? Contactez notre support
          </p>
        </div>
      </div>
    </div>
  );
}
