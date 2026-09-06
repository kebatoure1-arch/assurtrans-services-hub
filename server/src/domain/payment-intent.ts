/**
 * Machine à états d'un ordre de règlement.
 *
 * Fonction pure. Aucune I/O, aucune connaissance de Wave, aucune connaissance d'un canal
 * concret. Le seul point de contact avec le monde extérieur est la valeur `canal`, qui n'est
 * qu'une étiquette recopiée du contrat.
 *
 * Deux invariants portent tout le reste :
 *   1. `DISPATCHING` est écrit AVANT l'appel sortant, avec sa clé d'idempotence.
 *   2. Toute ambiguïté sur un mouvement d'argent va en `NEEDS_REVIEW`. Jamais de reprise
 *      automatique.
 */

import { absDelta, delta, type XOF, type XofDelta } from './money';

export type CanalReglement = 'DRY_RUN' | 'B2B' | 'MOBILE';

export type PaymentIntentStatut =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DISPATCHING'
  | 'SENT'
  | 'SETTLED'
  | 'RECONCILED'
  | 'NEEDS_REVIEW'
  | 'FAILED'
  | 'VARIANCE'
  | 'CANCELLED';

export interface PaymentIntent {
  readonly id: string;
  readonly invoiceId: string;
  readonly montant: XOF;
  readonly statut: PaymentIntentStatut;
  readonly canal: CanalReglement;
  readonly referenceImputation: string;
  readonly idempotencyKey: string | null;
  readonly wavePayoutId: string | null;
  readonly preparePar: string;
  readonly approuvePar: string | null;
  readonly executePar: string | null;
  readonly motifReview: string | null;
  readonly montantRegle: XOF | null;
  readonly ecartXof: XofDelta | null;
}

export type PaymentIntentEvent =
  | { readonly type: 'SUBMIT'; readonly actor: string }
  | { readonly type: 'APPROVE'; readonly actor: string }
  | { readonly type: 'CANCEL'; readonly actor: string }
  | {
      readonly type: 'DISPATCH';
      readonly actor: string;
      readonly idempotencyKey: string;
      readonly secondFactorVerifie: boolean;
    }
  | { readonly type: 'DISPATCH_ACK'; readonly payoutId: string }
  | { readonly type: 'DISPATCH_AMBIGUOUS'; readonly motif: string }
  | { readonly type: 'CONFIRM_SETTLED'; readonly montantRegle: XOF }
  | { readonly type: 'CONFIRM_FAILED'; readonly motif: string }
  | { readonly type: 'RECONCILE'; readonly actor: string }
  | {
      readonly type: 'RESOLVE_REVIEW';
      readonly actor: string;
      readonly resolution: 'PAYOUT_TROUVE' | 'PAYOUT_ABSENT';
      readonly payoutId?: string;
    };

export interface TransitionContext {
  /** Montant de la facture rattachée. Contrôle de cohérence à la soumission. */
  readonly invoiceMontantXof: XOF;
  /** Plafonds serveur (§9). Non modifiables par l'UI. */
  readonly limites: { readonly maxUnitaireXof: XOF; readonly maxQuotidienXof: XOF };
  /** Cumul déjà engagé sur la journée, hors intention courante. */
  readonly cumulJourXof: XOF;
}

export interface TransitionResult {
  readonly next: PaymentIntent;
  /** `false` si l'événement est un rejeu sans effet. Permet « 5 rejeux ⇒ 1 transition ». */
  readonly changed: boolean;
}

export class InvalidTransitionError extends Error {
  constructor(statut: PaymentIntentStatut, evenement: string) {
    super(`transition interdite : ${evenement} depuis ${statut}`);
    this.name = 'InvalidTransitionError';
  }
}

export class SegregationOfDutiesError extends Error {
  constructor(acteur: string) {
    super(`séparation des rôles : « ${acteur} » ne peut pas approuver sa propre intention`);
    this.name = 'SegregationOfDutiesError';
  }
}

