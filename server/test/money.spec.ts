import { describe, expect, it } from 'vitest';
import {
  addXof,
  delta,
  pctOf,
  positiveXof,
  ratioPct,
  sumXof,
  xof,
  ZERO_XOF,
} from '../src/domain/money.ts';

describe('money — XOF entier, aucun flottant', () => {
  it('accepte un entier positif', () => {
    expect(xof(125_000)).toBe(125_000);
  });

  it('accepte zéro', () => {
    expect(xof(0)).toBe(ZERO_XOF);
  });

  it('refuse un montant décimal — le XOF n’a pas de subdivision', () => {
    expect(() => xof(1250.5)).toThrow(/entier/i);
    expect(() => xof(0.01)).toThrow(/entier/i);
  });

  it('refuse un montant négatif', () => {
    expect(() => xof(-1)).toThrow(/négatif/i);
  });

  it('refuse NaN et Infinity', () => {
    expect(() => xof(Number.NaN)).toThrow();
    expect(() => xof(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('refuse au-delà de l’entier sûr — perte de précision silencieuse interdite', () => {
    expect(() => xof(Number.MAX_SAFE_INTEGER + 2)).toThrow();
  });

  it('positiveXof refuse zéro', () => {
    expect(() => positiveXof(0)).toThrow(/strictement positif/i);
    expect(positiveXof(1)).toBe(1);
  });

  it('additionne sans dérive', () => {
    expect(addXof(xof(1), xof(2))).toBe(3);
    expect(sumXof([xof(10), xof(20), xof(30)])).toBe(60);
    expect(sumXof([])).toBe(ZERO_XOF);
  });

  it('delta est signé et reste entier', () => {
    expect(delta(xof(100), xof(130))).toBe(-30);
    expect(delta(xof(130), xof(100))).toBe(30);
    expect(delta(xof(100), xof(100))).toBe(0);
  });

  it('pctOf tronque vers le bas — jamais d’arrondi implicite à la hausse', () => {
    expect(pctOf(xof(1000), 70)).toBe(700);
    // 999 * 70 / 100 = 699,3 → 699
    expect(pctOf(xof(999), 70)).toBe(699);
  });

  it('pctOf refuse un pourcentage hors [0,100] ou non entier', () => {
    expect(() => pctOf(xof(1000), 101)).toThrow();
    expect(() => pctOf(xof(1000), -1)).toThrow();
    expect(() => pctOf(xof(1000), 70.5)).toThrow();
  });

  it('ratioPct tronque vers le bas et gère le diviseur nul', () => {
    expect(ratioPct(xof(700), xof(1000))).toBe(70);
    expect(ratioPct(xof(699), xof(1000))).toBe(69);
    expect(ratioPct(xof(1500), xof(1000))).toBe(150);
    expect(ratioPct(xof(0), xof(0))).toBe(0);
    expect(ratioPct(xof(10), xof(0))).toBe(100);
  });
});
