/**
 * Mémoire locale du dernier bon utilisable.
 *
 * C'est ce qui permet à un chauffeur dont le réseau tombe à la pompe de voir quand même son QR :
 * le jeton signé est conservé sur l'appareil, et le code se redessine sans aucun appel réseau.
 *
 * Trois précautions, chacune corrigeant un vrai risque :
 *
 *  1. **L'enregistrement est rattaché au chauffeur.** Les téléphones se prêtent. Sans cela, le
 *     chauffeur suivant ouvrirait l'application hors ligne et verrait le bon du précédent.
 *  2. **Il est effacé à la déconnexion.** Un bon est un titre de carburant : il n'a rien à
 *     faire sur un appareil que son propriétaire vient de quitter.
 *  3. **On ne conserve que ce qui sert à afficher le ticket.** Rien d'autre du compte.
 *
 * Ce qu'on ne peut pas savoir hors ligne : si le bon a déjà été consommé ailleurs. Seul le
 * serveur le sait, et c'est l'appareil du pompiste qui tranche au moment de servir. L'écran le
 * dit plutôt que de laisser croire à une garantie.
 */

import type { Bon } from './api.ts';

const PREFIXE = 'assurtrans.dernier-bon';

/* Ancienne clé, non rattachée à un chauffeur. Purgée au démarrage. */
const CLE_HERITEE = 'assurtrans.dernier-bon';

function cle(driverId: string): string {
  return `${PREFIXE}.${driverId}`;
}

export function lireDernierBon(driverId: string): Bon | null {
  try {
    const brut = localStorage.getItem(cle(driverId));
    if (brut === null) return null;

    const bon = JSON.parse(brut) as Bon;
    // Un bon périmé n'est plus un bon. On ne le ressort pas d'un tiroir.
    if (bon.statut !== 'EMIS' || Date.parse(bon.expireA) <= Date.now()) {
      localStorage.removeItem(cle(driverId));
      return null;
    }
    return bon;
  } catch {
    return null;
  }
}

export function enregistrerDernierBon(driverId: string, bon: Bon | null): void {
  try {
    if (bon === null || bon.jeton === null) {
      localStorage.removeItem(cle(driverId));
      return;
    }
    localStorage.setItem(cle(driverId), JSON.stringify(bon));
  } catch {
    // Stockage refusé (navigation privée, quota) : le mode connecté reste entier, seul
    // l'affichage hors ligne est perdu. Ce n'est pas une raison d'interrompre le chauffeur.
  }
}

/** Efface toute trace de bon sur cet appareil. Appelé à la déconnexion. */
export function oublierBons(): void {
  try {
    localStorage.removeItem(CLE_HERITEE);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIXE)) localStorage.removeItem(k);
    }
  } catch {
    /* rien à faire */
  }
}
