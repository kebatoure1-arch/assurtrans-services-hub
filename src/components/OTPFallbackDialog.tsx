// OTP Fallback Dialog - Alternative Validation When QR Scanner Unavailable
// Provides secure 6-digit OTP entry with generation, verification, and retry

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  generateOTP,
  verifyOTP,
  getOTPStatus,
  type OTPGenerationResult,
  type OTPVerificationResult,
} from '@/features/fuel/services/otp-service';

interface OTPFallbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  userPhone?: string;
  onSuccess: (orderId: string, orderNumber: string) => void;
}

export function OTPFallbackDialog({
  open,
  onOpenChange,
  orderNumber,
  userPhone,
  onSuccess,
}: OTPFallbackDialogProps) {
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [generationResult, setGenerationResult] = useState<OTPGenerationResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<OTPVerificationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [expiryCountdown, setExpiryCountdown] = useState<number | null>(null);

  // Generate OTP on mount
  useEffect(() => {
    if (open && orderNumber) {
      handleGenerateOTP();
    }
  }, [open, orderNumber]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Expiry countdown timer
  useEffect(() => {
    if (!generationResult?.expiresAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const expires = new Date(generationResult.expiresAt);
      const remaining = Math.floor((expires.getTime() - now.getTime()) / 1000);
      
      if (remaining <= 0) {
        setExpiryCountdown(0);
      } else {
        setExpiryCountdown(remaining);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [generationResult?.expiresAt]);

  const handleGenerateOTP = async () => {
    setLoading(true);
    setVerificationResult(null);

    try {
      // Check OTP status first
      const status = await getOTPStatus(orderNumber);
      
      if (!status.canResend && status.cooldownSeconds) {
        setCooldown(status.cooldownSeconds);
        setLoading(false);
        return;
      }

      const result = await generateOTP(orderNumber, userPhone);
      setGenerationResult(result);

      if (result.success) {
        setOtpCode(''); // Clear input
        
        // In development mode, show OTP in console
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔐 DEV MODE - OTP Code: ${result.otpCode}`);
        }
      }
    } catch (error) {
      console.error('Error generating OTP:', error);
      setGenerationResult({
        success: false,
        otpCode: '',
        expiresAt: '',
        message: 'Erreur lors de la génération de l\'OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) return;

    setLoading(true);

    try {
      const result = await verifyOTP(orderNumber, otpCode);
      setVerificationResult(result);

      if (result.success && result.orderId && result.orderNumber) {
        // Success! Call parent callback after 1 second
        setTimeout(() => {
          onSuccess(result.orderId!, result.orderNumber!);
          onOpenChange(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setVerificationResult({
        success: false,
        message: 'Erreur lors de la vérification de l\'OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpCode('');
    setVerificationResult(null);
    await handleGenerateOTP();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getExpiryProgress = (): number => {
    if (!expiryCountdown || !generationResult?.expiresAt) return 0;
    const totalSeconds = 15 * 60; // 15 minutes
    return (expiryCountdown / totalSeconds) * 100;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#789D9A]" />
            Validation par OTP
          </DialogTitle>
          <DialogDescription>
            Scanner QR indisponible ? Utilisez le code OTP à 6 chiffres
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Number */}
          <div className="bg-slate-50 p-3 rounded-lg border">
            <Label className="text-xs text-muted-foreground">Numéro de commande</Label>
            <p className="font-mono font-semibold">{orderNumber}</p>
          </div>

          {/* Generation Status */}
          {generationResult && (
            <Alert variant={generationResult.success ? 'default' : 'destructive'}>
              {generationResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{generationResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Expiry Countdown */}
          {generationResult?.success && expiryCountdown !== null && expiryCountdown > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Temps restant</span>
                <Badge variant="outline">{formatTime(expiryCountdown)}</Badge>
              </div>
              <Progress value={getExpiryProgress()} className="h-1" />
            </div>
          )}

          {/* OTP Input */}
          {generationResult?.success && (
            <div className="space-y-3">
              <Label htmlFor="otp-code">Code OTP (6 chiffres)</Label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otpCode.length === 6 && handleVerifyOTP()}
                className="text-center text-2xl font-bold tracking-wider"
                disabled={loading || expiryCountdown === 0}
              />
              <p className="text-xs text-muted-foreground text-center">
                {userPhone 
                  ? `Code envoyé par SMS/WhatsApp au ***${userPhone.slice(-4)}` 
                  : 'Demandez le code OTP au chauffeur'}
              </p>
              {userPhone && (
                <p className="text-xs text-[#789D9A] text-center font-medium">
                  📱 Vérifiez vos messages SMS et WhatsApp
                </p>
              )}
            </div>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <Alert variant={verificationResult.success ? 'default' : 'destructive'}>
              {verificationResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {verificationResult.message}
                {verificationResult.remainingAttempts !== undefined && (
                  <span className="block mt-1 font-semibold">
                    {verificationResult.remainingAttempts} tentative(s) restante(s)
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Dev Mode OTP Display */}
          {process.env.NODE_ENV === 'development' && generationResult?.success && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <span className="font-semibold">DEV MODE</span> - OTP: <span className="font-mono font-bold">{generationResult.otpCode}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {generationResult?.success && (
              <>
                <Button
                  onClick={handleVerifyOTP}
                  disabled={otpCode.length !== 6 || loading || expiryCountdown === 0}
                  className="flex-1"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Vérifier
                </Button>
                <Button
                  onClick={handleResendOTP}
                  variant="outline"
                  disabled={loading || cooldown > 0 || (expiryCountdown !== null && expiryCountdown > 60)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {cooldown > 0 ? `${cooldown}s` : 'Renvoyer'}
                </Button>
              </>
            )}

            {!generationResult?.success && !loading && (
              <Button onClick={handleGenerateOTP} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
