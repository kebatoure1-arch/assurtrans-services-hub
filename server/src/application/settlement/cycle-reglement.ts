/**
 * Cas d'usage : régler une facture TotalEnergies depuis le portefeuille Wave Business.
 *
 * Le domaine porte les règles (§9) : un préparateur n'approuve pas sa propre intention, une
 * seconde authentification précède l'envoi, toute ambiguïté part en revue. Ce fichier porte
 * l'orchestration, et une seule chose y compte vraiment :
 *
 *   **`DISPATCHING` et la clé d'idempotence sont écrits, et l'écriture confirmée, AVANT
 *   l'appel sortant.**
 *
 * Si le processus meurt pendant l'appel, la base sait qu'un ordre a peut-être été émis, et la
 * reprise interroge le fournisseur au lieu de renvoyer. L'ordre inverse — appeler puis écrire —
 * perdrait la trace d'un versement déjà parti, donc de l'argent.
 *
 * Le second principe : une écriture conditionnelle refusée arrête tout. Elle signifie qu'un
 * autre administrateur est passé entre notre lecture et notre écriture. On ne réessaie pas, on
 * ne force pas — on remonte la concurrence à l'appelant, qui relira l'état réel.
 */

import { type XOF, xof } from '../../domain/money.ts';
import {
  createDraft,
  type PaymentIntent,
  type PaymentIntentStatut,
  transition,
  type TransitionContext,
} from '../../domain/payment-intent.ts';
import type { AuditLogger } from '../../ports/audit.ts';
import type { SettlementChannel } from '../../ports/settlement-channel.ts';
import type {
  Invoice,
  InvoiceRepository,
  PaymentIntentRepository,
} from '../../ports/settlement.ts';

export class FactureIntrouvableError extends Error {
  constructor(id: string) {
    super(`facture ${id} introuvable`);
    this.name = 'FactureIntrouvableError';
  }
}

export class IntentionIntrouvableError extends Error {
  constructor(id: string) {
    super(`intention de règlement ${id} introuvable`);
    this.name = 'IntentionIntrouvableError';
  }
}

/**
 * Le numéro de facture est déjà pris sur ce contrat.
 *
 * Distinct de `ConcurrenceError` : ce n'est pas une course, c'est une saisie qui fait doublon.
 * L'une se résout en relisant, l'autre en corrigeant le numéro — les confondre laisserait
 * l'administrateur recliquer sur un bouton qui ne marchera jamais.
 */
export class NumeroFactureDejaUtiliseError extends Error {
  constructor(numero: string) {
    super(`une facture porte déjà le numéro « ${numero} » sur ce contrat`);
    this.name = 'NumeroFactureDejaUtiliseError';
  }
}

/**
 * Une écriture conditionnelle a été refusée : l'état en base n'est plus celui qu'on avait lu.
 *
 * Ce n'est pas une erreur technique à réessayer. C'est le signe qu'une autre personne agit sur
 * la même intention, et la seule conduite correcte est de relire.
 */
/**
 * Le rapprochement de la période précédente laisse un écart ou un orphelin non résolu.
 *
 * §11 : le cycle suivant ne s'ordonnance pas tant que le précédent n'est pas soldé. Ce n'est
 * pas une précaution de confort — ordonnancer par-dessus un mouvement de fonds qu'on ne
 * s'explique pas, c'est empiler une seconde inconnue sur la première.
 */
export class CycleBloqueError extends Error {
  constructor() {
    super(
      'le rapprochement précédent laisse un écart ou un orphelin non résolu : ' +
        'soldez-le avant d’ordonnancer un nouveau règlement',
    );
    this.name = 'CycleBloqueError';
  }
}

export class ConcurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrenceError';
  }
}

export interface CycleDeps {
  readonly factures: InvoiceRepository;
  readonly intentions: PaymentIntentRepository;
  readonly canal: SettlementChannel;
  readonly limites: { readonly maxUnitaireXof: XOF; readonly maxQuotidienXof: XOF };
  /**
   * Gabarit de la référence que TotalEnergies attend pour rattacher le versement. `{numero}` y
   * est remplacé par le numéro de facture. Sans gabarit conforme, le versement arrive chez le
   * fournisseur sans savoir à quoi il se rapporte (§14, paramètre 2).
   */
  readonly referenceImputation: string;
  readonly horloge: () => string;
  readonly nouvelId: () => string;
  /** Tirage de la clé d'idempotence. Un UUID par tentative d'envoi, jamais réutilisé. */
  readonly nouvelleCle: () => string;
  readonly audit?: AuditLogger;
  /**
   * Le rapprochement laisse-t-il quelque chose de non résolu ?
   *
   * Injecté plutôt qu'importé : le cycle n'a pas à connaître le rapprochement, il a seulement
   * besoin de savoir s'il a le droit d'avancer. Absent, rien ne bloque — c'est le cas du
   * harnais de démonstration.
   */
  readonly cycleBloque?: () => Promise<boolean>;
}

