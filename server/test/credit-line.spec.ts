import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money';
import { evaluateCreditLine, projectBlockingDate } from '../src/domain/credit-line';

const contrat = {
  encoursAutorise: xof(10_000_000),
  seuilAlertePct: 70,
  seuilBlocagePct: 90,
};

describe('encours — le post-payé est un cycle de crédit, pas un solde', () => {
  it('encours courant = consommation non facturée + factures échues impayées', () => {
    const s = evaluateCreditLine({
      ...contrat,
      consommationNonFacturee: xof(2_000_000),
      facturesEchuesImpayees: xof(1_500_000),
    });
    expect(s.encoursCourant).toBe(3_500_000);
    expect(s.disponible).toBe(6_500_000);
    expect(s.utilisationPct).toBe(35);
    expect(s.niveau).toBe('NORMAL');
  });

  it('bascule en ALERTE au seuil, pas avant', () => {
    const juste = evaluateCreditLine({
      ...contrat,
      consommationNonFacturee: xof(6_999_999),
      facturesEchuesImpayees: xof(0),
    });
    expect(juste.niveau).toBe('NORMAL');

    const atteint = evaluateCreditLine({
      ...contrat,
      consommationNonFacturee: xof(7_000_000),
      facturesEchuesImpayees: xof(0),
    });
    expect(atteint.niveau).toBe('ALERTE');
  });

  it('bascule en BLOCAGE au seuil de blocage', () => {
    const s = evaluateCreditLine({
      ...contrat,
      consommationNonFacturee: xof(9_000_000),
      facturesEchuesImpayees: xof(0),
    });
    expect(s.niveau).toBe('BLOCAGE');
    expect(s.utilisationPct).toBe(90);
  });

  it('un dépassement du plafond ne rend pas le disponible négatif', () => {
    const s = evaluateCreditLine({
      ...contrat,
      consommationNonFacturee: xof(12_000_000),
      facturesEchuesImpayees: xof(0),
    });
    expect(s.disponible).toBe(0);
    expect(s.depassement).toBe(2_000_000);
    expect(s.niveau).toBe('BLOCAGE');
    expect(s.utilisationPct).toBe(120);
  });
});

describe('projection d’atteinte du seuil de blocage', () => {
  const etat = evaluateCreditLine({
    ...contrat,
    consommationNonFacturee: xof(5_000_000),
    facturesEchuesImpayees: xof(0),
  });
  // seuil blocage = 9 000 000 ; manque = 4 000 000

  it('calcule la date en arithmétique entière, sans division flottante', () => {
    const p = projectBlockingDate({
      etat,
      consommationFenetreXof: xof(3_000_000),
      fenetreJours: 30,
      asOf: '2026-09-05',
    });
    // 4 000 000 * 30 / 3 000 000 = 40 jours pile
    expect(p.joursRestants).toBe(40);
    expect(p.date).toBe('2026-10-15');
    expect(p.raison).toBe('PROJETE');
  });

  it('arrondit au jour supérieur — on ne repousse jamais l’échéance', () => {
    const p = projectBlockingDate({
      etat,
      consommationFenetreXof: xof(3_100_000),
      fenetreJours: 30,
      asOf: '2026-09-05',
    });
    // 4 000 000 * 30 / 3 100 000 = 38,7 → 39
    expect(p.joursRestants).toBe(39);
  });

  it('consommation nulle sur la fenêtre ⇒ pas de projection, pas de division par zéro', () => {
    const p = projectBlockingDate({
      etat,
      consommationFenetreXof: xof(0),
      fenetreJours: 30,
      asOf: '2026-09-05',
    });
    expect(p.joursRestants).toBeNull();
    expect(p.date).toBeNull();
    expect(p.raison).toBe('CONSOMMATION_NULLE');
  });

  it('seuil déjà atteint ⇒ zéro jour, pas un nombre négatif', () => {
    const bloque = evaluateCreditLine({
      ...contrat,
      consommationNonFacturee: xof(9_500_000),
      facturesEchuesImpayees: xof(0),
    });
    const p = projectBlockingDate({
      etat: bloque,
      consommationFenetreXof: xof(3_000_000),
      fenetreJours: 30,
      asOf: '2026-09-05',
    });
    expect(p.joursRestants).toBe(0);
    expect(p.date).toBe('2026-09-05');
    expect(p.raison).toBe('DEJA_ATTEINT');
  });
});
