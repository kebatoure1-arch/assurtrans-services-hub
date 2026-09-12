/**
 * Worker d'envoi des bons.
 *
 * Le chauffeur a payé, son bon existe, il est en file — et il ne partait jamais. C'était la
 * dernière marche manquante du parcours : la file était en écriture seule.
 *
 * Trois choix structurent ce fichier.
 *
 * **Le jeton se reconstruit.** La file ne le conserve pas, délibérément : un jeton signé vaut
 * du carburant, et une table de journalisation d'envois n'est pas l'endroit où l'entreposer.
 * Le worker le refabrique à partir du bon, à l'instant d'expédier, et il ne vit que le temps de
 * l'appel. Il n'entre ni dans un motif d'échec, ni dans un journal.
 *
 * **On n'expédie que ce qui sert encore.** Un bon consommé, annulé ou périmé ne part pas :
 * envoyer son QR ferait présenter au chauffeur un code qui sera refusé à la pompe, ce qui est
 * pire que ne rien envoyer.
 *
 * **Réessayer est ici légitime**, contrairement au règlement. Un bon est à usage unique et son
 * jeton est déterministe : deux envois donnent deux fois le même code, dont un seul servira.
 * Deux versements, eux, sont deux versements — d'où l'interdiction absolue de reprise côté
 * canal de règlement. La distinction tient à ce qu'on duplique, pas à la prudence.
 */

import type { XOF } from '../domain/money.ts';
import type { FuelVoucher } from '../domain/fuel-voucher.ts';
import type { AuditLogger } from '../ports/audit.ts';
import type { ExpediteurDeBon } from '../ports/envoi.ts';
import type { VoucherDeliveryQueue } from '../ports/repositories.ts';
import type { VerrouTravaux } from '../ports/verrou.ts';

export const NOM_TRAVAIL = 'envoi-des-bons';

export interface BilanEnvoi {
  readonly reclames: number;
  readonly envoyes: number;
  readonly echoues: number;
  /** Renseigné quand le passage n'a rien fait, et pourquoi. */
  readonly ignore?: 'verrou';
}

/** Le strict nécessaire pour retrouver un bon : le worker n'écrit jamais dessus. */
export interface LectureDesBons {
  findById(id: string): Promise<FuelVoucher | null>;
}

/** Le strict nécessaire pour refabriquer un jeton. */
export interface SigneurDeBon {
  sign(charge: { id: string; montant: XOF; expireA: string }): string;
}

export interface EnvoiDeps {
  readonly file: VoucherDeliveryQueue;
  readonly expediteur: ExpediteurDeBon;
  readonly verrou: VerrouTravaux;
  readonly bons: LectureDesBons;
  readonly signer: SigneurDeBon;
  readonly horloge: () => string;
  /**
   * Au-delà, on cesse de réessayer. La ligne reste visible dans les incidents du tableau de
   * bord — un numéro qui ne répond pas demande un humain, pas une boucle.
   */
  readonly maxTentatives: number;
  readonly parPassage?: number;
  readonly audit?: AuditLogger;
}

export class EnvoyerLesBons {
  constructor(private readonly deps: EnvoiDeps) {}

  async executer(): Promise<BilanEnvoi> {
    if (!(await this.deps.verrou.prendre(NOM_TRAVAIL))) {
      return { reclames: 0, envoyes: 0, echoues: 0, ignore: 'verrou' };
    }

    try {
      const aFaire = await this.deps.file.reclamer(
        this.deps.parPassage ?? 25,
        this.deps.maxTentatives,
      );

      let envoyes = 0;
      let echoues = 0;

      for (const envoi of aFaire) {
        // Chaque envoi est isolé : un numéro injoignable ne doit pas prendre les suivants en
        // otage, et c'est précisément le cas où la file s'allonge.
        if (await this.expedier(envoi.id, envoi.voucherId, envoi.destinataire)) envoyes += 1;
        else echoues += 1;
      }

      return { reclames: aFaire.length, envoyes, echoues };
    } finally {
      await this.deps.verrou.rendre(NOM_TRAVAIL);
    }
  }

  private async expedier(
    envoiId: string,
    voucherId: string,
    destinataire: string,
  ): Promise<boolean> {
    const bon = await this.deps.bons.findById(voucherId);
    if (bon === null) {
      await this.renoncer(envoiId, `bon ${voucherId} introuvable`);
      return false;
    }

    const refus = this.raisonDeNePasEnvoyer(bon);
    if (refus !== null) {
      await this.renoncer(envoiId, refus);
      return false;
    }

    // Le jeton naît ici et meurt à la fin de cette méthode. Il n'est stocké nulle part.
    const token = this.deps.signer.sign({
      id: bon.id,
      montant: bon.montant,
      expireA: bon.expireA,
    });

    let resultat;
    try {
      resultat = await this.deps.expediteur.envoyer({
        voucherId: bon.id,
        destinataire,
        montant: bon.montant,
        token,
        expireA: bon.expireA,
      });
    } catch (cause) {
      // Un expéditeur qui lève est un échec d'envoi, pas une panne du worker.
      resultat = {
        kind: 'ECHEC' as const,
        motif: cause instanceof Error ? cause.message : String(cause),
      };
    }

    if (resultat.kind === 'ENVOYE') {
      await this.deps.file.marquerEnvoye(envoiId, resultat.reference, this.deps.expediteur.canal);
      // Le destinataire n'est pas journalisé : l'audit répond à « quoi, quand, sur quoi », pas
      // à « quel numéro de téléphone ».
      await this.tracer('BON_ENVOYE', bon.id, { canal: this.deps.expediteur.canal });
      return true;
    }

    await this.renoncer(envoiId, resultat.motif);
    return false;
  }

  /**
   * Pourquoi ce bon ne doit pas partir, ou `null` s'il doit partir.
   *
   * L'ordre n'a pas d'importance ici : un bon dans l'un de ces états ne redeviendra jamais
   * envoyable, et la ligne sera close.
   */
  private raisonDeNePasEnvoyer(bon: FuelVoucher): string | null {
    if (bon.statut === 'CONSOMME') return 'bon déjà consommé : le QR serait refusé à la pompe';
    if (bon.statut === 'ANNULE') return 'bon annulé';
    if (bon.expireA <= this.deps.horloge()) return 'bon périmé avant d’avoir pu être envoyé';
    return null;
  }

  private async renoncer(envoiId: string, motif: string): Promise<void> {
    await this.deps.file.marquerEchec(
      envoiId,
      motif,
      this.deps.maxTentatives,
      this.deps.expediteur.canal,
    );
  }

  private async tracer(
    action: string,
    voucherId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // `actor` vaut « envoi » : aucune personne n'a agi.
    await this.deps.audit?.enregistrer({
      actor: 'envoi',
      action,
      targetType: 'fuel_voucher',
      targetId: voucherId,
      payload,
    });
  }
}
