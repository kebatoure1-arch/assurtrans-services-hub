import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, Shield, ArrowLeft, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sendOTP, verifyOTP, isLoading } = useAuthStore();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: 'Email invalide',
        description: 'Veuillez entrer une adresse email valide',
        variant: 'destructive',
      });
      return;
    }

    try {
      await sendOTP(email);
      toast({
        title: '✨ Code envoyé !',
        description: 'Vérifiez votre boîte mail pour le code de vérification',
      });
      setStep('otp');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer le code. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast({
        title: 'Code incomplet',
        description: 'Veuillez entrer le code à 6 chiffres',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('🔐 Starting OTP verification...');
      
      // Verify OTP - le store gère automatiquement la redirection via mustChooseRole
      await verifyOTP(email, otp);
      
      console.log('✅ OTP verified successfully');
      
      toast({
        title: '✅ Connexion réussie !',
        description: 'Bienvenue sur Assur\'Trans',
      });

      // Le AuthRedirect sur "/" gère la redirection automatique
      // - Si mustChooseRole = true → /select-role
      // - Sinon → dashboard selon activeRole
      navigate('/', { replace: true });

    } catch (error) {
      console.error('❌ Login error:', error);
      toast({
        title: 'Code invalide',
        description: 'Le code de vérification est incorrect ou expiré',
        variant: 'destructive',
      });
      setOtp('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-animated pattern-dots relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/10" />
      
      {/* Floating shapes */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-white/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <Card className="w-full max-w-md shadow-2xl border-primary/20 relative z-10 scale-in">
        <CardHeader className="space-y-4 text-center">
          {/* Back to Home button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          
          {/* Logo with bounce animation */}
          <div className="flex justify-center bounce-subtle">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
              <img 
                src="https://static.devv.ai/f4eyuacgbocg.jpg" 
                alt="Assur'Trans Logo" 
                className="w-24 h-24 object-contain relative z-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Assur'Trans
            </CardTitle>
            <CardDescription className="text-base">
              Plateforme d'assurance et services carburant
            </CardDescription>
            <Badge variant="outline" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Connexion sécurisée
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {step === 'email' ? (
            <div key="email" className="fade-in">
              <form onSubmit={handleSendOTP} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-base font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Adresse email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 transition-colors group-focus-within:text-primary" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre.email@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-14 text-base input-focus-glow transition-all"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Nous vous enverrons un code de vérification sécurisé</span>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 text-base bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      Recevoir le code
                      <Mail className="ml-2 w-5 h-5 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    En continuant, vous acceptez nos conditions d'utilisation
                  </p>
                </div>
              </form>
            </div>
          ) : (
            <div key="otp" className="scale-in">
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Code de vérification</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStep('email');
                        setOtp('');
                      }}
                      className="text-primary hover:bg-primary/10 transition-colors h-9"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Retour
                    </Button>
                  </div>
                  
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
                    <div className="flex justify-center mb-4">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        disabled={isLoading}
                      >
                        <InputOTPGroup className="gap-2">
                          <InputOTPSlot index={0} className="w-12 h-16 text-2xl font-bold border-2 rounded-lg transition-all hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <InputOTPSlot index={1} className="w-12 h-16 text-2xl font-bold border-2 rounded-lg transition-all hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <InputOTPSlot index={2} className="w-12 h-16 text-2xl font-bold border-2 rounded-lg transition-all hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <InputOTPSlot index={3} className="w-12 h-16 text-2xl font-bold border-2 rounded-lg transition-all hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <InputOTPSlot index={4} className="w-12 h-16 text-2xl font-bold border-2 rounded-lg transition-all hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <InputOTPSlot index={5} className="w-12 h-16 text-2xl font-bold border-2 rounded-lg transition-all hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Code envoyé à
                      </p>
                      <Badge variant="secondary" className="font-mono">
                        {email}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Le code est valide pendant 10 minutes</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-base bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                        Vérification...
                      </>
                    ) : (
                      <>
                        Se connecter
                        <CheckCircle2 className="ml-2 w-5 h-5 group-hover:scale-110 transition-transform" />
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 hover:bg-primary/5 hover:border-primary/40 transition-all group"
                    onClick={handleSendOTP}
                    disabled={isLoading}
                  >
                    <Mail className="mr-2 w-4 h-4 group-hover:scale-110 transition-transform" />
                    Renvoyer le code
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>

        {/* Trust indicators */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-primary" />
              <span>Sécurisé</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-primary" />
              <span>Fiable</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Rapide</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
