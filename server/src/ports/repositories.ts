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
export interface VoucherDeliveryQueue {
  enqueue(demande: DeliveryRequest): Promise<string>;
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
