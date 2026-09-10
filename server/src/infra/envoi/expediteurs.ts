/**
 * Expéditeurs de bons.
 *
 * Le canal visé est WhatsApp Business — c'est ce que le chauffeur attend, et c'est ce qui a été
 * promis. Il reste bloqué sur des identifiants Meta et un modèle de message approuvé, deux
 * choses qu'aucune ligne de code ne remplace.
 *
 * En attendant, deux expéditeurs réels permettent au parcours de fonctionner de bout en bout :
 * le SMS, qui marche aujourd'hui avec la passerelle déjà branchée pour les codes OTP, et le
 * journal, réservé au développement. Le worker ignore lequel il pilote.
 *
 * **Ce qui part au chauffeur n'est pas le QR mais un lien vers son bon.** Un jeton signé glissé
 * dans un SMS voyage en clair chez l'opérateur, s'archive dans les sauvegardes du téléphone et
 * se transfère d'un geste. Le lien, lui, exige la session du chauffeur : c'est l'application
 * qui dessine le QR, une fois l'identité vérifiée.
 */

import type { OtpSender } from '../../ports/authentication.ts';
import type { BonAExpedier, ExpediteurDeBon, ResultatEnvoi } from '../../ports/envoi.ts';

/** Le franc CFA s'écrit sans décimale ; l'espace insécable évite une coupure de ligne. */
function francs(montant: number): string {
  return `${montant.toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;
}

/**
 * Message envoyé au chauffeur.
 *
 * Court, parce qu'un SMS long se scinde et coûte double. Il dit le montant — le chauffeur
 * vérifie que c'est bien ce qu'il a payé — et mène à l'application. Il ne contient jamais le
 * jeton.
 */
export function messagePourLeChauffeur(bon: BonAExpedier, baseApplication: string): string {
  const lien = `${baseApplication.replace(/\/$/, '')}/`;
  return (
    `Assur'Trans : votre bon carburant de ${francs(bon.montant)} est prêt. ` +
    `Ouvrez ${lien} pour afficher votre QR code et le présenter au pompiste.`
  );
}

/**
 * Expédition par SMS, via la passerelle déjà en place pour les codes d'authentification.
 *
 * On réutilise `OtpSender` : c'est le même geste — un texte, un numéro — et ouvrir un second
 * port n'ajouterait qu'un doublon à configurer.
 */
export class ExpediteurSms implements ExpediteurDeBon {
  readonly canal = 'SMS';

  constructor(
    private readonly passerelle: OtpSender,
    private readonly baseApplication: string,
  ) {}

  async envoyer(bon: BonAExpedier): Promise<ResultatEnvoi> {
    const envoye = await this.passerelle.envoyer(
      bon.destinataire,
      messagePourLeChauffeur(bon, this.baseApplication),
    );
    return envoye
      ? { kind: 'ENVOYE', reference: null }
      : { kind: 'ECHEC', motif: 'la passerelle SMS a refusé l’envoi' };
  }
}

/**
 * Expédition au journal. Développement uniquement.
 *
 * Écrit le numéro et le montant, jamais le jeton : le journal se conserve, se copie et
 * s'exporte, et un jeton qui y traîne vaut du carburant pour qui le lit.
 */
export class ExpediteurJournal implements ExpediteurDeBon {
  readonly canal = 'LOG';

  constructor(private readonly baseApplication: string) {}

  async envoyer(bon: BonAExpedier): Promise<ResultatEnvoi> {
    console.log(
      JSON.stringify({
        avertissement: 'bon « envoyé » au journal faute de passerelle branchée',
        voucherId: bon.voucherId,
        destinataire: bon.destinataire,
        montantXof: bon.montant,
        message: messagePourLeChauffeur(bon, this.baseApplication),
      }),
    );
    return { kind: 'ENVOYE', reference: null };
  }
}
