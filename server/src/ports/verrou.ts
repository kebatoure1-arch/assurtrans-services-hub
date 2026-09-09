/**
 * Verrou de travaux périodiques.
 *
 * Plusieurs exemplaires du serveur peuvent tourner. Sans verrou, chacun reprendrait les mêmes
 * envois interrompus au même instant : deux consultations du fournisseur pour le même ordre,
 * et surtout deux écritures concurrentes sur la même intention.
 *
 * Le verrou porte une échéance plutôt qu'un déverrouillage garanti : un exemplaire qui meurt en
 * le tenant le libérerait sinon jamais, et la reprise ne se ferait plus du tout — ce qui est
 * pire que de la faire deux fois.
 */

export interface VerrouTravaux {
  /**
   * `false` si un autre exemplaire le tient encore. Ne lève pas : ne pas obtenir le verrou est
   * un déroulement normal, pas une erreur.
   */
  prendre(nom: string): Promise<boolean>;
  rendre(nom: string): Promise<void>;
}
