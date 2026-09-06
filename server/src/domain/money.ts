/**
 * Montants en franc CFA (XOF).
 *
 * Le XOF n'a pas de subdivision en usage. Tout montant est un entier de francs.
 * Toute logique de centimes est un bug. Aucun flottant, aucun arrondi implicite,
 * aucune conversion de devise.
 */

declare const brandXof: unique symbol;

/** Montant en francs CFA. Entier, positif ou nul. */
export type XOF = number & { readonly [brandXof]: 'XOF' };

/** Écart signé entre deux montants, en francs CFA. Entier, signe compris. */
export type XofDelta = number & { readonly [brandXof]: 'XOF_DELTA' };

export const ZERO_XOF = 0 as XOF;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

function assertEntierSur(valeur: number, quoi: string): void {
  if (typeof valeur !== 'number' || Number.isNaN(valeur)) {
    throw new MoneyError(`${quoi} : valeur non numérique`);
  }
  if (!Number.isFinite(valeur)) {
    throw new MoneyError(`${quoi} : valeur non finie`);
  }
  if (!Number.isInteger(valeur)) {
    throw new MoneyError(`${quoi} : le XOF est un entier, reçu ${valeur}`);
  }
  if (!Number.isSafeInteger(valeur)) {
    throw new MoneyError(`${quoi} : au-delà de l'entier sûr, précision non garantie`);
  }
}

/** Construit un montant XOF. Refuse les décimales et les négatifs. */
export function xof(valeur: number): XOF {
  assertEntierSur(valeur, 'montant XOF');
  if (valeur < 0) {
    throw new MoneyError(`montant XOF négatif interdit : ${valeur}`);
  }
  return valeur as XOF;
}

/** Comme `xof`, mais refuse aussi zéro. Pour tout montant qui doit financer quelque chose. */
export function positiveXof(valeur: number): XOF {
  const m = xof(valeur);
  if (m === 0) {
    throw new MoneyError('montant XOF strictement positif attendu');
  }
  return m;
}

export function addXof(a: XOF, b: XOF): XOF {
  return xof(a + b);
}

export function sumXof(montants: readonly XOF[]): XOF {
  return montants.reduce<XOF>((acc, m) => addXof(acc, m), ZERO_XOF);
}

/** Soustraction bornée à zéro. Utilisée pour un disponible, qui n'est jamais négatif. */
export function subXofFloor0(a: XOF, b: XOF): XOF {
  return xof(Math.max(0, a - b));
}

/** Écart signé `attendu - constate`. Positif si l'on a réglé moins que prévu. */
export function delta(attendu: XOF, constate: XOF): XofDelta {
  const d = attendu - constate;
  assertEntierSur(d, 'écart XOF');
  return d as XofDelta;
}

export function absDelta(d: XofDelta): number {
  return Math.abs(d);
}

function assertPourcentage(pct: number): void {
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
    throw new MoneyError(`pourcentage entier attendu dans [0,100], reçu ${pct}`);
  }
}

/** `pct` % de `montant`, tronqué vers le bas. Jamais d'arrondi à la hausse sur un seuil. */
export function pctOf(montant: XOF, pct: number): XOF {
  assertPourcentage(pct);
  return xof(Math.floor((montant * pct) / 100));
}

/**
 * Part de `partie` dans `tout`, en pourcentage entier tronqué vers le bas.
 * Peut dépasser 100 en cas de dépassement de plafond — c'est voulu, on ne masque pas.
 */
export function ratioPct(partie: XOF, tout: XOF): number {
  if (tout === 0) {
    return partie === 0 ? 0 : 100;
  }
  return Math.floor((partie * 100) / tout);
}
