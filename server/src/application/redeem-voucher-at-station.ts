/**
 * Cas d'usage : le pompiste scanne le QR, le bon est consommé, le carburant peut être servi.
 *
 * Ordre des contrôles, du moins coûteux au plus coûteux, et du plus discriminant au moins :
 *
 *  1. Signature du jeton — écarte les QR forgés sans toucher la base.
 *  2. Existence du bon en base.
 *  3. **Cohérence du montant jeton ↔ base.** La base fait foi. Un jeton correctement signé mais
 *     dont le montant diffère signale une clé de signature compromise : on refuse, et on ne sert
 *     surtout pas le montant du jeton.
 *  4. Consommation atomique par écriture conditionnelle.
 *
 * La signature répond à « ce bon vient bien de nous ». Elle ne répond pas à « ce bon n'a pas
 * déjà servi » : seule la base le sait. C'est pourquoi la consommation exige un appel serveur.
 */

import type { XOF } from '../domain/money.ts';
import { AlreadyRedeemedError, redeemVoucher } from '../domain/fuel-voucher.ts';
import type { VoucherSigner } from '../infra/security/voucher-signature.ts';
import type { VoucherRepository } from '../ports/repositories.ts';

export class VoucherIntrouvableError extends Error {
  constructor(id: string) {
    super(`bon ${id} introuvable`);
    this.name = 'VoucherIntrouvableError';
  }
}

export class MontantIncoherentError extends Error {
  constructor(id: string, montantJeton: number, montantBase: XOF) {
    super(
      `bon ${id} : le QR annonce ${montantJeton} XOF, la base en enregistre ${montantBase}. ` +
        'Consommation refusée — incident de sécurité à traiter.',
    );
    this.name = 'MontantIncoherentError';
  }
}

export interface RedeemAtStationInput {
  /** Contenu brut du QR scanné. */
  readonly token: string;
  readonly stationId: string;
  readonly operateurId: string;
  /** Identifiant du scan. Un rescan après coupure réseau porte le même. */
  readonly redemptionId: string;
  readonly asOf: string;
}

export interface RedeemAtStationResult {
  readonly voucherId: string;
  /** Montant de carburant à servir. Provient de la base, jamais du QR. */
  readonly montant: XOF;
  /** `true` si c'est cet appel qui a consommé le bon. `false` pour un rejeu du même scan. */
  readonly servi: boolean;
}

export interface RedeemDeps {
  readonly bons: VoucherRepository;
  readonly signer: VoucherSigner;
}

export class RedeemVoucherAtStation {
  constructor(private readonly deps: RedeemDeps) {}

  async execute(input: RedeemAtStationInput): Promise<RedeemAtStationResult> {
    const charge = this.deps.signer.verify(input.token);

    const bon = await this.deps.bons.findById(charge.id);
    if (bon === null) throw new VoucherIntrouvableError(charge.id);

    if (charge.montant !== bon.montant) {
      throw new MontantIncoherentError(bon.id, charge.montant, bon.montant);
    }

    const { next, changed } = redeemVoucher(bon, {
      redemptionId: input.redemptionId,
      stationId: input.stationId,
      operateurId: input.operateurId,
      asOf: input.asOf,
    });

    if (!changed) {
      // Rejeu du même scan : rien à écrire, le pompiste voit une confirmation, pas une erreur.
      return { voucherId: bon.id, montant: bon.montant, servi: false };
    }

    const ecrit = await this.deps.bons.saveIfStatut(next, 'EMIS');
    if (!ecrit) {
      // Un autre pompiste est passé entre la lecture et l'écriture. On relit pour lui dire
      // précisément ce qui s'est produit plutôt que de servir une seconde fois.
      const actuel = await this.deps.bons.findById(bon.id);
      if (actuel !== null && actuel.statut === 'CONSOMME') {
        if (actuel.redemptionId === input.redemptionId) {
          return { voucherId: actuel.id, montant: actuel.montant, servi: false };
        }
        throw new AlreadyRedeemedError(actuel);
      }
      throw new VoucherIntrouvableError(bon.id);
    }

    return { voucherId: next.id, montant: next.montant, servi: true };
  }
}