export class SecondFactorRequiredError extends Error {
  constructor() {
    super('seconde authentification requise avant APPROVED → DISPATCHING');
    this.name = 'SecondFactorRequiredError';
  }
}

export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitExceededError';
  }
}

export class AmountMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmountMismatchError';
  }
}

export interface CreateDraftInput {
  readonly id: string;
  readonly invoiceId: string;
  readonly montant: XOF;
  readonly canal: CanalReglement;
  readonly preparePar: string;
  readonly referenceImputation: string;
}

export function createDraft(input: CreateDraftInput): PaymentIntent {
  return {
    id: input.id,
    invoiceId: input.invoiceId,
    montant: input.montant,
    statut: 'DRAFT',
    canal: input.canal,
    referenceImputation: input.referenceImputation,
    idempotencyKey: null,
    wavePayoutId: null,
    preparePar: input.preparePar,
    approuvePar: null,
    executePar: null,
    motifReview: null,
    montantRegle: null,
    ecartXof: null,
  };
}

/** États depuis lesquels plus aucun mouvement d'argent n'est possible. */
export const ETATS_TERMINAUX: readonly PaymentIntentStatut[] = [
  'RECONCILED',
  'FAILED',
  'CANCELLED',
];

/** Un règlement à ce stade a été poussé chez Wave ; il figure au rapprochement. */
export const ETATS_ENVOYES: readonly PaymentIntentStatut[] = [
  'SENT',
  'SETTLED',
  'RECONCILED',
  'VARIANCE',
];

const inchange = (i: PaymentIntent): TransitionResult => ({ next: i, changed: false });
const change = (i: PaymentIntent): TransitionResult => ({ next: i, changed: true });

function versRevue(i: PaymentIntent, motif: string): TransitionResult {
  return change({ ...i, statut: 'NEEDS_REVIEW', motifReview: motif });
}

