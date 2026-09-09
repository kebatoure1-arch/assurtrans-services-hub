/**
 * Reprise des envois interrompus.
 *
 * Une intention laissée en `DISPATCHING` par un arrêt brutal est le seul endroit du système où
 * de l'argent peut disparaître sans laisser de question derrière lui : l'ordre est peut-être
 * parti, personne ne le sait, et rien ne le rappelle. L'invariant « clé d'idempotence écrite
 * avant l'appel sortant » existe pour rendre cette reprise possible ; ce fichier est ce qui
 * s'en sert.
 *
 * Une seule règle gouverne tout :
 *
 *   **On ne réémet jamais.**
 *
 * La reprise interroge le fournisseur et enregistre ce qu'il répond. Quand il ne répond pas
 * clairement — et sur les canaux réels, faute d'endpoint de recherche par clé d'idempotence, il
 * ne répondra jamais clairement — l'intention part en revue humaine. C'est un aveu, pas un
 * échec : la seule alternative serait de deviner, et deviner sur un mouvement d'argent paie
 * deux fois ou pas du tout.
 *
 * Deux précautions moins évidentes :
 *
 *  - **Un délai.** On ne touche pas une intention passée en `DISPATCHING` il y a dix secondes :
 *    l'appel sortant est peut-être encore en vol dans un autre processus. La reprise lui
 *    volerait son intention et le ferait échouer sur une écriture conditionnelle refusée.
 *  - **Un verrou.** Deux exemplaires du serveur reprendraient les mêmes ordres en même temps.
 */

import { absDelta, delta } from '../../domain/money.ts';
import { transition, type PaymentIntent } from '../../domain/payment-intent.ts';
import type { AuditLogger } from '../../ports/audit.ts';
import type { SettlementChannel, SettlementLookup } from '../../ports/settlement-channel.ts';
import type { PaymentIntentRepository } from '../../ports/settlement.ts';
import type { VerrouTravaux } from '../../ports/verrou.ts';

export const NOM_TRAVAIL = 'reprise-envois';

export interface BilanReprise {
  /** Intentions interrompues rencontrées. */
  readonly examinees: number;
  /** Ordres que le fournisseur a confirmé connaître, passés en `SENT`. */
  readonly retrouvees: number;
  /** Intentions confiées à un humain. */
  readonly enRevue: number;
  /** Renseigné quand la reprise n'a rien fait, et pourquoi. */
  readonly ignoree?: 'verrou';
}

export interface RepriseDeps {
  readonly intentions: PaymentIntentRepository;
  readonly canal: SettlementChannel;
  readonly verrou: VerrouTravaux;
  readonly horloge: () => string;
  /**
   * Âge minimal d'une intention avant qu'on ose y toucher. En dessous, l'appel sortant peut
   * encore être en cours ailleurs.
   */
  readonly delaiAvantRepriseSecondes: number;
  readonly audit?: AuditLogger;
  /** Borne le travail d'un passage : mieux vaut plusieurs passages qu'un balayage sans fin. */
  readonly parPassage?: number;
}

export class ReprendreEnvoisInterrompus {
  constructor(private readonly deps: RepriseDeps) {}

  async executer(): Promise<BilanReprise> {
    if (!(await this.deps.verrou.prendre(NOM_TRAVAIL))) {
      return { examinees: 0, retrouvees: 0, enRevue: 0, ignoree: 'verrou' };
    }

    try {
      const avant = new Date(
        Date.parse(this.deps.horloge()) - this.deps.delaiAvantRepriseSecondes * 1000,
      ).toISOString();

      const interrompues = await this.deps.intentions.listerInterrompues(
        avant,
        this.deps.parPassage ?? 50,
      );

      let retrouvees = 0;
      let enRevue = 0;

      for (const intention of interrompues) {
        // Une intention est traitée isolément : une course perdue sur l'une ne doit pas laisser
        // les suivantes bloquées un passage de plus.
        const sort = await this.traiter(intention);
        if (sort === 'RETROUVEE') retrouvees += 1;
        if (sort === 'EN_REVUE') enRevue += 1;
      }

      return { examinees: interrompues.length, retrouvees, enRevue };
    } finally {
      await this.deps.verrou.rendre(NOM_TRAVAIL);
    }
  }

