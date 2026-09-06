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
import type { Secret } from '../secrets/secrets.ts';

export interface AfricasTalkingConfig {
  readonly apiKey: Secret;
  readonly username: string;
  readonly baseUrl: string;
  readonly senderId: string | null;
}

export class AfricasTalkingOtpSender implements OtpSender {
  constructor(private readonly config: AfricasTalkingConfig) {}

  async envoyer(msisdn: string, code: string): Promise<boolean> {
    const corps = new URLSearchParams({
      username: this.config.username,
      to: msisdn,
      message: `Assur'Trans : votre code de connexion est ${code}. Il expire dans 5 minutes.`,
    });
    if (this.config.senderId !== null) corps.set('from', this.config.senderId);

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/version1/messaging`, {
        method: 'POST',
        headers: {
          apiKey: this.config.apiKey.expose(),
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: corps,
      });
      if (!response.ok) {
        console.error(`Envoi SMS Africa's Talking refuse (${response.status})`);
        return false;
      }
      return true;
    } catch (cause) {
      console.error("Echec reseau de l'envoi SMS Africa's Talking", cause);
      return false;
    }
  }
}

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
