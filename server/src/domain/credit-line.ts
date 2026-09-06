/**
 * Moteur d'encours — carte carburant post-payée.
 *
 * Le post-payé n'est pas un solde à recharger : c'est un cycle de crédit fournisseur.
 * L'indicateur qui a une valeur opérationnelle n'est pas le solde Wave, c'est :
 * « à quelle date l'encours atteint le seuil de blocage au rythme actuel de consommation ».
 *
 * Logique pure : aucune I/O, aucune dépendance.
 */

import { pctOf, ratioPct, subXofFloor0, sumXof, type XOF, ZERO_XOF } from './money.ts';

export type NiveauEncours = 'NORMAL' | 'ALERTE' | 'BLOCAGE';

export interface CreditLineInput {
  /** Plafond de crédit accordé par le fournisseur. */
  readonly encoursAutorise: XOF;
  readonly seuilAlertePct: number;
  readonly seuilBlocagePct: number;
  /** Consommation carte de la période en cours, pas encore facturée. */
  readonly consommationNonFacturee: XOF;
  /** Factures émises, échues, non encore réglées. */
  readonly facturesEchuesImpayees: XOF;
}

export interface CreditLineState {
  readonly encoursAutorise: XOF;
  readonly encoursCourant: XOF;
  readonly disponible: XOF;
  /** Part de l'encours autorisé consommée, en % entier. Peut dépasser 100. */
  readonly utilisationPct: number;
  readonly depassement: XOF;
  readonly seuilAlerteXof: XOF;
  readonly seuilBlocageXof: XOF;
  readonly niveau: NiveauEncours;
}

export class CreditLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditLineError';
  }
}

export function evaluateCreditLine(input: CreditLineInput): CreditLineState {
  const { encoursAutorise, seuilAlertePct, seuilBlocagePct } = input;

  if (seuilAlertePct >= seuilBlocagePct) {
    throw new CreditLineError('seuil d’alerte doit être strictement inférieur au seuil de blocage');
  }

  const encoursCourant = sumXof([input.consommationNonFacturee, input.facturesEchuesImpayees]);
  const seuilAlerteXof = pctOf(encoursAutorise, seuilAlertePct);
  const seuilBlocageXof = pctOf(encoursAutorise, seuilBlocagePct);

  let niveau: NiveauEncours = 'NORMAL';
  if (encoursCourant >= seuilBlocageXof) {
    niveau = 'BLOCAGE';
  } else if (encoursCourant >= seuilAlerteXof) {
    niveau = 'ALERTE';
  }

  return {
    encoursAutorise,
    encoursCourant,
    disponible: subXofFloor0(encoursAutorise, encoursCourant),
    utilisationPct: ratioPct(encoursCourant, encoursAutorise),
    depassement: subXofFloor0(encoursCourant, encoursAutorise),
    seuilAlerteXof,
    seuilBlocageXof,
    niveau,
  };
}

export type RaisonProjection = 'PROJETE' | 'DEJA_ATTEINT' | 'CONSOMMATION_NULLE';

export interface ProjectionInput {
  readonly etat: CreditLineState;
  /** Consommation constatée sur la fenêtre d'observation. */
  readonly consommationFenetreXof: XOF;
  /** Largeur de la fenêtre d'observation, en jours. */
  readonly fenetreJours: number;
  /** Date de référence, format `YYYY-MM-DD`. */
  readonly asOf: string;
}

export interface Projection {
  readonly joursRestants: number | null;
  readonly date: string | null;
  readonly raison: RaisonProjection;
}

const JOUR_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(iso: string): number {
  if (!ISO_DATE.test(iso)) {
    throw new CreditLineError(`date attendue au format YYYY-MM-DD, reçu « ${iso} »`);
  }
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(t)) {
    throw new CreditLineError(`date invalide : ${iso}`);
  }
  return t;
}

function addDaysIso(iso: string, jours: number): string {
  return new Date(parseIsoDate(iso) + jours * JOUR_MS).toISOString().slice(0, 10);
}

/**
 * Date projetée d'atteinte du seuil de blocage, au rythme observé.
 *
 * Le calcul reste en arithmétique entière : `manque * fenêtre / consommation`, arrondi au jour
 * supérieur. Aucune division flottante, et l'échéance n'est jamais repoussée par un arrondi.
 */
export function projectBlockingDate(input: ProjectionInput): Projection {
  const { etat, consommationFenetreXof, fenetreJours, asOf } = input;

  if (!Number.isInteger(fenetreJours) || fenetreJours <= 0) {
    throw new CreditLineError(`fenêtre d’observation en jours entiers > 0 attendue, reçu ${fenetreJours}`);
  }
  parseIsoDate(asOf);

  const manque = subXofFloor0(etat.seuilBlocageXof, etat.encoursCourant);

  if (manque === ZERO_XOF) {
    return { joursRestants: 0, date: asOf, raison: 'DEJA_ATTEINT' };
  }
  if (consommationFenetreXof === ZERO_XOF) {
    return { joursRestants: null, date: null, raison: 'CONSOMMATION_NULLE' };
  }

  const joursRestants = Math.ceil((manque * fenetreJours) / consommationFenetreXof);
  return { joursRestants, date: addDaysIso(asOf, joursRestants), raison: 'PROJETE' };
}

/** Consommation cumulée sur la fenêtre `[asOf - fenetreJours, asOf]`, bornes incluses. */
export function consommationSurFenetre(
  transactions: readonly { readonly date: string; readonly montantXof: XOF }[],
  asOf: string,
  fenetreJours: number,
): XOF {
  const fin = parseIsoDate(asOf);
  const debut = fin - fenetreJours * JOUR_MS;
  const retenues = transactions
    .filter((t) => {
      const d = parseIsoDate(t.date);
      return d >= debut && d <= fin;
    })
    .map((t) => t.montantXof);
  return retenues.length === 0 ? ZERO_XOF : sumXof(retenues);
}

/** Date d'échéance d'une facture, à partir du délai de règlement contractuel. */
export function dateEcheance(dateEmission: string, delaiReglementJours: number): string {
  if (!Number.isInteger(delaiReglementJours) || delaiReglementJours <= 0) {
    throw new CreditLineError('délai de règlement en jours entiers > 0 attendu');
  }
  return addDaysIso(dateEmission, delaiReglementJours);
}

/** Date d'ordonnancement : `n` jours avant l'échéance. */
export function dateOrdonnancement(dateEcheanceIso: string, joursAvant: number): string {
  if (!Number.isInteger(joursAvant) || joursAvant < 0) {
    throw new CreditLineError('nombre de jours avant échéance entier >= 0 attendu');
  }
  return addDaysIso(dateEcheanceIso, -joursAvant);
}
