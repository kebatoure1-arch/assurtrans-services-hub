import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money';
import { reconcile, type ReconInput } from '../src/domain/reconciliation';

const base: ReconInput = {
  periode: '2026-08-31',
  toleranceXof: xof(0),
  invoices: [
    { id: 'inv-1', numero: 'TE-0001', montantXof: xof(4_200_000), dateEcheance: '2026-08-20' },
  ],
  intents: [
    {
      id: 'pi-1',
      invoiceId: 'inv-1',
      montantXof: xof(4_200_000),
      statut: 'SETTLED',
      wavePayoutId: 'pw-1',
    },
  ],
  waveTransactions: [
    { id: 'wt-1', waveTxId: 'pw-1', sens: 'OUT', montantXof: xof(4_200_000), contrepartie: 'TE' },
  ],
};

describe('rapprochement à trois voies', () => {
  it('facture ↔ intention ↔ relevé cohérents ⇒ MATCHED', () => {
    const r = reconcile(base);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].statut).toBe('MATCHED');
    expect(r.lignes[0].ecartXof).toBe(0);
    expect(r.resume).toMatchObject({ matched: 1, variance: 0, orphan: 0 });
  });

  it('montant réglé différent ⇒ VARIANCE avec écart signé', () => {
    const r = reconcile({
      ...base,
      waveTransactions: [{ ...base.waveTransactions[0], montantXof: xof(4_100_000) }],
    });
    expect(r.lignes[0].statut).toBe('VARIANCE');
    expect(r.lignes[0].ecartXof).toBe(-100_000);
  });

  it('tolérance paramétrable : un écart dans la tolérance reste MATCHED', () => {
    const r = reconcile({
      ...base,
      toleranceXof: xof(500),
      waveTransactions: [{ ...base.waveTransactions[0], montantXof: xof(4_199_600) }],
    });
    expect(r.lignes[0].statut).toBe('MATCHED');
    expect(r.lignes[0].ecartXof).toBe(-400);
    expect(r.lignes[0].toleranceXof).toBe(500);
  });

  it('intention envoyée sans trace au relevé ⇒ VARIANCE', () => {
    const r = reconcile({ ...base, waveTransactions: [] });
    expect(r.lignes[0].statut).toBe('VARIANCE');
    expect(r.lignes[0].motif).toMatch(/relevé/i);
  });

  it('facture échue jamais ordonnancée ⇒ ORPHAN', () => {
    const r = reconcile({ ...base, intents: [], waveTransactions: [] });
    expect(r.lignes[0].statut).toBe('ORPHAN');
    expect(r.lignes[0].invoiceId).toBe('inv-1');
  });

  it('sortie de fonds sans intention ⇒ ORPHAN — le cas grave', () => {
    const r = reconcile({
      ...base,
      waveTransactions: [
        ...base.waveTransactions,
        { id: 'wt-9', waveTxId: 'pw-9', sens: 'OUT', montantXof: xof(750_000), contrepartie: '??' },
      ],
    });
    const orphelines = r.lignes.filter((l) => l.statut === 'ORPHAN');
    expect(orphelines).toHaveLength(1);
    expect(orphelines[0].waveTransactionId).toBe('wt-9');
    expect(orphelines[0].motif).toMatch(/aucune intention/i);
  });

  it('encaissement entrant ⇒ ORPHAN — ADR-001 interdit l’encaissement', () => {
    const r = reconcile({
      ...base,
      waveTransactions: [
        ...base.waveTransactions,
        { id: 'wt-in', waveTxId: 'pw-in', sens: 'IN', montantXof: xof(50_000), contrepartie: 'x' },
      ],
    });
    const entrante = r.lignes.find((l) => l.waveTransactionId === 'wt-in');
    expect(entrante?.statut).toBe('ORPHAN');
    expect(entrante?.motif).toMatch(/entrant/i);
  });

  it('double règlement d’une même facture ⇒ VARIANCE, jamais MATCHED', () => {
    const r = reconcile({
      ...base,
      waveTransactions: [
        base.waveTransactions[0],
        { id: 'wt-2', waveTxId: 'pw-1', sens: 'OUT', montantXof: xof(4_200_000), contrepartie: 'TE' },
      ],
    });
    expect(r.lignes.some((l) => l.statut === 'MATCHED')).toBe(false);
    const v = r.lignes.find((l) => l.statut === 'VARIANCE');
    expect(v?.motif).toMatch(/double/i);
    expect(r.resume.variance).toBeGreaterThan(0);
  });

  it('les intentions non encore envoyées ne sont pas classées, mais sont comptées', () => {
    const r = reconcile({
      ...base,
      intents: [{ ...base.intents[0], statut: 'APPROVED', wavePayoutId: null }],
      waveTransactions: [],
    });
    expect(r.resume.enAttente).toBe(1);
    expect(r.lignes.every((l) => l.statut !== 'MATCHED')).toBe(true);
  });

  it('100 % des transactions du relevé reçoivent une ligne — aucun reliquat (§11)', () => {
    const r = reconcile({
      ...base,
      waveTransactions: [
        base.waveTransactions[0],
        { id: 'wt-a', waveTxId: 'pw-a', sens: 'OUT', montantXof: xof(1), contrepartie: 'a' },
        { id: 'wt-b', waveTxId: 'pw-b', sens: 'IN', montantXof: xof(2), contrepartie: 'b' },
      ],
    });
    expect(r.integrite.toutesTransactionsClassees).toBe(true);
    expect(r.integrite.transactionsNonClassees).toEqual([]);
    const couvertes = new Set(r.lignes.flatMap((l) => (l.waveTransactionId ? [l.waveTransactionId] : [])));
    expect(couvertes).toEqual(new Set(['wt-1', 'wt-a', 'wt-b']));
  });

  it('un VARIANCE non résolu bloque l’ordonnancement du cycle suivant (§11)', () => {
    const r = reconcile({ ...base, waveTransactions: [] });
    expect(r.bloqueCycleSuivant).toBe(true);

    const propre = reconcile(base);
    expect(propre.bloqueCycleSuivant).toBe(false);
  });

  it('un ORPHAN non résolu bloque également le cycle suivant', () => {
    const r = reconcile({ ...base, intents: [], waveTransactions: [] });
    expect(r.bloqueCycleSuivant).toBe(true);
  });
});
