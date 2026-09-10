/**
 * Port d'expédition d'un bon au chauffeur.
 *
 * Le chauffeur a payé ; tant qu'il n'a pas son QR, il a payé pour rien. C'est la dernière
 * marche du parcours, et la seule que le système ne franchit pas encore.
 *
 * `envoyer` ne lève jamais. Un échec d'expédition se signale par `ECHEC` et se réessaie ; une
 * exception qui remonte ferait tomber le passage entier et bloquerait les envois suivants.
 *
 * Réessayer un envoi est sûr, et c'est ce qui distingue ce port du canal de règlement : un bon
 * est à usage unique et son jeton est déterministe. L'envoyer deux fois ne donne pas deux fois
 * du carburant — cela donne deux fois le même code, dont un seul servira. Le règlement, lui, ne
 * se réessaie jamais : deux versements sont deux versements.
 */

import type { XOF } from '../domain/money.ts';

export interface BonAExpedier {
  readonly voucherId: string;
  readonly destinataire: string;
  readonly montant: XOF;
  /** Jeton signé, reconstruit à l'instant de l'envoi. Ne doit jamais être journalisé. */
  readonly token: string;
  readonly expireA: string;
}

export type ResultatEnvoi =
  | { readonly kind: 'ENVOYE'; readonly reference: string | null }
  | { readonly kind: 'ECHEC'; readonly motif: string };

export interface ExpediteurDeBon {
  /** Nom du canal, tel qu'il apparaîtra dans `voucher_deliveries.canal`. */
  readonly canal: string;
  envoyer(bon: BonAExpedier): Promise<ResultatEnvoi>;
}
