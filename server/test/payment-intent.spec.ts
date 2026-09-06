import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money';
import {
  createDraft,
  InvalidTransitionError,
  LimitExceededError,
  type PaymentIntent,
  SecondFactorRequiredError,
  SegregationOfDutiesError,
  transition,
} from '../src/domain/payment-intent';

const CTX = {
  invoiceMontantXof: xof(4_200_000),
  limites: { maxUnitaireXof: xof(10_000_000), maxQuotidienXof: xof(20_000_000) },
  cumulJourXof: xof(0),
};

const KEY = '3f0f1b52-9a2c-4a1e-9d0e-2b0a5f9c1d77';

function draft(): PaymentIntent {
  return createDraft({
    id: 'pi-1',
    invoiceId: 'inv-1',
    montant: xof(4_200_000),
    canal: 'DRY_RUN',
    preparePar: 'amina',
    referenceImputation: 'TE/ASSURTRANS/2026-08',
  });
}

function jusquApprouve(): PaymentIntent {
  let i = draft();
  i = transition(i, { type: 'SUBMIT', actor: 'amina' }, CTX).next;
  i = transition(i, { type: 'APPROVE', actor: 'moussa' }, CTX).next;
  return i;
}

function jusquDispatching(): PaymentIntent {
  return transition(
    jusquApprouve(),
    { type: 'DISPATCH', actor: 'fatou', idempotencyKey: KEY, secondFactorVerifie: true },
    CTX,
  ).next;
}

describe('payment_intent — soumission', () => {
  it('DRAFT → PENDING_APPROVAL quand le montant correspond à la facture', () => {
    const { next, changed } = transition(draft(), { type: 'SUBMIT', actor: 'amina' }, CTX);
    expect(next.statut).toBe('PENDING_APPROVAL');
    expect(changed).toBe(true);
  });

  it('refuse la soumission si le montant diffère de la facture', () => {
    const i = { ...draft(), montant: xof(4_200_001) };
    expect(() => transition(i, { type: 'SUBMIT', actor: 'amina' }, CTX)).toThrow(
      /montant.*facture/i,
    );
  });
});

describe('payment_intent — séparation des rôles (§9)', () => {
  it('un préparateur ne peut pas approuver sa propre intention', () => {
    const i = transition(draft(), { type: 'SUBMIT', actor: 'amina' }, CTX).next;
    expect(() => transition(i, { type: 'APPROVE', actor: 'amina' }, CTX)).toThrow(
      SegregationOfDutiesError,
    );
  });

  it('un acteur distinct peut approuver', () => {
    const i = transition(draft(), { type: 'SUBMIT', actor: 'amina' }, CTX).next;
    const a = transition(i, { type: 'APPROVE', actor: 'moussa' }, CTX).next;
    expect(a.statut).toBe('APPROVED');
    expect(a.approuvePar).toBe('moussa');
  });
});

describe('payment_intent — dispatch', () => {
  it('exige la seconde authentification à APPROVED → DISPATCHING', () => {
    expect(() =>
      transition(
        jusquApprouve(),
        { type: 'DISPATCH', actor: 'fatou', idempotencyKey: KEY, secondFactorVerifie: false },
        CTX,
      ),
    ).toThrow(SecondFactorRequiredError);
  });

  it('persiste l’idempotency key AVANT tout appel sortant', () => {
    const d = jusquDispatching();
    expect(d.statut).toBe('DISPATCHING');
    expect(d.idempotencyKey).toBe(KEY);
    expect(d.wavePayoutId).toBeNull();
  });

  it('refuse un dépassement du plafond unitaire serveur', () => {
    const gros = { ...jusquApprouve(), montant: xof(10_000_001) };
    expect(() =>
      transition(
        gros,
        { type: 'DISPATCH', actor: 'fatou', idempotencyKey: KEY, secondFactorVerifie: true },
        { ...CTX, invoiceMontantXof: xof(10_000_001) },
      ),
    ).toThrow(LimitExceededError);
  });

  it('refuse un dépassement du cumul quotidien serveur', () => {
    expect(() =>
      transition(
        jusquApprouve(),
        { type: 'DISPATCH', actor: 'fatou', idempotencyKey: KEY, secondFactorVerifie: true },
        { ...CTX, cumulJourXof: xof(19_000_000) },
      ),
    ).toThrow(LimitExceededError);
  });

  it('interdit de sauter APPROVED — DRAFT ne peut pas partir en dispatch', () => {
    expect(() =>
      transition(
        draft(),
        { type: 'DISPATCH', actor: 'fatou', idempotencyKey: KEY, secondFactorVerifie: true },
        CTX,
      ),
    ).toThrow(InvalidTransitionError);
  });
});

