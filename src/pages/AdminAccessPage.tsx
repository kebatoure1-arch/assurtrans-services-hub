import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  BarChart3, 
  Settings, 
  Lock,
  AlertCircle,
  Zap,
  Star,
  ArrowLeft
} from 'lucide-react';

export default function AdminAccessPage() {
  const navigate = useNavigate();

  const adminFeatures = [
    {
      icon: Users,
      title: 'Gestion des utilisateurs',
      description: 'Créez, modifiez et gérez tous les utilisateurs de la plateforme avec contrôle hiérarchique complet',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: BarChart3,
      title: 'Analyses & Rapports',
      description: 'Accédez à des tableaux de bord analytiques détaillés avec graphiques et exports CSV',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Settings,
      title: 'Configuration système',
      description: 'Paramétrez la plateforme, gérez les tables de données et configurez les services',
      color: 'from-amber-500 to-orange-500'
    }
  ];

  const accessSteps = [
    {
      step: '1',
      title: 'Obtenir vos identifiants',
      description: 'Contactez l\'équipe Assur\'Trans pour obtenir vos identifiants administrateur',
      icon: Lock
    },
    {
      step: '2',
      title: 'Se connecter',
      description: 'Utilisez votre email administrateur pour recevoir le code OTP de vérification',
      icon: Shield
    },
    {
      step: '3',
      title: 'Accéder au dashboard',
      description: 'Une fois connecté, accédez au tableau de bord avec tous les privilèges administrateur',
      icon: Zap
    }
  ];

  const securityFeatures = [
    'Authentification email OTP sécurisée',
    'Accès multi-niveaux avec contrôle des rôles',
    'Audit complet des actions administrateur',
    'Protection contre les accès non autorisés',
    'Sessions sécurisées avec expiration automatique'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://static.devv.ai/f4eyuacgbocg.jpg" 
                alt="Assur'Trans Logo" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <h1 className="text-lg font-bold">Assur'Trans</h1>
                <p className="text-xs text-muted-foreground">Accès Administrateur</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Accueil
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl mb-4 bounce-subtle">
              <Shield className="w-10 h-10 text-white" />
            </div>
            
            <Badge className="bg-purple-500 text-white mb-4">
              <Star className="w-3 h-3 mr-1" />
              Accès privilégié
            </Badge>
            
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Espace Administrateur
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Contrôlez et gérez l'ensemble de la plateforme Assur'Trans avec des privilèges complets
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg"
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white h-14 px-8 text-lg shadow-xl hover:shadow-2xl transition-all group"
              >
                Se connecter
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => window.open('mailto:support@assuretrans.com', '_blank')}
                className="border-2 h-14 px-8 text-lg"
              >
                Demander l'accès
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Fonctionnalités administrateur</h2>
              <p className="text-muted-foreground text-lg">
                Accédez à des outils puissants pour gérer votre plateforme
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {adminFeatures.map((feature, index) => (
                <Card key={index} className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group">
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Access Steps Section */}
      <section className="py-16 bg-gradient-to-b from-muted/30 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Comment accéder</h2>
              <p className="text-muted-foreground text-lg">
                Suivez ces étapes simples pour accéder à votre espace administrateur
              </p>
            </div>
            
            <div className="space-y-6">
              {accessSteps.map((item, index) => (
                <Card key={index} className="border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg">
                          <span className="text-2xl font-bold text-white">{item.step}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{item.title}</h3>
                          <item.icon className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-blue-50/50 shadow-xl">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">Sécurité renforcée</CardTitle>
                    <CardDescription className="text-base">
                      Votre compte administrateur bénéficie des plus hauts standards de sécurité
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {securityFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/50 transition-colors">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Prêt à gérer votre plateforme ?
            </h2>
            <p className="text-xl text-white/90 leading-relaxed">
              Connectez-vous maintenant pour accéder à votre espace administrateur
            </p>
            <Button 
              size="lg"
              onClick={() => navigate('/login')}
              className="bg-white text-purple-600 hover:bg-white/90 h-14 px-10 text-lg shadow-2xl hover:shadow-3xl transition-all group"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Besoin d'aide ?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Si vous rencontrez des difficultés pour accéder à votre espace administrateur ou si vous souhaitez obtenir des identifiants, contactez notre équipe support.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => window.open('mailto:support@assuretrans.com', '_blank')}>
                        Email: support@assuretrans.com
                      </Button>
                      <Button variant="outline">
                        WhatsApp: +221 XX XXX XX XX
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="https://static.devv.ai/f4eyuacgbocg.jpg" 
              alt="Assur'Trans Logo" 
              className="w-12 h-12 object-contain opacity-80"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 Assur'Trans. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
