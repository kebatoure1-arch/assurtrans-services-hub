/**
 * Ports d'authentification.
 *
 * L'envoi du code passe par un port : en developpement il s'ecrit dans le journal, en production
 * il partira par SMS ou WhatsApp. Le domaine ne connait ni l'un ni l'autre.
 */

import type { OtpChallenge } from '../domain/otp.ts';
import type { ApiRole } from '../infra/auth/api-tokens.ts';

export interface OtpChallengeRepository {
  /** Defi vivant pour ce numero, s'il en existe un. */
  trouverVivant(msisdn: string): Promise<OtpChallenge | null>;
  /** Invalide le defi vivant eventuel, puis enregistre le nouveau. */
  remplacer(challenge: OtpChallenge): Promise<void>;
  /** Met a jour un defi apres une tentative, reussie ou non. */
  majTentative(challenge: OtpChallenge): Promise<void>;
  /** Nombre de codes demandes pour ce numero depuis un instant donne. Sert au debit. */
  compterDepuis(msisdn: string, depuis: string): Promise<number>;
}

export interface OtpSender {
  /** Ne leve pas : un echec d'envoi est signale par `false` et journalise par l'appelant. */
  envoyer(msisdn: string, code: string): Promise<boolean>;
}

export interface SessionAccordee {
  readonly token: string;
  readonly role: ApiRole;
  readonly subject: string;
  readonly stationId: string | null;
  readonly expireA: string;
}

export interface ApiTokenIssuer {
  /** Rend le jeton en clair UNE seule fois. Seule son empreinte est conservee. */
  emettre(input: {
    readonly subject: string;
    readonly role: ApiRole;
    readonly stationId: string | null;
    readonly expireA: string;
    readonly libelle: string;
  }): Promise<string>;
}

/** Qui est ce numero ? Un chauffeur, un pompiste, un administrateur, ou personne. */
export interface AnnuaireComptes {
  resoudre(msisdn: string): Promise<{
    readonly subject: string;
    readonly role: ApiRole;
    readonly stationId: string | null;
  } | null>;
}
