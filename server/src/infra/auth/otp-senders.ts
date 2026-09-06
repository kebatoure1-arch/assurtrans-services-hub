/**
 * Envoi du code d'authentification.
 *
 * Aucun adaptateur SMS ni WhatsApp n'est fourni : les identifiants ne sont pas obtenus, et un
 * faux adaptateur donnerait l'illusion d'un envoi qui n'a pas lieu.
 *
 * `LogOtpSender` ecrit le code dans le journal serveur. C'est utilisable en developpement et
 * lors d'une demonstration ; en production, cela veut dire que quiconque lit les journaux peut
 * se connecter a la place d'un chauffeur. Le journal de demarrage annonce donc explicitement
 * `envoiCodeParSms: false`.
 */

import type { OtpSender } from '../../ports/authentication.ts';

export class LogOtpSender implements OtpSender {
  async envoyer(msisdn: string, code: string): Promise<boolean> {
    console.warn(
      JSON.stringify({
        avertissement: 'code d authentification ecrit au journal faute de passerelle SMS',
        msisdn,
        code,
      }),
    );
    return true;
  }
}

/** Ne fait rien et le dit. Pour les tests qui ne s'interessent pas a l'envoi. */
export class NoopOtpSender implements OtpSender {
  async envoyer(): Promise<boolean> {
    return false;
  }
}