describe('payment_intent — réponse ambiguë : aucun retry automatique (§10)', () => {
  it('DISPATCHING → NEEDS_REVIEW sur timeout', () => {
    const r = transition(
      jusquDispatching(),
      { type: 'DISPATCH_AMBIGUOUS', motif: 'timeout réseau après 30 s' },
      CTX,
    ).next;
    expect(r.statut).toBe('NEEDS_REVIEW');
    expect(r.motifReview).toMatch(/timeout/);
  });

  it('NEEDS_REVIEW n’offre aucune transition automatique vers DISPATCHING', () => {
    const r = transition(
      jusquDispatching(),
      { type: 'DISPATCH_AMBIGUOUS', motif: 'timeout' },
      CTX,
    ).next;
    expect(() =>
      transition(
        r,
        { type: 'DISPATCH', actor: 'fatou', idempotencyKey: KEY, secondFactorVerifie: true },
        CTX,
      ),
    ).toThrow(InvalidTransitionError);
  });

  it('la résolution humaine peut constater le payout existant', () => {
    const r = transition(
      jusquDispatching(),
      { type: 'DISPATCH_AMBIGUOUS', motif: 'timeout' },
      CTX,
    ).next;
    const s = transition(
      r,
      { type: 'RESOLVE_REVIEW', actor: 'moussa', resolution: 'PAYOUT_TROUVE', payoutId: 'pw-77' },
      CTX,
    ).next;
    expect(s.statut).toBe('SENT');
    expect(s.wavePayoutId).toBe('pw-77');
  });

  it('la résolution humaine peut constater l’absence de payout', () => {
    const r = transition(
      jusquDispatching(),
      { type: 'DISPATCH_AMBIGUOUS', motif: 'timeout' },
      CTX,
    ).next;
    const f = transition(
      r,
      { type: 'RESOLVE_REVIEW', actor: 'moussa', resolution: 'PAYOUT_ABSENT' },
      CTX,
    ).next;
    expect(f.statut).toBe('FAILED');
  });
});

describe('payment_intent — règlement et écart', () => {
  function envoye(): PaymentIntent {
    return transition(jusquDispatching(), { type: 'DISPATCH_ACK', payoutId: 'pw-42' }, CTX).next;
  }

  it('SENT → SETTLED quand le montant réglé est exact', () => {
    const s = transition(envoye(), { type: 'CONFIRM_SETTLED', montantRegle: xof(4_200_000) }, CTX)
      .next;
    expect(s.statut).toBe('SETTLED');
  });

  it('SENT → VARIANCE quand le montant réglé diffère, même d’un franc', () => {
    const v = transition(envoye(), { type: 'CONFIRM_SETTLED', montantRegle: xof(4_199_999) }, CTX)
      .next;
    expect(v.statut).toBe('VARIANCE');
    expect(v.ecartXof).toBe(1);
  });

  it('SETTLED → RECONCILED au lettrage', () => {
    const s = transition(envoye(), { type: 'CONFIRM_SETTLED', montantRegle: xof(4_200_000) }, CTX)
      .next;
    expect(transition(s, { type: 'RECONCILE', actor: 'amina' }, CTX).next.statut).toBe('RECONCILED');
  });
});

describe('payment_intent — rejeu de webhook (§11)', () => {
  it('5 rejeux du même événement ⇒ exactement 1 transition', () => {
    let i = transition(jusquDispatching(), { type: 'DISPATCH_ACK', payoutId: 'pw-42' }, CTX).next;
    const evenement = { type: 'CONFIRM_SETTLED', montantRegle: xof(4_200_000) } as const;

    const changements: boolean[] = [];
    for (let n = 0; n < 5; n += 1) {
      const r = transition(i, evenement, CTX);
      changements.push(r.changed);
      i = r.next;
    }

    expect(changements).toEqual([true, false, false, false, false]);
    expect(i.statut).toBe('SETTLED');
  });

  it('un DISPATCH_ACK rejoué avec le même payout id ne change rien', () => {
    let i = transition(jusquDispatching(), { type: 'DISPATCH_ACK', payoutId: 'pw-42' }, CTX).next;
    const r = transition(i, { type: 'DISPATCH_ACK', payoutId: 'pw-42' }, CTX);
    expect(r.changed).toBe(false);
    expect(r.next.statut).toBe('SENT');
  });

  it('un DISPATCH_ACK rejoué avec un AUTRE payout id part en revue humaine', () => {
    const i = transition(jusquDispatching(), { type: 'DISPATCH_ACK', payoutId: 'pw-42' }, CTX).next;
    const r = transition(i, { type: 'DISPATCH_ACK', payoutId: 'pw-99' }, CTX);
    expect(r.next.statut).toBe('NEEDS_REVIEW');
    expect(r.next.motifReview).toMatch(/payout id/i);
  });
});

describe('payment_intent — annulation', () => {
  it('APPROVED → CANCELLED', () => {
    expect(transition(jusquApprouve(), { type: 'CANCEL', actor: 'moussa' }, CTX).next.statut).toBe(
      'CANCELLED',
    );
  });

  it('DISPATCHING ne peut plus être annulé — les fonds sont peut-être partis', () => {
    expect(() => transition(jusquDispatching(), { type: 'CANCEL', actor: 'moussa' }, CTX)).toThrow(
      InvalidTransitionError,
    );
  });
});
