/**
 * Journal d'audit.
 *
 * La table `audit_events` est en ajout seul depuis la premiere migration : deux regles
 * PostgreSQL y annulent silencieusement tout UPDATE et tout DELETE. Ce fichier definit ce
 * qu'on y ecrit.
 *
 * Decision structurante, deja inscrite dans le schema : on enregistre l'EMPREINTE du payload,
 * jamais le payload. Le journal repond a « qui a fait quoi, quand, sur quoi » — pas a « quelles
 * donnees personnelles ont transite ». Un journal d'audit qui accumule des numeros de telephone
 * devient lui-meme un fichier a proteger, et se conserve pourtant plus longtemps que le reste.
 *
 * L'empreinte reste utile : elle prouve qu'une action portait bien tel contenu si on le
 * represente plus tard, sans le conserver entre-temps.
 *
 * Logique pure : aucune I/O.
 */

import { createHash } from 'node:crypto';

export interface EvenementAudit {
  /** Identifiant du compte a l'origine de l'action. Jamais « systeme » pour une action humaine. */
  readonly actor: string;
  /** Verbe au passe, en majuscules : DRIVER_SUSPENDU, REGLEMENT_APPROUVE. */
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly payload: Record<string, unknown>;
}

/**
 * Empreinte stable d'un payload.
 *
 * Les cles sont triees avant serialisation : sans cela, deux ecritures du meme contenu
 * produiraient des empreintes differentes selon l'ordre d'insertion des cles, et la trace
 * deviendrait invérifiable.
 */
export function empreintePayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonique(payload), 'utf8').digest('hex');
}

function canonique(valeur: unknown): string {
  if (valeur === null || typeof valeur !== 'object') return JSON.stringify(valeur) ?? 'null';
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`;

  const entrees = Object.entries(valeur as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cle, v]) => `${JSON.stringify(cle)}:${canonique(v)}`);

  return `{${entrees.join(',')}}`;
}
