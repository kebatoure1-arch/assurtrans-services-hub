/**
 * Primitives cryptographiques des codes a usage unique.
 *
 * Elles vivent dans l'infrastructure et non dans le domaine, pour deux raisons :
 * le tirage aleatoire n'est pas une fonction pure, et la maniere de hacher est une decision
 * de securite susceptible de changer sans que la politique metier bouge.
 */

import { createHash, randomInt } from 'node:crypto';

/** Six chiffres tires d'une source cryptographique. `Math.random` n'a rien a faire ici. */
export function genererCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** L'empreinte lie le code au numero : le meme code sur une autre ligne ne correspond pas. */
export function empreinteCode(msisdn: string, code: string): string {
  return createHash('sha256').update(`${msisdn}:${code}`, 'utf8').digest('hex');
}