  private async traiter(intention: PaymentIntent): Promise<'RETROUVEE' | 'EN_REVUE' | 'INCHANGEE'> {
    const reponse = await this.consulter(intention);

    if (reponse.kind === 'FOUND') {
      // Le fournisseur connaît l'ordre. Reste à vérifier qu'il porte bien le montant décidé :
      // de l'argent parti pour une autre somme n'est pas un succès, c'est un incident.
      const ecart =
        reponse.montant === null ? 0 : absDelta(delta(intention.montant, reponse.montant));

      if (ecart !== 0) {
        return (await this.versRevue(
          intention,
          `ordre retrouvé chez le fournisseur pour ${reponse.montant} XOF, ` +
            `alors que ${intention.montant} XOF avaient été ordonnés`,
        ))
          ? 'EN_REVUE'
          : 'INCHANGEE';
      }

      const ecrit = await this.appliquer(intention, (i) =>
        transition(
          i,
          { type: 'DISPATCH_ACK', payoutId: reponse.payoutId },
          this.contexteInerte(i),
        ).next,
      );
      if (ecrit) {
        await this.tracer(intention, 'REGLEMENT_REPRIS', { payoutId: reponse.payoutId });
      }
      return ecrit ? 'RETROUVEE' : 'INCHANGEE';
    }

    if (reponse.kind === 'NOT_FOUND') {
      // On ne conclut PAS « rien n'est parti ». Conclure d'une absence demanderait de faire
      // confiance à un endpoint dont le contrat n'est pas documenté ; se tromper rendrait une
      // facture rejouable alors qu'elle a déjà été payée.
      return (await this.versRevue(
        intention,
        `le fournisseur ne connaît pas l'ordre « ${intention.wavePayoutId ?? intention.idempotencyKey} » : ` +
          'à vérifier sur le relevé avant toute nouvelle tentative',
      ))
        ? 'EN_REVUE'
        : 'INCHANGEE';
    }

    return (await this.versRevue(intention, `sort de l'ordre indéterminé : ${reponse.motif}`))
      ? 'EN_REVUE'
      : 'INCHANGEE';
  }

  /** Une consultation qui lève est un sort indéterminé, pas une panne à propager. */
  private async consulter(intention: PaymentIntent): Promise<SettlementLookup> {
    try {
      return await this.deps.canal.lookup(
        {
          intentId: intention.id,
          idempotencyKey: intention.idempotencyKey ?? '',
          montant: intention.montant,
          referenceImputation: intention.referenceImputation,
        },
        intention.wavePayoutId,
      );
    } catch (cause) {
      return {
        kind: 'UNKNOWN',
        motif: `consultation impossible : ${cause instanceof Error ? cause.message : String(cause)}`,
      };
    }
  }

  private async versRevue(intention: PaymentIntent, motif: string): Promise<boolean> {
    const ecrit = await this.appliquer(
      intention,
      (i) => transition(i, { type: 'DISPATCH_AMBIGUOUS', motif }, this.contexteInerte(i)).next,
    );
    if (ecrit) await this.tracer(intention, 'REGLEMENT_EN_REVUE', { motif });
    return ecrit;
  }

  /**
   * Écriture conditionnelle sur `DISPATCHING`.
   *
   * `false` si quelqu'un est passé avant — typiquement l'appel sortant d'origine, revenu plus
   * tard que prévu. Dans ce cas la reprise s'efface : l'appel réel sait mieux qu'elle.
   */
  private async appliquer(
    intention: PaymentIntent,
    calcul: (i: PaymentIntent) => PaymentIntent,
  ): Promise<boolean> {
    return this.deps.intentions.saveIfStatut(calcul(intention), 'DISPATCHING');
  }

  /**
   * Contexte de transition sans effet.
   *
   * `DISPATCH_ACK` et `DISPATCH_AMBIGUOUS` ne consultent ni le montant de la facture ni les
   * plafonds : ces contrôles ont été faits au moment d'envoyer. Les rejouer ici mettrait en
   * revue une intention parfaitement valide dont la facture a été corrigée entre-temps.
   */
  private contexteInerte(i: PaymentIntent) {
    return {
      invoiceMontantXof: i.montant,
      limites: { maxUnitaireXof: i.montant, maxQuotidienXof: i.montant },
      cumulJourXof: i.montant,
    } as const;
  }

  private async tracer(
    intention: PaymentIntent,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // `actor` vaut « reprise » : aucune personne n'a agi, et le journal doit le dire.
    await this.deps.audit?.enregistrer({
      actor: 'reprise',
      action,
      targetType: 'payment_intent',
      targetId: intention.id,
      payload,
    });
  }
}
