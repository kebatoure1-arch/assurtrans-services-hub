/**
 * Ports de persistance du cycle de règlement.
 *
 * Comme pour les bons, l'atomicité ne se joue pas dans le code applicatif mais dans la base.
 * Deux méthodes portent cette garantie et deviennent des écritures conditionnelles :
 *
 *  - `PaymentIntentRepository.saveIfStatut` — `UPDATE ... WHERE statut = $attendu`. C'est elle
 *    qui empêche deux administrateurs d'approuver puis d'exécuter la même intention en même
 *    temps. Sans elle, deux clics simultanés produiraient deux versements.
 *  - `PaymentIntentRepository.saveIfNew` — l'index unique sur la clé d'idempotence. Rejouer le
 *    job d'échéance cinq fois ne crée qu'une intention.
 *
 * Une facture ne porte qu'une intention vivante à la fois, garanti par un index unique partiel
 * en base. Le code ne le vérifie pas par une lecture préalable : entre la lecture et l'écriture,
 * une autre transaction passerait.
 */

import type { XOF } from '../domain/money.ts';
import type { PaymentIntent, PaymentIntentStatut } from '../domain/payment-intent.ts';

export type InvoiceStatut = 'OUVERTE' | 'ORDONNANCEE' | 'REGLEE' | 'LETTREE' | 'LITIGE';

export interface Invoice {
  readonly id: string;
  readonly contractId: string;
  readonly numero: string;
  readonly periodeDebut: string;
  readonly periodeFin: string;
  readonly montant: XOF;
  readonly dateEmission: string;
  readonly dateEcheance: string;
  readonly statut: InvoiceStatut;
}

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  /** `false` si le couple `(contrat, numéro)` existe déjà : une facture ne s'enregistre qu'une fois. */
  saveIfNew(facture: Invoice): Promise<boolean>;
  /** Factures du contrat, de la plus récemment échue à la plus ancienne. */
  lister(contractId: string, limite: number): Promise<readonly Invoice[]>;
  changerStatut(id: string, statut: InvoiceStatut): Promise<boolean>;
}

export interface PaymentIntentRepository {
  findById(id: string): Promise<PaymentIntent | null>;
  /**
   * `false` si une intention vivante existe déjà pour cette facture, ou si la clé d'idempotence
   * est déjà prise. Les deux cas viennent d'index uniques ; le code ne les distingue pas, parce
   * que la conduite à tenir est la même : ne rien créer de plus.
   */
  saveIfNew(intent: PaymentIntent): Promise<boolean>;
  /** Écriture conditionnelle. `false` si le statut en base n'est plus celui attendu. */
  saveIfStatut(intent: PaymentIntent, statutAttendu: PaymentIntentStatut): Promise<boolean>;
  /** Intentions du contrat, de la plus récente à la plus ancienne. */
  lister(contractId: string, limite: number): Promise<readonly PaymentIntent[]>;
  /**
   * Cumul des montants déjà engagés aujourd'hui, hors intention courante.
   *
   * Ce que « engagé » recouvre : tout ce qui est parti ou est en train de partir. Une intention
   * annulée ou échouée n'engage rien.
   *
   * `saufIntentId` exclut l'intention courante, pour ne pas la compter deux fois lorsqu'on
   * vérifie son propre plafond. `null` quand on veut le total, sans exclusion — l'appelant n'a
   * pas à inventer un identifiant qui n'existe pas.
   */
  cumulDuJour(contractId: string, jourIso: string, saufIntentId: string | null): Promise<XOF>;
}
