// QR Scan Guide - User Guide for Station Staff

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  ArrowLeft,
  HelpCircle,
  Shield,
  Clock,
  Hash,
  Fuel,
  User,
  MapPin,
  ChevronRight
} from 'lucide-react';

const QRScanGuide: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#789D9A] to-[#5a7876] text-white shadow-lg">
              <QrCode className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Guide de Scan QR Code
              </h1>
              <p className="text-lg text-slate-600">
                Comment traiter les commandes de carburant avec le scanner QR Code
              </p>
              <Badge variant="secondary" className="mt-2">
                <Shield className="h-3 w-3 mr-1" />
                Réservé aux Stations-Service
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Start */}
          <Card className="border-[#789D9A]/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#789D9A]/10 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-[#789D9A]" />
                Démarrage Rapide
              </CardTitle>
              <CardDescription>
                3 étapes simples pour traiter une commande
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold text-lg mb-3">
                    1
                  </div>
                  <Camera className="h-8 w-8 text-[#789D9A] mb-2" />
                  <p className="font-semibold mb-1">Scanner le QR</p>
                  <p className="text-xs text-muted-foreground">
                    Ouvrez le scanner et pointez vers le QR Code
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold text-lg mb-3">
                    2
                  </div>
                  <Hash className="h-8 w-8 text-[#789D9A] mb-2" />
                  <p className="font-semibold mb-1">Valider le code</p>
                  <p className="text-xs text-muted-foreground">
                    Demandez et saisissez le code à 4 chiffres
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold text-lg mb-3">
                    3
                  </div>
                  <Fuel className="h-8 w-8 text-[#789D9A] mb-2" />
                  <p className="font-semibold mb-1">Servir le client</p>
                  <p className="text-xs text-muted-foreground">
                    Commencez le service et terminez la commande
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Instructions */}
          <Card className="border-[#789D9A]/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-[#789D9A]" />
                Instructions Détaillées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <h3 className="text-lg font-semibold">Accéder au Scanner QR</h3>
                </div>
                <div className="ml-11 space-y-2">
                  <p className="text-sm text-slate-700">
                    Dans votre tableau de bord Station, cliquez sur le bouton <strong>"Scanner QR Code"</strong> ou accédez directement à la page Scanner.
                  </p>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-900">
                      <strong>Raccourci :</strong> Menu principal → Scanner QR Code
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <h3 className="text-lg font-semibold">Scanner le QR Code</h3>
                </div>
                <div className="ml-11 space-y-3">
                  <p className="text-sm text-slate-700">
                    Le client vous présente son QR Code (sur son téléphone ou imprimé). Pointez votre caméra vers le code.
                  </p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Conseils pour un scan réussi :</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Assurez-vous d'avoir un bon éclairage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Tenez le téléphone stable à 15-30 cm du QR Code</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Évitez les reflets sur l'écran du client</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Le QR Code doit occuper la majeure partie du cadre</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-900">Option de secours</p>
                        <p className="text-sm text-amber-800">
                          Si la caméra ne fonctionne pas, vous pouvez saisir manuellement le numéro de commande (ex: ORD-20250120-001).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Step 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <h3 className="text-lg font-semibold">Vérifier le Code de Validation</h3>
                </div>
                <div className="ml-11 space-y-3">
                  <p className="text-sm text-slate-700">
                    Après le scan, le système vous demande le <strong>code de validation à 4 chiffres</strong>. 
                    Demandez ce code au client et saisissez-le.
                  </p>

                  <div className="p-4 rounded-lg bg-gradient-to-r from-[#789D9A]/10 to-[#789D9A]/5 border-2 border-[#789D9A]/30">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-[#789D9A] mt-0.5" />
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-900">Sécurité : Double Validation</p>
                        <p className="text-sm text-slate-700">
                          Le code de validation est une mesure de sécurité importante. Il confirme que :
                        </p>
                        <ul className="space-y-1 text-sm text-slate-700 ml-4">
                          <li className="flex items-center gap-2">
                            <ChevronRight className="h-3 w-3 text-[#789D9A]" />
                            Le client est bien le propriétaire de la commande
                          </li>
                          <li className="flex items-center gap-2">
                            <ChevronRight className="h-3 w-3 text-[#789D9A]" />
                            Le QR Code n'a pas été copié ou volé
                          </li>
                          <li className="flex items-center gap-2">
                            <ChevronRight className="h-3 w-3 text-[#789D9A]" />
                            La transaction est authentique et autorisée
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-900">
                      <strong>Important :</strong> Ne traitez JAMAIS une commande sans le code de validation correct.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Step 4 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold">
                    4
                  </div>
                  <h3 className="text-lg font-semibold">Vérifier les Détails de la Commande</h3>
                </div>
                <div className="ml-11 space-y-3">
                  <p className="text-sm text-slate-700">
                    Une fois validé, l'écran affiche tous les détails de la commande. Vérifiez attentivement :
                  </p>
                  
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="text-sm">Nom du client</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50">
                      <Hash className="h-4 w-4 text-slate-500" />
                      <span className="text-sm">Numéro de commande</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50">
                      <Fuel className="h-4 w-4 text-slate-500" />
                      <span className="text-sm">Type de carburant</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="text-sm">Quantité demandée</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700">
                    Assurez-vous que toutes les informations correspondent à ce que le client vous a communiqué.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Step 5 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#789D9A] text-white flex items-center justify-center font-bold">
                    5
                  </div>
                  <h3 className="text-lg font-semibold">Démarrer et Terminer le Service</h3>
                </div>
                <div className="ml-11 space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Étape 1 : Commencer le service</p>
                    <p className="text-sm text-slate-700">
                      Cliquez sur <strong>"Commencer le service"</strong> pour indiquer que vous démarrez le remplissage. 
                      Le statut de la commande passe à "En cours".
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Étape 2 : Effectuer le service</p>
                    <p className="text-sm text-slate-700">
                      Servez la quantité de carburant demandée au véhicule du client.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Étape 3 : Terminer la commande</p>
                    <p className="text-sm text-slate-700">
                      Une fois le service terminé, cliquez sur <strong>"Terminer la commande"</strong>. 
                      Le système enregistre automatiquement :
                    </p>
                    <ul className="space-y-1 text-sm text-slate-700 ml-4">
                      <li className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-[#789D9A]" />
                        L'heure de complétion
                      </li>
                      <li className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-[#789D9A]" />
                        Votre identifiant (traçabilité)
                      </li>
                      <li className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-[#789D9A]" />
                        Le statut "Terminée" pour la commande
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <p className="text-sm text-green-900">
                        Le client recevra une notification automatique de la complétion de sa commande.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card className="border-amber-200 bg-amber-50/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-5 w-5" />
                Résolution de Problèmes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white">
                  <Camera className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">La caméra ne fonctionne pas</p>
                    <p className="text-sm text-slate-700">
                      Vérifiez les autorisations de caméra dans votre navigateur. Utilisez la saisie manuelle du numéro de commande comme alternative.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white">
                  <QrCode className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Le QR Code ne se scanne pas</p>
                    <p className="text-sm text-slate-700">
                      Vérifiez l'éclairage, nettoyez la caméra et l'écran du client. Demandez au client d'augmenter la luminosité de son écran.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white">
                  <Hash className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Le code de validation est incorrect</p>
                    <p className="text-sm text-slate-700">
                      Demandez au client de vérifier son code. Si le problème persiste, contactez le support technique.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">La commande a déjà été traitée</p>
                    <p className="text-sm text-slate-700">
                      Vérifiez l'historique de la commande. Si elle apparaît comme terminée, elle ne peut plus être traitée.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card className="border-green-200 bg-green-50/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle2 className="h-5 w-5" />
                Bonnes Pratiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">
                    <strong>Vérifiez toujours</strong> le code de validation avant de démarrer le service
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">
                    <strong>Confirmez verbalement</strong> avec le client le type et la quantité de carburant
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">
                    <strong>Mettez à jour le statut</strong> immédiatement après le démarrage et la fin du service
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">
                    <strong>Gardez votre appareil chargé</strong> et fonctionnel pendant votre service
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">
                    <strong>Traitez une commande à la fois</strong> pour éviter les confusions
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-[#789D9A] bg-gradient-to-br from-[#789D9A]/10 to-[#789D9A]/5 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-center md:text-left">
                  <p className="text-lg font-semibold text-slate-900 mb-1">
                    Prêt à scanner votre première commande ?
                  </p>
                  <p className="text-sm text-slate-600">
                    Accédez au scanner QR et commencez à traiter les commandes
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/qr-scanner')}
                  size="lg"
                  className="bg-[#789D9A] hover:bg-[#5a7876] shadow-lg"
                >
                  <QrCode className="h-5 w-5 mr-2" />
                  Ouvrir le Scanner
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>
            Pour toute question ou assistance, contactez le support technique Assur'Trans©
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScanGuide;