export function transition(
  intent: PaymentIntent,
  event: PaymentIntentEvent,
  ctx: TransitionContext,
): TransitionResult {
  switch (event.type) {
    case 'SUBMIT': {
      if (intent.statut !== 'DRAFT') throw new InvalidTransitionError(intent.statut, 'SUBMIT');
      if (intent.montant !== ctx.invoiceMontantXof) {
        throw new AmountMismatchError(
          `montant de l'intention (${intent.montant}) différent du montant de la facture (${ctx.invoiceMontantXof})`,
        );
      }
      return change({ ...intent, statut: 'PENDING_APPROVAL' });
    }

    case 'APPROVE': {
      if (intent.statut !== 'PENDING_APPROVAL') {
        throw new InvalidTransitionError(intent.statut, 'APPROVE');
      }
      if (event.actor === intent.preparePar) {
        throw new SegregationOfDutiesError(event.actor);
      }
      return change({ ...intent, statut: 'APPROVED', approuvePar: event.actor });
    }

    case 'CANCEL': {
      if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(intent.statut)) {
        throw new InvalidTransitionError(intent.statut, 'CANCEL');
      }
      return change({ ...intent, statut: 'CANCELLED' });
    }

    case 'DISPATCH': {
      if (intent.statut !== 'APPROVED') throw new InvalidTransitionError(intent.statut, 'DISPATCH');
      if (!event.secondFactorVerifie) throw new SecondFactorRequiredError();
      if (intent.montant > ctx.limites.maxUnitaireXof) {
        throw new LimitExceededError(
          `plafond unitaire serveur dépassé : ${intent.montant} > ${ctx.limites.maxUnitaireXof}`,
        );
      }
      if (ctx.cumulJourXof + intent.montant > ctx.limites.maxQuotidienXof) {
        throw new LimitExceededError(
          `plafond quotidien serveur dépassé : ${ctx.cumulJourXof} + ${intent.montant} > ${ctx.limites.maxQuotidienXof}`,
        );
      }
      return change({
        ...intent,
        statut: 'DISPATCHING',
        idempotencyKey: event.idempotencyKey,
        executePar: event.actor,
      });
    }

    case 'DISPATCH_ACK': {
      if (intent.statut === 'DISPATCHING') {
        return change({ ...intent, statut: 'SENT', wavePayoutId: event.payoutId });
      }
      if (ETATS_ENVOYES.includes(intent.statut)) {
        if (intent.wavePayoutId === event.payoutId) return inchange(intent);
        return versRevue(
          intent,
          `payout id divergent : déjà « ${intent.wavePayoutId} », reçu « ${event.payoutId} »`,
        );
      }
      throw new InvalidTransitionError(intent.statut, 'DISPATCH_ACK');
    }

    case 'DISPATCH_AMBIGUOUS': {
      if (intent.statut === 'NEEDS_REVIEW') return inchange(intent);
      if (intent.statut !== 'DISPATCHING') {
        throw new InvalidTransitionError(intent.statut, 'DISPATCH_AMBIGUOUS');
      }
      return versRevue(intent, event.motif);
    }

    case 'CONFIRM_SETTLED': {
      const ecart = delta(intent.montant, event.montantRegle);

      if (intent.statut === 'SETTLED' || intent.statut === 'RECONCILED') {
        // Rejeu de webhook : même montant ⇒ aucun effet. Montant différent ⇒ revue humaine.
        return intent.montantRegle === event.montantRegle
          ? inchange(intent)
          : versRevue(
              intent,
              `règlement rejoué avec un montant différent : ${intent.montantRegle} puis ${event.montantRegle}`,
            );
      }
      if (intent.statut === 'VARIANCE') {
        return intent.montantRegle === event.montantRegle ? inchange(intent) : versRevue(
          intent,
          `écart rejoué avec un montant différent : ${intent.montantRegle} puis ${event.montantRegle}`,
        );
      }
      if (intent.statut !== 'SENT') {
        throw new InvalidTransitionError(intent.statut, 'CONFIRM_SETTLED');
      }

      return change({
        ...intent,
        statut: absDelta(ecart) === 0 ? 'SETTLED' : 'VARIANCE',
        montantRegle: event.montantRegle,
        ecartXof: ecart,
      });
    }

    case 'CONFIRM_FAILED': {
      if (intent.statut === 'FAILED') return inchange(intent);
      if (intent.statut !== 'SENT') throw new InvalidTransitionError(intent.statut, 'CONFIRM_FAILED');
      return change({ ...intent, statut: 'FAILED', motifReview: event.motif });
    }

    case 'RECONCILE': {
      if (intent.statut === 'RECONCILED') return inchange(intent);
      if (intent.statut !== 'SETTLED') throw new InvalidTransitionError(intent.statut, 'RECONCILE');
      return change({ ...intent, statut: 'RECONCILED' });
    }

    case 'RESOLVE_REVIEW': {
      if (intent.statut !== 'NEEDS_REVIEW') {
        throw new InvalidTransitionError(intent.statut, 'RESOLVE_REVIEW');
      }
      if (event.actor === intent.executePar) {
        throw new SegregationOfDutiesError(event.actor);
      }
      if (event.resolution === 'PAYOUT_TROUVE') {
        if (!event.payoutId) {
          throw new AmountMismatchError('résolution PAYOUT_TROUVE sans identifiant de payout');
        }
        return change({
          ...intent,
          statut: 'SENT',
          wavePayoutId: event.payoutId,
          motifReview: null,
        });
      }
      return change({ ...intent, statut: 'FAILED', motifReview: null });
    }

    default: {
      const jamais: never = event;
      throw new InvalidTransitionError(intent.statut, JSON.stringify(jamais));
    }
  }
}

/** Écart absolu constaté sur un règlement, ou 0. Pour l'affichage et les alertes. */
export function ecartAbsolu(intent: PaymentIntent): number {
  return intent.ecartXof === null ? 0 : absDelta(intent.ecartXof);
}
