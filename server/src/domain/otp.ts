/**
 * Codes à usage unique pour l'authentification par téléphone.
 *
 * Trois précautions portent le reste :
 *
 *  1. **Le code n'est jamais conservé en clair.** Seule son empreinte l'est, et cette empreinte
 *     est liée au numéro : un code intercepté ne vaut rien sur une autre ligne.
 *  2. **Le nombre de tentatives est borné.** Six chiffres, c'est un million de possibilités —
 *     assez pour un humain, pas pour une machine qui essaierait sans limite.
 *  3. **Le code périme.** Un code sans expiration est un mot de passe permanent envoyé en clair
 *     par SMS.
 *
 * Logique pure : aucune I/O, aucune horloge, aucune primitive cryptographique. Le tirage du
 * code et le calcul de son empreinte vivent dans `infra/auth/otp-crypto.ts` — le domaine porte
 * la politique, pas l'algorithme.
 */


export interface OtpChallenge {
  readonly id: string;
  readonly msisdn: string;
  readonly codeHash: string;
  readonly emisA: string;
  readonly expireA: string;
  readonly tentatives: number;
  readonly maxTentatives: number;
  readonly consomme: boolean;
}

export class OtpError extends Error {
  constructor(
    message: string,
    nom: string,
    readonly challenge: OtpChallenge,
  ) {
    super(message);
    this.name = nom;
  }
}

export class CodeIncorrectError extends OtpError {
  constructor(challenge: OtpChallenge) {
    const restantes = Math.max(0, challenge.maxTentatives - challenge.tentatives);
    super(`code incorrect, ${restantes} essai(s) restant(s)`, 'CodeIncorrectError', challenge);
  }
}

export class CodeExpireError extends OtpError {
  constructor(challenge: OtpChallenge) {
    super('code expiré', 'CodeExpireError', challenge);
  }
}

export class TropDeTentativesError extends OtpError {
  constructor(challenge: OtpChallenge) {
    super('code épuisé, en demander un nouveau', 'TropDeTentativesError', challenge);
  }
}

export class MsisdnInvalideError extends Error {
  constructor(saisie: string) {
    super(`numéro inexploitable : « ${saisie} »`);
    this.name = 'MsisdnInvalideError';
  }
}

/**
 * Plans de numérotation desservis.
 *
 * Deux pays, deux plans, et ils ne se recouvrent pas : un numéro national sénégalais fait neuf
 * chiffres et commence par 7, un ivoirien en fait dix et commence par 0. Cette absence de
 * recouvrement est ce qui permet d'accepter une saisie locale sans demander l'indicatif à un
 * chauffeur qui lit sa carte SIM.
 *
 * **Seuls les mobiles sont acceptés.** Le système ne parle au chauffeur que par SMS : accepter
 * un fixe reviendrait à lui promettre un code qui n'arriverait jamais, et à lui laisser croire
 * que le service est en panne. Les préfixes fixes connus — 33 au Sénégal, 21/25/27 en Côte
 * d'Ivoire — sont donc refusés à la saisie.
 *
 * ⚠ Cette liste se périme. Un régulateur qui ouvre une nouvelle tranche mobile rend des
 * numéros parfaitement valides inutilisables ici. C'est le prix du refus des fixes, et il se
 * paie en la tenant à jour : ARTP pour le Sénégal, ARTCI pour la Côte d'Ivoire.
 */
const PLANS = [
  {
    /** Sénégal. Mobiles : 70 Expresso/Orange, 75 et 76 Free, 77 et 78 Orange. Fixe : 33. */
    indicatif: '221',
    longueurNationale: 9,
    prefixesMobiles: ['70', '75', '76', '77', '78'],
  },
  {
    /**
     * Côte d'Ivoire. Le plan est passé de huit à dix chiffres le 31 janvier 2021 : un ancien
     * numéro à huit chiffres ne joint plus personne, et le refuser vaut mieux que composer un
     * numéro mort. Mobiles : 01 Moov, 05 MTN, 07 Orange. Fixes : 21, 25, 27.
     */
    indicatif: '225',
    longueurNationale: 10,
    prefixesMobiles: ['01', '05', '07'],
  },
] as const;