export class CycleReglement {
  constructor(private readonly deps: CycleDeps) {}

  /** Enregistre une facture reçue du fournisseur. Aucun règlement ne part hors facture (ADR-001). */
  async enregistrerFacture(facture: Invoice): Promise<Invoice> {
    const pose = await this.deps.factures.saveIfNew(facture);
    if (!pose) throw new NumeroFactureDejaUtiliseError(facture.numero);
    await this.tracer('FACTURE_ENREGISTREE', 'invoice', facture.id, 'systeme', {
      numero: facture.numero,
      montant: facture.montant,
    });
    return facture;
  }

  /**
   * Prépare une intention à partir d'une facture.
   *
   * Le montant vient de la facture, jamais de l'appelant : une interface qui pourrait proposer
   * son propre montant serait une interface qui décide de ce qu'on paie.
   */
  async preparer(input: { invoiceId: string; acteur: string }): Promise<PaymentIntent> {
    // Le contrôle vient AVANT toute écriture : un règlement refusé ne doit pas laisser
    // derrière lui une intention en brouillon que quelqu'un reprendra sans savoir pourquoi
    // elle existe.
    if (this.deps.cycleBloque !== undefined && (await this.deps.cycleBloque())) {
      throw new CycleBloqueError();
    }

    const facture = await this.deps.factures.findById(input.invoiceId);
    if (facture === null) throw new FactureIntrouvableError(input.invoiceId);

    const intent = createDraft({
      id: this.deps.nouvelId(),
      invoiceId: facture.id,
      montant: facture.montant,
      canal: this.deps.canal.canal,
      preparePar: input.acteur,
      referenceImputation: this.deps.referenceImputation.replace('{numero}', facture.numero),
    });

    const pose = await this.deps.intentions.saveIfNew(intent);
    if (!pose) {
      throw new ConcurrenceError(
        `la facture ${facture.numero} porte déjà une intention de règlement vivante`,
      );
    }

    await this.tracer('REGLEMENT_PREPARE', 'payment_intent', intent.id, input.acteur, {
      invoiceId: facture.id,
      montant: intent.montant,
    });
    return intent;
  }

  async soumettre(input: { intentId: string; acteur: string }): Promise<PaymentIntent> {
    return this.appliquer(input.intentId, 'DRAFT', (i, ctx) =>
      transition(i, { type: 'SUBMIT', actor: input.acteur }, ctx),
    ).then(this.trace('REGLEMENT_SOUMIS', input.acteur));
  }

  async approuver(input: { intentId: string; acteur: string }): Promise<PaymentIntent> {
    return this.appliquer(input.intentId, 'PENDING_APPROVAL', (i, ctx) =>
      transition(i, { type: 'APPROVE', actor: input.acteur }, ctx),
    ).then(this.trace('REGLEMENT_APPROUVE', input.acteur));
  }

  async annuler(input: { intentId: string; acteur: string }): Promise<PaymentIntent> {
    const courant = await this.charger(input.intentId);
    return this.appliquer(input.intentId, courant.statut, (i, ctx) =>
      transition(i, { type: 'CANCEL', actor: input.acteur }, ctx),
    ).then(this.trace('REGLEMENT_ANNULE', input.acteur));
  }

  /**
   * Émet l'ordre de versement.
   *
   * L'ordre des opérations est la garantie, pas un détail d'implémentation :
   *
   *   1. `DISPATCHING` + clé d'idempotence, écriture conditionnelle **confirmée** ;
   *   2. appel sortant, une seule fois, sans reprise ;
   *   3. enregistrement du sort de l'appel.
   *
   * Entre 1 et 2, un crash laisse une intention `DISPATCHING` avec sa clé : la reprise saura
   * qu'il faut interroger le fournisseur avant toute nouvelle tentative.
   */
  async executer(input: {
    intentId: string;
    acteur: string;
    secondFactorVerifie: boolean;
  }): Promise<PaymentIntent> {
    const dispatching = await this.appliquer(input.intentId, 'APPROVED', (i, ctx) =>
      transition(
        i,
        {
          type: 'DISPATCH',
          actor: input.acteur,
          idempotencyKey: this.deps.nouvelleCle(),
          secondFactorVerifie: input.secondFactorVerifie,
        },
        ctx,
      ),
    );

    await this.tracer('REGLEMENT_EXECUTE', 'payment_intent', dispatching.id, input.acteur, {
      montant: dispatching.montant,
      canal: dispatching.canal,
    });

    const resultat = await this.deps.canal.execute({
      intentId: dispatching.id,
      idempotencyKey: dispatching.idempotencyKey as string,
      montant: dispatching.montant,
      referenceImputation: dispatching.referenceImputation,
    });

    const suite =
      resultat.kind === 'ACCEPTED'
        ? { type: 'DISPATCH_ACK' as const, payoutId: resultat.payoutId }
        : resultat.kind === 'AMBIGUOUS'
          ? { type: 'DISPATCH_AMBIGUOUS' as const, motif: resultat.motif }
          : { type: 'CONFIRM_FAILED' as const, motif: resultat.motif };

    // Un refus franc arrive alors que l'intention est encore `DISPATCHING` : le domaine attend
    // `SENT` pour `CONFIRM_FAILED`. On passe donc par la revue, qui est le bon état — un ordre
    // refusé par le fournisseur mérite qu'on regarde pourquoi avant de le rejouer.
    const evenement =
      suite.type === 'CONFIRM_FAILED'
        ? { type: 'DISPATCH_AMBIGUOUS' as const, motif: `refus du fournisseur : ${suite.motif}` }
        : suite;

    const apres = await this.appliquer(dispatching.id, 'DISPATCHING', (i, ctx) =>
      transition(i, evenement, ctx),
    );

    if (resultat.kind === 'REJECTED') {
      await this.tracer('REGLEMENT_REFUSE', 'payment_intent', apres.id, 'fournisseur', {
        motif: resultat.motif,
      });
      return { ...apres, statut: 'FAILED' as PaymentIntentStatut };
    }
    return apres;
  }

