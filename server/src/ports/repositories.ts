/**
 * Ports de persistance.
 *
 * Les cas d'usage ne connaissent que ces interfaces. Deux d'entre elles portent une garantie
 * qui ne peut pas être tenue en mémoire applicative et qui devra l'être par la base :
 *
 *  - `DriverPaymentRepository.saveIfNew` — unicité `(canal, reference)`.
 *  - `VoucherRepository.saveIfStatut` — écriture conditionnelle sur le statut, qui devient un
 *    `UPDATE ... WHERE statut = $attendu`. C'est elle qui rend la consommation d'un bon atomique
 *    face à deux pompistes qui scannent au même instant.
 */

import type { XOF } from '../domain/money.ts';
import type { FuelVoucher, VoucherStatut } from '../domain/fuel-voucher.ts';

export interface DriverPayment {
  readonly id: string;
  readonly driverId: string;
  readonly montant: XOF;
  readonly canal: string;
  readonly reference: string;
  readonly recuA: string;
}

export interface DriverPaymentRepository {
  findByReference(canal: string, reference: string): Promise<DriverPayment | null>;
  /** `false` si un paiement portant déjà ce couple `(canal, reference)` existe. */
  saveIfNew(paiement: DriverPayment): Promise<boolean>;
}

export interface VoucherRepository {
  findById(id: string): Promise<FuelVoucher | null>;
  findByPaymentId(paymentId: string): Promise<FuelVoucher | null>;
  /** `false` si un bon existe déjà pour ce paiement. Un paiement ne finance qu'un bon. */
  saveIfNew(bon: FuelVoucher, paymentId: string): Promise<boolean>;
  /**
   * Écriture conditionnelle. `false` si le statut en base n'est plus `statutAttendu` — autrement
   * dit si quelqu'un d'autre est passé avant.
   */
  saveIfStatut(bon: FuelVoucher, statutAttendu: VoucherStatut): Promise<boolean>;
  /** Bons d'un chauffeur, du plus recent au plus ancien. */
  listerParChauffeur(driverId: string, limite: number): Promise<readonly FuelVoucher[]>;
}

export interface Driver {
  readonly id: string;
  readonly nom: string;
  readonly msisdn: string;
  readonly statut: 'ACTIF' | 'SUSPENDU';
}

export interface DriverRepository {
  findById(id: string): Promise<Driver | null>;
}

export interface DeliveryRequest {
  readonly voucherId: string;
  readonly destinataire: string;
  readonly montant: XOF;
  readonly token: string;
  readonly expireA: string;
}

/**
 * File d'envoi du QR.
 *
 * Mise en file, pas envoi direct : un chauffeur qui a payé possède son bon même si WhatsApp est
 * indisponible. L'envoi est réessayable ; l'émission du bon ne l'est pas.
 */
/** Une ligne de la file, telle que le worker la reçoit. Le jeton n'y figure pas. */
export interface EnvoiAFaire {
  readonly id: string;
  readonly voucherId: string;
  readonly destinataire: string;
  /** Tentatives déjà faites. Sert à savoir quand renoncer. */
  readonly tentatives: number;
}

export interface VoucherDeliveryQueue {
  enqueue(demande: DeliveryRequest): Promise<string>;

  /**
   * Réclame des envois à faire, en les marquant siens **atomiquement**.
   *
   * Deux workers ne doivent pas expédier le même bon : la réclamation est une écriture
   * conditionnelle, pas une lecture suivie d'une écriture. Les lignes ayant déjà épuisé
   * `maxTentatives` ne sont plus rendues — on ne réessaie pas indéfiniment un numéro qui ne
   * répond pas, on le laisse visible en incident.
   */
  reclamer(limite: number, maxTentatives: number): Promise<readonly EnvoiAFaire[]>;

  marquerEnvoye(id: string, reference: string | null): Promise<void>;

  /** Remet la ligne en attente si des tentatives restent, la clôt en échec sinon. */
  marquerEchec(id: string, motif: string, maxTentatives: number): Promise<void>;
}

export interface CheckoutSession {
  readonly reference: string;
  readonly driverId: string;
  readonly montant: XOF;
  readonly canal: string;
  readonly sessionId: string | null;
}

/**
 * Sessions de paiement ouvertes.
 *
 * Le webhook de confirmation ne transporte que notre référence. C'est ici qu'on retrouve à qui
 * elle appartient et quel montant avait été demandé — le second sert à refuser un webhook qui
 * annoncerait autre chose.
 */
export interface CheckoutSessionRepository {
  findByReference(reference: string): Promise<CheckoutSession | null>;
  save(session: CheckoutSession): Promise<void>;
  attacherSessionId(reference: string, sessionId: string): Promise<void>;
}

/** Génération d'identifiants. Injectée pour que les tests soient déterministes. */
export interface IdGenerator {
  next(): string;
}
