/**
 * Lecture d'un événement de confirmation de paiement.
 *
 * La forme exacte des événements Wave n'est pas établie par le contrat d'intégration dont nous
 * disposons. Plutôt que d'inventer des noms de champs, ce mappeur les prend en configuration :
 * type d'événement attendu, chemin de la référence, chemin du montant.
 *
 * Tant qu'ils ne sont pas renseignés, la lecture refuse de s'exécuter. Un mappeur qui devine
 * produirait des bons sur des événements mal compris — c'est-à-dire du carburant offert.
 */

import { EndpointContractUnknownError } from '../infra/wave/wave-client.ts';

export interface CheckoutMapperConfig {
  /** Type d'événement signalant un paiement abouti. */
  readonly eventType: string;
  /** Chemin, séparé par des points, du champ portant NOTRE référence. */
  readonly referencePath: string;
  /** Chemin du champ portant le montant effectivement payé. */
  readonly montantPath: string;
}

export interface PaiementConfirme {
  readonly reference: string;
  readonly montantPaye: number;
}

export class MappageImpossibleError extends Error {
  constructor(detail: string) {
    super(`événement de paiement inexploitable : ${detail}`);
    this.name = 'MappageImpossibleError';
  }
}

function lireChemin(source: Record<string, unknown>, chemin: string): unknown {
  let courant: unknown = source;
  for (const segment of chemin.split('.')) {
    if (typeof courant !== 'object' || courant === null) return undefined;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return courant;
}

export class CheckoutCompletedMapper {
  constructor(private readonly config: CheckoutMapperConfig) {}

  /**
   * Rend `null` pour un événement d'un autre type — ce n'est pas une erreur, seulement un
   * événement qui ne nous concerne pas. Lève si l'événement est du bon type mais illisible :
   * là, quelque chose ne va pas et il ne faut surtout pas continuer.
   */
  lire(eventType: string, payload: Record<string, unknown>): PaiementConfirme | null {
    const { eventType: attendu, referencePath, montantPath } = this.config;
    if (!attendu || !referencePath || !montantPath) {
      throw new EndpointContractUnknownError(
        'forme des événements de paiement Wave (type, chemin de la référence, chemin du montant)',
      );
    }

    if (eventType !== attendu) return null;

    const reference = lireChemin(payload, referencePath);
    if (typeof reference !== 'string' || reference.length === 0) {
      throw new MappageImpossibleError(`référence absente au chemin « ${referencePath} »`);
    }

    const brut = lireChemin(payload, montantPath);
    const texte = typeof brut === 'number' ? String(brut) : brut;
    if (typeof texte !== 'string' || !/^\d+$/.test(texte)) {
      // Un montant décimal ou illisible n'est pas arrondi : le XOF est entier, et un montant
      // mal compris produirait un bon du mauvais montant.
      throw new MappageImpossibleError(
        `montant illisible au chemin « ${montantPath} » : « ${String(brut)} »`,
      );
    }

    return { reference, montantPaye: Number(texte) };
  }
}