function estMobileDuPlan(plan: (typeof PLANS)[number], national: string): boolean {
  return (
    national.length === plan.longueurNationale &&
    plan.prefixesMobiles.some((p) => national.startsWith(p))
  );
}

/**
 * Ramène une saisie humaine en E.164.
 *
 * Un chauffeur tape « 77 000 00 01 ». Lui demander un préfixe international serait lui faire
 * porter une contrainte de format qui nous appartient.
 *
 * Deux garanties, et ce sont les seules qui comptent : deux façons d'écrire le même numéro
 * donnent la même chaîne — sinon un chauffeur se retrouve avec deux comptes — et deux numéros
 * différents n'en donnent jamais une identique — sinon l'un reçoit les bons de l'autre.
 */
export function normaliserMsisdn(saisie: string): string {
  if (typeof saisie !== 'string') throw new MsisdnInvalideError(String(saisie));

  let chiffres = saisie.replace(/[\s.\-()]/g, '');
  if (chiffres.startsWith('+')) chiffres = chiffres.slice(1);
  else if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);

  if (!/^[0-9]+$/.test(chiffres)) throw new MsisdnInvalideError(saisie);

  // Forme internationale : l'indicatif désigne le plan, sans ambiguïté possible.
  for (const plan of PLANS) {
    if (!chiffres.startsWith(plan.indicatif)) continue;
    const national = chiffres.slice(plan.indicatif.length);
    if (estMobileDuPlan(plan, national)) return `+${plan.indicatif}${national}`;
  }

  // Forme locale : c'est la forme du numéro qui désigne le plan. Les deux ne se recouvrant
  // pas, au plus un plan peut reconnaître une saisie donnée.
  for (const plan of PLANS) {
    if (estMobileDuPlan(plan, chiffres)) return `+${plan.indicatif}${chiffres}`;
  }

  throw new MsisdnInvalideError(saisie);
}

/**
 * Comparaison a duree constante de deux empreintes hexadecimales.
 *
 * Ecrite en JavaScript pur pour que le domaine reste sans dependance. Le temps d'execution ne
 * depend pas de la position de la premiere difference : toutes les positions sont parcourues.
 */
export function empreintesEgales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) {
    ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return ecart === 0;
}

export interface CreerChallengeInput {
  readonly id: string;
  readonly msisdn: string;
  /** Empreinte du code, calculee par l'appelant. Le code en clair n'entre jamais ici. */
  readonly codeHash: string;
  readonly emisA: string;
  readonly dureeSecondes: number;
  readonly maxTentatives: number;
}

export function creerChallenge(input: CreerChallengeInput): OtpChallenge {
  const emis = Date.parse(input.emisA);
  if (Number.isNaN(emis)) throw new MsisdnInvalideError(input.emisA);

  return {
    id: input.id,
    msisdn: input.msisdn,
    codeHash: input.codeHash,
    emisA: input.emisA,
    expireA: new Date(emis + input.dureeSecondes * 1000).toISOString(),
    tentatives: 0,
    maxTentatives: input.maxTentatives,
    consomme: false,
  };
}

export interface ConsommationResult {
  readonly msisdn: string;
  readonly challenge: OtpChallenge;
}

/**
 * Vérifie un code et rend le défi consommé.
 *
 * En cas d'échec, l'exception porte le défi mis à jour : c'est l'appelant qui le persiste, pour
 * que le compteur de tentatives avance même quand la vérification échoue. Sans cela, la limite
 * ne limiterait rien.
 */
export function consommerCode(
  challenge: OtpChallenge,
  codeHashFourni: string,
  asOf: string,
): ConsommationResult {
  if (challenge.consomme || challenge.tentatives >= challenge.maxTentatives) {
    throw new TropDeTentativesError(challenge);
  }

  const maintenant = Date.parse(asOf);
  if (Number.isNaN(maintenant)) throw new MsisdnInvalideError(asOf);
  if (maintenant >= Date.parse(challenge.expireA)) {
    throw new CodeExpireError(challenge);
  }

  if (!empreintesEgales(challenge.codeHash, codeHashFourni)) {
    throw new CodeIncorrectError({ ...challenge, tentatives: challenge.tentatives + 1 });
  }

  return {
    msisdn: challenge.msisdn,
    challenge: { ...challenge, tentatives: challenge.tentatives + 1, consomme: true },
  };
}