  /** Le fournisseur a confirmé un montant réglé. Rejouable : cinq appels, une transition. */
  async confirmer(input: { intentId: string; montantRegle: XOF }): Promise<PaymentIntent> {
    const courant = await this.charger(input.intentId);
    return this.appliquer(input.intentId, courant.statut, (i, ctx) =>
      transition(i, { type: 'CONFIRM_SETTLED', montantRegle: input.montantRegle }, ctx),
    );
  }

  async rapprocher(input: { intentId: string; acteur: string }): Promise<PaymentIntent> {
    const courant = await this.charger(input.intentId);
    const apres = await this.appliquer(input.intentId, courant.statut, (i, ctx) =>
      transition(i, { type: 'RECONCILE', actor: input.acteur }, ctx),
    );
    await this.deps.factures.changerStatut(apres.invoiceId, 'REGLEE');
    await this.tracer('REGLEMENT_RAPPROCHE', 'payment_intent', apres.id, input.acteur, {});
    return apres;
  }

  async listerFactures(contractId: string, limite = 50): Promise<readonly Invoice[]> {
    return this.deps.factures.lister(contractId, limite);
  }

  async listerIntentions(contractId: string, limite = 50): Promise<readonly PaymentIntent[]> {
    return this.deps.intentions.lister(contractId, limite);
  }

  // ------------------------------------------------------------------ interne

  private async charger(id: string): Promise<PaymentIntent> {
    const intent = await this.deps.intentions.findById(id);
    if (intent === null) throw new IntentionIntrouvableError(id);
    return intent;
  }

  /**
   * Lit, applique la transition du domaine, écrit sous condition de statut.
   *
   * Le `statutAttendu` passé à l'écriture est celui lu au début : si la base en porte un autre,
   * quelqu'un a agi entre-temps et l'écriture est refusée. C'est cette condition, et non un
   * verrou applicatif, qui empêche deux exécutions simultanées.
   */
  private async appliquer(
    id: string,
    statutAttendu: PaymentIntentStatut,
    calcul: (i: PaymentIntent, ctx: TransitionContext) => { next: PaymentIntent; changed: boolean },
  ): Promise<PaymentIntent> {
    const courant = await this.charger(id);
    const ctx = await this.contexte(courant);

    const { next, changed } = calcul(courant, ctx);
    if (!changed) return next;

    const ecrit = await this.deps.intentions.saveIfStatut(next, statutAttendu);
    if (!ecrit) {
      throw new ConcurrenceError(
        `l'intention ${id} n'est plus dans l'état « ${statutAttendu} » : ` +
          'quelqu’un est intervenu entre-temps. Relisez avant d’agir.',
      );
    }
    return next;
  }

  private async contexte(intent: PaymentIntent): Promise<TransitionContext> {
    const facture = await this.deps.factures.findById(intent.invoiceId);
    if (facture === null) throw new FactureIntrouvableError(intent.invoiceId);

    const jour = this.deps.horloge().slice(0, 10);
    const cumul = await this.deps.intentions.cumulDuJour(facture.contractId, jour, intent.id);

    return {
      invoiceMontantXof: facture.montant,
      limites: this.deps.limites,
      cumulJourXof: cumul ?? xof(0),
    };
  }

  private trace(action: string, acteur: string) {
    return async (intent: PaymentIntent) => {
      await this.tracer(action, 'payment_intent', intent.id, acteur, { statut: intent.statut });
      return intent;
    };
  }

  private async tracer(
    action: string,
    targetType: string,
    targetId: string,
    actor: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.audit?.enregistrer({ actor, action, targetType, targetId, payload });
  }
}
