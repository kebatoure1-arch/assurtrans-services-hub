/**
 * Cas d'usage : se connecter avec son numéro de téléphone.
 *
 * Deux décisions de sécurité valent d'être dites, parce qu'elles se paient en confort et qu'on
 * pourrait être tenté de les défaire :
 *
 *  1. **La demande de code répond toujours la même chose**, que le numéro soit connu ou non.
 *     Sinon l'écran de connexion devient un annuaire : on y teste des numéros jusqu'à trouver
 *     qui est client. Un numéro inconnu ne déclenche simplement aucun envoi.
 *  2. **Le compteur de tentatives est persisté même quand la vérification échoue.** C'est
 *     l'échec qui doit coûter, sinon la limite ne limite rien.
 */

import {
  CodeExpireError,
  CodeIncorrectError,
  TropDeTentativesError,
  consommerCode,
  creerChallenge,
  normaliserMsisdn,
} from '../domain/otp.ts';
import { empreinteCode, genererCode } from '../infra/auth/otp-crypto.ts';
import type {
  AnnuaireComptes,
  ApiTokenIssuer,
  OtpChallengeRepository,
  OtpSender,
  SessionAccordee,
} from '../ports/authentication.ts';
import type { IdGenerator } from '../ports/repositories.ts';

export class TropDeDemandesError extends Error {
  constructor(readonly reessayerDansSecondes: number) {
    super('trop de demandes de code pour ce numéro');
    this.name = 'TropDeDemandesError';
  }
}

export class AuthentificationRefuseeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthentificationRefuseeError';
  }
}

export interface AuthDeps {
  readonly challenges: OtpChallengeRepository;
  readonly sender: OtpSender;
  readonly annuaire: AnnuaireComptes;
  readonly jetons: ApiTokenIssuer;
  readonly ids: IdGenerator;
  readonly otp: {
    readonly dureeSecondes: number;
    readonly maxTentatives: number;
    readonly maxDemandesParHeure: number;
    /**
     * Renvoie le code dans la réponse HTTP. Uniquement pour un environnement de démonstration
     * sans passerelle SMS. Faux par défaut, et le rester en production.
     */
    readonly echoCode: boolean;
  };
  readonly sessionDureeHeures: number;
}

export interface DemandeResult {
  /** Durée de validité du code, en secondes. */
  readonly valideSecondes: number;
  /** Présent uniquement si `echoCode` est actif. */
  readonly code?: string;
}

export class AuthenticateByPhone {
  constructor(private readonly deps: AuthDeps) {}

  async demanderCode(msisdnSaisi: string, asOf: string): Promise<DemandeResult> {
    const msisdn = normaliserMsisdn(msisdnSaisi);
    const { otp } = this.deps;

    const uneHeureAvant = new Date(Date.parse(asOf) - 3_600_000).toISOString();
    const recentes = await this.deps.challenges.compterDepuis(msisdn, uneHeureAvant);
    if (recentes >= otp.maxDemandesParHeure) {
      throw new TropDeDemandesError(3600);
    }

    const compte = await this.deps.annuaire.resoudre(msisdn);

    // Numéro inconnu : même réponse, aucun envoi. L'écran de connexion ne doit pas dire
    // qui est client et qui ne l'est pas.
    if (compte === null) {
      return { valideSecondes: otp.dureeSecondes };
    }

    const code = genererCode();
    const challenge = creerChallenge({
      id: this.deps.ids.next(),
      msisdn,
      codeHash: empreinteCode(msisdn, code),
      emisA: asOf,
      dureeSecondes: otp.dureeSecondes,
      maxTentatives: otp.maxTentatives,
    });

    // Le défi est enregistré AVANT l'envoi : un code envoyé sans défi enregistré serait
    // invérifiable, et le chauffeur attendrait un code qui ne marcherait jamais.
    await this.deps.challenges.remplacer(challenge);
    const envoye = await this.deps.sender.envoyer(msisdn, code);
    if (!envoye) {
      await this.deps.challenges.majTentative({ ...challenge, consomme: true });
      throw new AuthentificationRefuseeError('envoi du code impossible, réessayez plus tard');
    }

    return {
      valideSecondes: otp.dureeSecondes,
      ...(otp.echoCode ? { code } : {}),
    };
  }

