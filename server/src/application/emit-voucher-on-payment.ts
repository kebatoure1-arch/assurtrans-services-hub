/**
 * Cas d'usage : un paiement de chauffeur est confirmé → un bon carburant est émis.
 *
 * Deux invariants portent tout le reste :
 *
 *  1. **Un paiement finance exactement un bon.** Le webhook de confirmation sera rejoué ; il ne
 *     doit jamais produire un second bon. L'unicité est portée par la persistance, pas par une
 *     vérification en mémoire.
 *  2. **Le montant du bon est celui du paiement.** Aucun arrondi, aucun bonus, aucune remise
 *     appliquée ici. Si une remise doit exister un jour, elle change le montant *payé*, pas
 *     l'écart entre le payé et le bon.
 */

import type { XOF } from '../domain/money';
import { emitVoucher, type FuelVoucher } from '../domain/fuel-voucher';
import type { VoucherSigner } from '../infra/security/voucher-signature';
import type {
  DriverPaymentRepository,
  DriverRepository,
  IdGenerator,
  VoucherDeliveryQueue,
  VoucherRepository,
} from '../ports/repositories';

export class EmissionRefuseeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmissionRefuseeError';
  }
}

export interface ConfirmedPayment {
  readonly canal: string;
  readonly reference: string;
  readonly driverId: string;
  readonly montant: XOF;
  readonly recuA: string;
}

export interface EmissionResult {
  readonly bon: FuelVoucher;
  /** Jeton signé à encoder dans le QR. */
  readonly token: string;
  /** `true` si le paiement avait déjà produit ce bon — rejeu de webhook. */
  readonly deja: boolean;
  /** `true` si la mise en file de l'envoi a échoué. Le bon existe malgré tout. */
  readonly envoiEnEchec: boolean;
}

export interface EmitVoucherDeps {
  readonly paiements: DriverPaymentRepository;
  readonly bons: VoucherRepository;
  readonly chauffeurs: DriverRepository;
  readonly file: VoucherDeliveryQueue;
  readonly signer: VoucherSigner;
  readonly idsPaiement: IdGenerator;
  readonly idsBon: IdGenerator;
  readonly validiteHeures: number;
}

export class EmitVoucherOnPayment {
  constructor(private readonly deps: EmitVoucherDeps) {}

  async execute(paiement: ConfirmedPayment): Promise<EmissionResult> {
    const { paiements, bons, chauffeurs } = this.deps;

    const chauffeur = await chauffeurs.findById(paiement.driverId);
    if (chauffeur === null) {
      throw new EmissionRefuseeError(`chauffeur ${paiement.driverId} inconnu`);
    }
    if (chauffeur.statut === 'SUSPENDU') {
      throw new EmissionRefuseeError(`chauffeur ${paiement.driverId} suspendu`);
    }

    // Le paiement d'abord : c'est lui qui porte l'unicité `(canal, reference)`.
    const existant = await paiements.findByReference(paiement.canal, paiement.reference);
    if (existant !== null) {
      const dejaEmis = await bons.findByPaymentId(existant.id);
      if (dejaEmis !== null) {
        return {
          bon: dejaEmis,
          token: this.signe(dejaEmis),
          deja: true,
          envoiEnEchec: false,
        };
      }
      // Paiement enregistré mais bon absent : un incident a interrompu l'émission. On la reprend
      // plutôt que de laisser un chauffeur payé sans bon.
      return this.emettre(existant.id, paiement, chauffeur.msisdn);
    }

    const paymentId = this.deps.idsPaiement.next();
    const nouveau = await paiements.saveIfNew({
      id: paymentId,
      driverId: paiement.driverId,
      montant: paiement.montant,
      canal: paiement.canal,
      reference: paiement.reference,
      recuA: paiement.recuA,
    });

    if (!nouveau) {
      // Course entre deux livraisons du même webhook : l'autre a gagné, on relit son résultat.
      const gagnant = await paiements.findByReference(paiement.canal, paiement.reference);
      const bon = gagnant ? await bons.findByPaymentId(gagnant.id) : null;
      if (bon !== null) {
        return { bon, token: this.signe(bon), deja: true, envoiEnEchec: false };
      }
      throw new EmissionRefuseeError(
        `paiement ${paiement.canal}/${paiement.reference} enregistré sans bon exploitable`,
      );
    }

    return this.emettre(paymentId, paiement, chauffeur.msisdn);
  }

  private signe(bon: FuelVoucher): string {
    return this.deps.signer.sign({
      id: bon.id,
      montant: bon.montant,
      expireA: bon.expireA,
    });
  }

  private async emettre(
    paymentId: string,
    paiement: ConfirmedPayment,
    msisdn: string,
  ): Promise<EmissionResult> {
    const bon = emitVoucher({
      id: this.deps.idsBon.next(),
      driverId: paiement.driverId,
      montant: paiement.montant,
      emisA: paiement.recuA,
      validiteHeures: this.deps.validiteHeures,
      paymentRef: `${paiement.canal}/${paiement.reference}`,
    });

    const enregistre = await this.deps.bons.saveIfNew(bon, paymentId);
    if (!enregistre) {
      const gagnant = await this.deps.bons.findByPaymentId(paymentId);
      if (gagnant === null) {
        throw new EmissionRefuseeError(`émission concurrente non résolue pour ${paymentId}`);
      }
      return { bon: gagnant, token: this.signe(gagnant), deja: true, envoiEnEchec: false };
    }

    const token = this.signe(bon);

    // L'envoi est mis en file APRÈS l'enregistrement du bon, et son échec ne défait rien : le
    // chauffeur a payé, son bon existe, il est consultable. L'envoi sera réessayé.
    let envoiEnEchec = false;
    try {
      await this.deps.file.enqueue({
        voucherId: bon.id,
        destinataire: msisdn,
        montant: bon.montant,
        token,
        expireA: bon.expireA,
      });
    } catch {
      envoiEnEchec = true;
    }

    return { bon, token, deja: false, envoiEnEchec };
  }
}
