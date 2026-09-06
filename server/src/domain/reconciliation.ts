/**
 * Rapprochement à trois voies : facture ↔ intention de règlement ↔ relevé du portefeuille.
 *
 * Règle de conception : aucun état silencieux. Chaque transaction du relevé reçoit une ligne,
 * et chaque ligne porte un statut parmi MATCHED / VARIANCE / ORPHAN. Le solde de contrôle
 * `integrite.toutesTransactionsClassees` doit rester vrai — s'il tombe à faux, le rapprochement
 * est incomplet et l'ordonnancement du cycle suivant est bloqué.
 *
 * Logique pure : aucune I/O.
 */

import { absDelta, delta, type XOF, type XofDelta, ZERO_XOF } from './money.ts';
import { ETATS_ENVOYES, type PaymentIntentStatut } from './payment-intent.ts';

export type ReconciliationStatut = 'MATCHED' | 'VARIANCE' | 'ORPHAN';

export interface ReconInvoice {
  readonly id: string;
  readonly numero: string;
  readonly montantXof: XOF;
  readonly dateEcheance: string;
}

export interface ReconIntent {
  readonly id: string;
  readonly invoiceId: string;
  readonly montantXof: XOF;
  readonly statut: PaymentIntentStatut;
  readonly wavePayoutId: string | null;
}

export interface ReconWaveTx {
  readonly id: string;
  readonly waveTxId: string;
  readonly sens: 'IN' | 'OUT';
  readonly montantXof: XOF;
  readonly contrepartie: string | null;
}

export interface ReconInput {
  /** Fin de période rapprochée, `YYYY-MM-DD`. */
  readonly periode: string;
  /** Écart absolu toléré pour classer MATCHED. Mettre 0 en l'absence de justification. */
  readonly toleranceXof: XOF;
  readonly invoices: readonly ReconInvoice[];
  readonly intents: readonly ReconIntent[];
  readonly waveTransactions: readonly ReconWaveTx[];
}

export interface ReconLine {
  readonly statut: ReconciliationStatut;
  readonly invoiceId: string | null;
  readonly paymentIntentId: string | null;
  readonly waveTransactionId: string | null;
  /** `montant constaté au relevé - montant attendu`. Négatif = on a réglé moins que dû. */
  readonly ecartXof: XofDelta;
  readonly toleranceXof: XOF;
  readonly motif: string;
}

export interface ReconResult {
  readonly lignes: readonly ReconLine[];
  readonly resume: {
    readonly matched: number;
    readonly variance: number;
    readonly orphan: number;
    /** Intentions encore en vol : ni classées, ni ignorées. */
    readonly enAttente: number;
  };
  readonly integrite: {
    readonly toutesTransactionsClassees: boolean;
    readonly transactionsNonClassees: readonly string[];
  };
  /** §11 : un VARIANCE ou un ORPHAN non résolu bloque l'ordonnancement du cycle suivant. */
  readonly bloqueCycleSuivant: boolean;
}

/** États d'intention qui ne sont pas encore rapprochables, mais qui ne sont pas des erreurs. */
const ETATS_EN_VOL: readonly PaymentIntentStatut[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'DISPATCHING',
];

/** Intentions sans effet monétaire : hors rapprochement. */
const ETATS_SANS_EFFET: readonly PaymentIntentStatut[] = ['CANCELLED', 'FAILED'];

/** `constaté - attendu`. */
function ecartConstate(constate: XOF, attendu: XOF): XofDelta {
  return delta(constate, attendu);
}