  /**
   * Envoie un code au titulaire du compte, pour confirmer une action sensible.
   *
   * Le numero vient de la base, jamais de la requete : sinon l'appelant choisirait ou son
   * propre second facteur est envoye, ce qui n'en serait plus un.
   */
  async demanderConfirmation(subject: string, asOf: string): Promise<DemandeResult> {
    const msisdn = await this.deps.annuaire.msisdnDe(subject);
    if (msisdn === null) throw new AuthentificationRefuseeError('compte introuvable');
    return this.demanderCode(msisdn, asOf);
  }

  /**
   * Seconde authentification avant un mouvement d'argent (§9).
   *
   * Consomme un code frais sans emettre de jeton : ce n'est pas une ouverture de session, c'est
   * la confirmation d'un geste precis. Le defi est consomme, donc le meme code ne peut pas
   * autoriser deux virements.
   *
   * Ne rend rien et leve en cas d'echec : un booleen se teste mal, et un `if` oublie autoriserait
   * l'envoi.
   */
  async confirmerAction(subject: string, code: string, asOf: string): Promise<void> {
    const msisdn = await this.deps.annuaire.msisdnDe(subject);
    if (msisdn === null) throw new AuthentificationRefuseeError('compte introuvable');

    const challenge = await this.deps.challenges.trouverVivant(msisdn);
    if (challenge === null) {
      throw new AuthentificationRefuseeError('aucun code de confirmation en cours');
    }

    try {
      const consommation = consommerCode(challenge, empreinteCode(msisdn, String(code)), asOf);
      await this.deps.challenges.majTentative(consommation.challenge);
    } catch (cause) {
      if (cause instanceof CodeIncorrectError) {
        await this.deps.challenges.majTentative(cause.challenge);
        throw new AuthentificationRefuseeError(cause.message);
      }
      if (cause instanceof CodeExpireError || cause instanceof TropDeTentativesError) {
        throw new AuthentificationRefuseeError(cause.message);
      }
      throw cause;
    }
  }

  async ouvrirSession(msisdnSaisi: string, code: string, asOf: string): Promise<SessionAccordee> {
    const msisdn = normaliserMsisdn(msisdnSaisi);

    const challenge = await this.deps.challenges.trouverVivant(msisdn);
    if (challenge === null) {
      throw new AuthentificationRefuseeError('aucun code en cours pour ce numéro');
    }

    let consommation;
    try {
      consommation = consommerCode(challenge, empreinteCode(msisdn, String(code)), asOf);
    } catch (cause) {
      if (cause instanceof CodeIncorrectError) {
        // Le compteur avance même — surtout — quand le code est faux.
        await this.deps.challenges.majTentative(cause.challenge);
        throw new AuthentificationRefuseeError(cause.message);
      }
      if (cause instanceof CodeExpireError || cause instanceof TropDeTentativesError) {
        throw new AuthentificationRefuseeError(cause.message);
      }
      throw cause;
    }

    await this.deps.challenges.majTentative(consommation.challenge);

    const compte = await this.deps.annuaire.resoudre(msisdn);
    if (compte === null) {
      // Le compte a disparu entre la demande et la vérification. Rare, mais pas impossible.
      throw new AuthentificationRefuseeError('compte introuvable');
    }

    const expireA = new Date(
      Date.parse(asOf) + this.deps.sessionDureeHeures * 3_600_000,
    ).toISOString();

    const token = await this.deps.jetons.emettre({
      subject: compte.subject,
      role: compte.role,
      stationId: compte.stationId,
      expireA,
      libelle: `session ${msisdn}`,
    });

    return { token, role: compte.role, subject: compte.subject, stationId: compte.stationId, expireA };
  }
}
