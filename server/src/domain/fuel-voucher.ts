/**
 * Bon carburant à usage unique.
 *
 * Le chauffeur paie un montant précis, reçoit un bon de ce montant, le présente en station,
 * le pompiste le consomme. Le bon ne porte aucun solde : il vaut exactement ce qui a été payé,
 * une seule fois, et il périme.
 *
 * C'est ce qui distingue un achat payé d'avance d'une valeur stockée. Voir ADR-003.
 *
 * Logique pure : aucune I/O, aucune horloge. La date de référence est toujours passée en
 * paramètre — un bon ne doit jamais dépendre de l'heure de la machine qui l'évalue.
 */

import { positiveXof, type XOF } from './money';

export type VoucherStatut = 'EMIS' | 'CONSOMME' | 'ANNULE';

export interface FuelVoucher {
  /** Identifiant public, porté par le QR. */
  readonly id: string;
  readonly driverId: string;
  /** Montant figé à l'émission. Ni rechargeable, ni fractionnable. */
  readonly montant: XOF;
  readonly statut: VoucherStatut;
  readonly emisA: string;
  readonly expireA: string;
  /** Référence de l'encaissement qui a financé ce bon. Un bon sans paiement n'existe pas. */
  readonly paymentRef: string;
  readonly consommeA: string | null;
  readonly stationId: string | null;
  readonly operateurId: string | null;
  /**
   * Identifiant du scan qui a consommé le bon. Permet de distinguer un rejeu réseau du même
   * pompiste (inoffensif) d'une seconde présentation (fraude ou double service).
   */
  readonly redemptionId: string | null;
  readonly motifAnnulation: string | null;
}

export class VoucherError extends Error {
  constructor(message: string, nom: string) {
    super(message);
    this.name = nom;
  }
}

export class AlreadyRedeemedError extends VoucherError {
  constructor(bon: FuelVoucher) {
    super(
      `bon ${bon.id} déjà consommé le ${bon.consommeA} à la station ${bon.stationId} ` +
        `par l'opérateur ${bon.operateurId}`,
      'AlreadyRedeemedError',
    );
  }
}

export class VoucherExpiredError extends VoucherError {
  constructor(bon: FuelVoucher, asOf: string) {
    super(`bon ${bon.id} expiré le ${bon.expireA}, présenté le ${asOf}`, 'VoucherExpiredError');
  }
}

export class VoucherCancelledError extends VoucherError {
  constructor(bon: FuelVoucher) {
    super(
      `bon ${bon.id} annulé${bon.motifAnnulation ? ` : ${bon.motifAnnulation}` : ''}`,
      'VoucherCancelledError',
    );
  }
}

const HEURE_MS = 3_600_000;

function parseInstant(iso: string, quoi: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    throw new VoucherError(`${quoi} : instant ISO 8601 attendu, reçu « ${iso} »`, 'VoucherError');
  }
  return t;
}

export interface EmitVoucherInput {
  readonly id: string;
  readonly driverId: string;
  readonly montant: XOF;
  readonly emisA: string;
  readonly validiteHeures: number;
  readonly paymentRef: string;
}

export function emitVoucher(input: EmitVoucherInput): FuelVoucher {
  const montant = positiveXof(input.montant);

  if (!Number.isInteger(input.validiteHeures) || input.validiteHeures <= 0) {
    throw new VoucherError(
      `validité en heures entières > 0 attendue, reçu ${input.validiteHeures}`,
      'VoucherError',
    );
  }
  if (!input.paymentRef) {
    throw new VoucherError('bon sans référence de paiement : émission refusée', 'VoucherError');
  }

  const emis = parseInstant(input.emisA, 'date d’émission');

  return {
    id: input.id,
    driverId: input.driverId,
    montant,
    statut: 'EMIS',
    emisA: input.emisA,
    expireA: new Date(emis + input.validiteHeures * HEURE_MS).toISOString(),
    paymentRef: input.paymentRef,
    consommeA: null,
    stationId: null,
    operateurId: null,
    redemptionId: null,
    motifAnnulation: null,
  };
}

/** Un bon consommé n'expire jamais : il a déjà produit son effet. */
export function estExpire(bon: FuelVoucher, asOf: string): boolean {
  if (bon.statut !== 'EMIS') return false;
  return parseInstant(asOf, 'date de référence') > parseInstant(bon.expireA, 'date d’expiration');
}

export interface RedeemInput {
  /**
   * Identifiant du scan. Deux scans successifs du même pompiste sur un réseau instable portent
   * le même identifiant ; deux présentations distinctes en portent deux.
   */
  readonly redemptionId: string;
  readonly stationId: string;
  readonly operateurId: string;
  readonly asOf: string;
}

export interface RedeemResult {
  readonly next: FuelVoucher;
  /** `false` si l'appel est un rejeu du même scan. Le carburant n'est servi qu'une fois. */
  readonly changed: boolean;
}

export function redeemVoucher(bon: FuelVoucher, input: RedeemInput): RedeemResult {
  if (bon.statut === 'ANNULE') {
    throw new VoucherCancelledError(bon);
  }

  if (bon.statut === 'CONSOMME') {
    // Même scan rejoué : on confirme sans rien changer. Le pompiste ne doit pas voir d'erreur
    // pour une reprise réseau, et le carburant n'est pas servi une seconde fois.
    if (bon.redemptionId === input.redemptionId) {
      return { next: bon, changed: false };
    }
    throw new AlreadyRedeemedError(bon);
  }

  if (estExpire(bon, input.asOf)) {
    throw new VoucherExpiredError(bon, input.asOf);
  }

  return {
    next: {
      ...bon,
      statut: 'CONSOMME',
      consommeA: input.asOf,
      stationId: input.stationId,
      operateurId: input.operateurId,
      redemptionId: input.redemptionId,
    },
    changed: true,
  };
}

export interface CancelInput {
  readonly actor: string;
  readonly motif: string;
}

export function cancelVoucher(bon: FuelVoucher, input: CancelInput): FuelVoucher {
  if (bon.statut === 'CONSOMME') {
    // Le carburant est parti : annuler le bon ne le fait pas revenir. C'est un remboursement,
    // décidé et tracé ailleurs.
    throw new AlreadyRedeemedError(bon);
  }
  if (bon.statut === 'ANNULE') return bon;
  if (!input.motif) {
    throw new VoucherError('annulation sans motif refusée', 'VoucherError');
  }
  return { ...bon, statut: 'ANNULE', motifAnnulation: input.motif };
}