export function reconcile(input: ReconInput): ReconResult {
  const { toleranceXof } = input;
  const lignes: ReconLine[] = [];
  const txConsommees = new Set<string>();
  let enAttente = 0;

  const intentsParFacture = new Map<string, ReconIntent[]>();
  for (const intent of input.intents) {
    if (ETATS_SANS_EFFET.includes(intent.statut)) continue;
    const liste = intentsParFacture.get(intent.invoiceId) ?? [];
    liste.push(intent);
    intentsParFacture.set(intent.invoiceId, liste);
  }

  for (const invoice of input.invoices) {
    const intents = intentsParFacture.get(invoice.id) ?? [];

    if (intents.length === 0) {
      lignes.push({
        statut: 'ORPHAN',
        invoiceId: invoice.id,
        paymentIntentId: null,
        waveTransactionId: null,
        ecartXof: ecartConstate(ZERO_XOF, invoice.montantXof),
        toleranceXof,
        motif: `facture ${invoice.numero} échue le ${invoice.dateEcheance} et jamais ordonnancée`,
      });
      continue;
    }

    for (const intent of intents) {
      if (ETATS_EN_VOL.includes(intent.statut)) {
        enAttente += 1;
        continue;
      }

      if (intent.statut === 'NEEDS_REVIEW') {
        lignes.push({
          statut: 'VARIANCE',
          invoiceId: invoice.id,
          paymentIntentId: intent.id,
          waveTransactionId: null,
          ecartXof: ecartConstate(ZERO_XOF, invoice.montantXof),
          toleranceXof,
          motif: 'intention en revue humaine — mouvement de fonds non tranché',
        });
        continue;
      }

      if (!ETATS_ENVOYES.includes(intent.statut)) {
        // Filet : un statut ajouté plus tard ne doit jamais disparaître silencieusement.
        lignes.push({
          statut: 'VARIANCE',
          invoiceId: invoice.id,
          paymentIntentId: intent.id,
          waveTransactionId: null,
          ecartXof: ecartConstate(ZERO_XOF, invoice.montantXof),
          toleranceXof,
          motif: `statut d'intention non classable : ${intent.statut}`,
        });
        continue;
      }

      const correspondantes = input.waveTransactions.filter(
        (tx) => tx.sens === 'OUT' && intent.wavePayoutId !== null && tx.waveTxId === intent.wavePayoutId,
      );

      if (correspondantes.length === 0) {
        lignes.push({
          statut: 'VARIANCE',
          invoiceId: invoice.id,
          paymentIntentId: intent.id,
          waveTransactionId: null,
          ecartXof: ecartConstate(ZERO_XOF, invoice.montantXof),
          toleranceXof,
          motif: `payout ${intent.wavePayoutId ?? '(absent)'} annoncé mais introuvable au relevé Wave`,
        });
        continue;
      }

      if (correspondantes.length > 1) {
        for (const tx of correspondantes) {
          txConsommees.add(tx.id);
          lignes.push({
            statut: 'VARIANCE',
            invoiceId: invoice.id,
            paymentIntentId: intent.id,
            waveTransactionId: tx.id,
            ecartXof: ecartConstate(tx.montantXof, invoice.montantXof),
            toleranceXof,
            motif: `double règlement : ${correspondantes.length} sorties portent le payout ${intent.wavePayoutId}`,
          });
        }
        continue;
      }

      const tx = correspondantes[0];
      txConsommees.add(tx.id);
      const ecart = ecartConstate(tx.montantXof, invoice.montantXof);
      const dansLaTolerance = absDelta(ecart) <= toleranceXof;

      lignes.push({
        statut: dansLaTolerance ? 'MATCHED' : 'VARIANCE',
        invoiceId: invoice.id,
        paymentIntentId: intent.id,
        waveTransactionId: tx.id,
        ecartXof: ecart,
        toleranceXof,
        motif: dansLaTolerance
          ? `facture ${invoice.numero} lettrée avec le payout ${intent.wavePayoutId}`
          : `écart de ${absDelta(ecart)} XOF entre la facture ${invoice.numero} et le relevé`,
      });
    }
  }

  for (const tx of input.waveTransactions) {
    if (txConsommees.has(tx.id)) continue;
    txConsommees.add(tx.id);
    lignes.push({
      statut: 'ORPHAN',
      invoiceId: null,
      paymentIntentId: null,
      waveTransactionId: tx.id,
      ecartXof: ecartConstate(tx.montantXof, ZERO_XOF),
      toleranceXof,
      motif:
        tx.sens === 'IN'
          ? `mouvement entrant inattendu de ${tx.contrepartie ?? 'contrepartie inconnue'} — ADR-001 interdit tout encaissement`
          : `sortie de fonds de ${tx.montantXof} XOF sans aucune intention de règlement`,
    });
  }

  const transactionsNonClassees = input.waveTransactions
    .filter((tx) => !txConsommees.has(tx.id))
    .map((tx) => tx.id);

  const resume = {
    matched: lignes.filter((l) => l.statut === 'MATCHED').length,
    variance: lignes.filter((l) => l.statut === 'VARIANCE').length,
    orphan: lignes.filter((l) => l.statut === 'ORPHAN').length,
    enAttente,
  };

  return {
    lignes,
    resume,
    integrite: {
      toutesTransactionsClassees: transactionsNonClassees.length === 0,
      transactionsNonClassees,
    },
    bloqueCycleSuivant:
      resume.variance > 0 || resume.orphan > 0 || transactionsNonClassees.length > 0,
  };
}
