import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Fuel, 
  Heart, 
  Award, 
  ArrowRight, 
  CheckCircle2,
  Users,
  Building2,
  Truck,
  Sparkles,
  Zap,
  Star,
  TrendingUp
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  // Progressive card reveal animation
  useEffect(() => {
    const timers = [0, 1, 2].map((index) => 
      setTimeout(() => {
        setVisibleCards(prev => [...prev, index]);
      }, index * 150)
    );
    return () => timers.forEach(timer => clearTimeout(timer));
  }, []);

  const features = [
    {
      icon: Fuel,
      title: 'Services Carburant',
      description: 'Achat de carburant et services automobiles via un système prépayé sécurisé',
      gradient: 'from-blue-500/10 to-cyan-500/10',
      iconColor: 'text-blue-600',
      badge: 'Populaire',
      link: '/login',
      linkText: 'Commander maintenant'
    },
    {
      icon: Heart,
      title: 'Assurance Santé',
      description: 'Couverture santé complète pour chauffeurs et chefs de flotte avec suivi médical',
      gradient: 'from-rose-500/10 to-pink-500/10',
      iconColor: 'text-rose-600',
      badge: 'Essentiel',
      link: '/login',
      linkText: 'Découvrir les plans'
    },
    {
      icon: Award,
      title: 'Programme de Fidélité',
      description: 'Gagnez des primes et récompenses sur chaque transaction avec bonus exclusifs',
      gradient: 'from-amber-500/10 to-yellow-500/10',
      iconColor: 'text-amber-600',
      badge: 'Nouveau',
      link: '/login',
      linkText: 'Voir les récompenses'
    },
  ];

  const userTypes = [
    {
      icon: Shield,
      title: 'Administrateurs',
      description: 'Gestion complète de la plateforme',
      count: 'Contrôle total',
      role: 'admin',
      features: ['Gestion utilisateurs', 'Statistiques globales', 'Configuration système']
    },
    {
      icon: Users,
      title: 'Agents & Pétroliers',
      description: 'Gestion des opérations et provisions',
      count: 'Multi-niveau',
      role: 'agent',
      features: ['Réseau de stations', 'Gestion des commissions', 'Suivi des pétroliers']
    },
    {
      icon: Building2,
      title: 'Stations-service',
      description: 'Ventes et services sur le terrain',
      count: 'Réseau étendu',
      role: 'station',
      features: ['Livraisons en attente', 'Historique des ventes', 'Stock carburant']
    },
    {
      icon: Truck,
      title: 'Flottes & Chauffeurs',
      description: 'Commandes et suivi consommation',
      count: 'Temps réel',
      role: 'driver',
      features: ['Commandes carburant', 'Véhicules', 'Points de fidélité']
    },
  ];

  const benefits = [
    { text: 'Système de paiement sécurisé (Mobile Money)', icon: Shield },
    { text: 'Gestion multi-rôles hiérarchisée', icon: Users },
    { text: 'Application PWA ultra-rapide', icon: Zap },
    { text: 'Fonctionne même avec faible connexion', icon: TrendingUp },
    { text: 'Notifications SMS et WhatsApp', icon: Sparkles },
    { text: 'Tableau de bord analytique', icon: Star },
  ];

  const stats = [
    { value: '99.9%', label: 'Disponibilité', icon: Zap },
    { value: '< 2s', label: 'Temps de réponse', icon: TrendingUp },
    { value: '24/7', label: 'Support', icon: Heart },
    { value: '100%', label: 'Sécurisé', icon: Shield },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="gradient-animated pattern-dots text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
        
        <div className="container mx-auto px-4 py-16 lg:py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Logo with float animation */}
            <div className="flex justify-center mb-6 float">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl" />
                <img 
                  src="https://static.devv.ai/f4eyuacgbocg.jpg" 
                  alt="Assur'Trans Logo" 
                  className="w-28 h-28 md:w-36 md:h-36 object-contain relative z-10 scale-in"
                />
              </div>
            </div>
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-6 py-3 border border-white/20 fade-in">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Plateforme digitale nouvelle génération</span>
            </div>
            
            {/* Heading with slide in animation */}
            <h1 className="text-5xl md:text-7xl font-bold leading-tight slide-in-left">
              Assur'Trans©
            </h1>
            
            {/* Subheading */}
            <p className="text-xl md:text-2xl text-white/95 leading-relaxed max-w-3xl mx-auto slide-in-right">
              Votre plateforme tout-en-un d'assurance santé et services carburant 
              pour chauffeurs et flottes automobiles
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 fade-in">
              <Button 
                size="lg" 
                onClick={() => navigate('/login')}
                className="bg-white text-primary hover:bg-white/90 hover:scale-105 h-14 px-8 text-lg shadow-2xl transition-all duration-300 group"
              >
                Se connecter
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/login')}
                className="border-2 border-white/80 text-white hover:bg-white/15 hover:scale-105 h-14 px-8 text-lg backdrop-blur-sm transition-all duration-300"
              >
                Créer un compte
              </Button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-center mb-2">
                    <stat.icon className="w-5 h-5 text-white/90" />
                  </div>
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-xs text-white/80">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 fade-in">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm">
              <Sparkles className="w-3 h-3 mr-2" />
              Une solution complète
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Trois services essentiels
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Réunis dans une seule plateforme moderne, rapide et sécurisée
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`border-2 card-interactive relative overflow-hidden ${visibleCards.includes(index) ? 'fade-in' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-50`} />
                <CardHeader className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}>
                      <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                    </div>
                    <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
                  </div>
                  <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between group"
                    onClick={() => navigate(feature.link)}
                  >
                    {feature.linkText}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm">
              <Users className="w-3 h-3 mr-2" />
              Multi-rôles
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Pour tous les acteurs
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une plateforme adaptée à chaque profil d'utilisateur avec des fonctionnalités personnalisées
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {userTypes.map((type, index) => (
              <Card 
                key={index} 
                className="text-center card-interactive group cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate('/login')}
              >
                <CardContent className="pt-8 pb-6">
                  <div className="relative mb-6 inline-block">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300" />
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center relative shadow-xl group-hover:scale-110 transition-transform duration-300">
                      <type.icon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{type.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{type.description}</p>
                  <Badge variant="secondary" className="text-xs mb-4">{type.count}</Badge>
                  
                  {/* Features list */}
                  <div className="space-y-1 mt-4 text-left">
                    {type.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action button */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-4 group-hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/login');
                    }}
                  >
                    Accéder
                    <ArrowRight className="ml-2 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-2 text-sm">
                <Star className="w-3 h-3 mr-2" />
                Avantages
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Pourquoi Assur'Trans ?
              </h2>
              <p className="text-lg text-muted-foreground">
                Une plateforme moderne, sécurisée et optimisée pour le contexte africain
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-4 p-5 rounded-xl hover:bg-primary/5 transition-all duration-300 border border-transparent hover:border-primary/20 hover:shadow-lg group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-base leading-relaxed">{benefit.text}</span>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 gradient-sage text-white relative overflow-hidden">
        <div className="absolute inset-0 pattern-dots opacity-30" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-3xl mx-auto space-y-6">
            <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
              <Sparkles className="w-3 h-3 mr-2" />
              Commencez gratuitement
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Prêt à transformer votre gestion ?
            </h2>
            <p className="text-xl text-white/95 mb-8 leading-relaxed">
              Rejoignez la plateforme Assur'Trans dès aujourd'hui et profitez 
              d'une expérience complète, moderne et sécurisée
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg"
                onClick={() => navigate('/login')}
                className="bg-white text-primary hover:bg-white/90 hover:scale-105 h-14 px-10 text-lg shadow-2xl transition-all duration-300 group"
              >
                Commencer maintenant
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <div className="flex items-center gap-2 text-sm text-white/90">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sans engagement • Installation rapide</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-2 text-sm">
                <Zap className="w-3 h-3 mr-2" />
                Accès rapide
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Accédez à votre espace
              </h2>
              <p className="text-muted-foreground">
                Connectez-vous selon votre rôle et accédez à vos fonctionnalités
              </p>
            </div>
            
            {/* Featured Admin Access */}
            <Card className="mb-6 border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-blue-500/5 shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer scale-in" onClick={() => navigate('/admin-access')}>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform relative z-10">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                      <h3 className="text-2xl font-bold">Accès Administrateur</h3>
                      <Badge className="bg-purple-500 text-white">
                        <Star className="w-3 h-3 mr-1" />
                        Contrôle total
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-3">
                      Gestion complète de la plateforme : utilisateurs, statistiques, configuration système
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      {['Gestion utilisateurs', 'Analytiques avancés', 'Paramètres système'].map((feature, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-purple-600" />
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="lg" className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all" onClick={(e) => { e.stopPropagation(); navigate('/admin-access'); }}>
                      En savoir plus
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <Button size="sm" variant="outline" className="border-purple-500/50 text-purple-600 hover:bg-purple-50" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
                      Se connecter directement
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: Users, title: 'Agent', desc: 'Gestion pétroliers', color: 'from-blue-500 to-cyan-600' },
                { icon: Users, title: 'Pétrolier', desc: 'Gestion stations', color: 'from-teal-500 to-emerald-600' },
                { icon: Building2, title: 'Station', desc: 'Livraisons & ventes', color: 'from-orange-500 to-amber-600' },
                { icon: Truck, title: 'Flotte', desc: 'Gestion véhicules', color: 'from-rose-500 to-pink-600' },
                { icon: Truck, title: 'Chauffeur', desc: 'Mes commandes', color: 'from-violet-500 to-purple-600' },
              ].map((item, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="h-auto p-6 flex-col items-start gap-3 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 group"
                  onClick={() => navigate('/login')}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.desc}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </Button>
              ))}
            </div>
            
            {/* Demo credentials hint */}
            <div className="mt-8 p-6 bg-primary/5 rounded-xl border border-primary/20 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Première connexion ?</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Créez votre compte en quelques secondes ou contactez votre administrateur pour vos identifiants
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <img 
                src="https://static.devv.ai/f4eyuacgbocg.jpg" 
                alt="Assur'Trans Logo" 
                className="w-16 h-16 object-contain opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Assur'Trans. Tous droits réservés.
            </p>
            <p className="text-xs text-muted-foreground">
              Plateforme digitale d'assurance et services carburant
            </p>
            <div className="flex items-center justify-center gap-6 pt-4">
              <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Confidentialité</a>
              <span className="text-muted-foreground">•</span>
              <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Conditions</a>
              <span className="text-muted-foreground">•</span>
              <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
