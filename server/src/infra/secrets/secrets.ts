/**
 * Gestion des secrets.
 *
 * Trois garanties, dans cet ordre d'importance :
 *
 *  1. **Un secret ne se journalise pas par accident.** `Secret` masque sa valeur dans toute
 *     interpolation, toute sérialisation JSON et toute inspection Node. On ne peut la lire
 *     qu'en appelant `expose()` — un appel visible en revue de code.
 *  2. **Un secret n'atteint jamais le bundle client.** `EnvSecretProvider` refuse tout nom
 *     préfixé `VITE_`, y compris quand c'est la seule variable disponible. Vite inline ces
 *     variables dans le JavaScript servi aux utilisateurs : les y mettre revient à les publier.
 *  3. **Une configuration incomplète échoue au démarrage,** pas au premier paiement. Aucune
 *     valeur de repli, jamais.
 */

import { timingSafeEqual } from 'node:crypto';

export class MissingSecretError extends Error {
  constructor(nom: string) {
    // Le message nomme la variable attendue. Il ne contient aucune valeur.
    super(`secret « ${nom} » absent ou vide : configuration incomplète, aucun repli n'est prévu`);
    this.name = 'MissingSecretError';
  }
}

export class ClientBundleLeakError extends Error {
  constructor(nom: string) {
    super(
      `« ${nom} » porte le préfixe VITE_ : Vite inline ces variables dans le bundle client, ` +
        'un secret ainsi nommé est publié à tous les utilisateurs. Utiliser un nom sans préfixe, ' +
        'lu côté serveur uniquement.',
    );
    this.name = 'ClientBundleLeakError';
  }
}

const MASQUE = (nom: string): string => `[REDACTED:${nom}]`;

/**
 * Valeur sensible. La valeur brute est portée par un champ privé de classe : elle n'est ni
 * énumérable, ni sérialisable, ni visible dans un `console.log`.
 */
export class Secret {
  readonly #valeur: string;

  constructor(
    valeur: string,
    readonly nom: string,
  ) {
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      throw new MissingSecretError(nom);
    }
    this.#valeur = valeur;
  }

  /** Seul accès à la valeur. Appel explicite, repérable en revue. */
  expose(): string {
    return this.#valeur;
  }

  /** Longueur — utile pour un diagnostic sans rien révéler. */
  get longueur(): number {
    return this.#valeur.length;
  }

  /** Comparaison à durée constante. Ne révèle ni la valeur, ni la position d'une divergence. */
  equals(autre: Secret): boolean {
    const a = Buffer.from(this.#valeur, 'utf8');
    const b = Buffer.from(autre.#valeur, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  toString(): string {
    return MASQUE(this.nom);
  }

  toJSON(): string {
    return MASQUE(this.nom);
  }

  [Symbol.toPrimitive](): string {
    return MASQUE(this.nom);
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return MASQUE(this.nom);
  }
}

/**
 * Filet de sécurité : masque les valeurs de secrets dans un texte avant journalisation.
 *
 * Ce n'est pas la protection principale — `Secret` l'est. C'est la ceinture qui rattrape les cas
 * où une valeur a été exposée puis recopiée dans une trace ou un message d'erreur tiers.
 */
export function redact(texte: string, secrets: readonly Secret[]): string {
  let sortie = texte;
  for (const s of secrets) {
    sortie = sortie.split(s.expose()).join(MASQUE(s.nom));
  }
  return sortie;
}

export interface SecretProvider {
  get(nom: string): Promise<Secret>;
}

const PREFIXE_BUNDLE_CLIENT = 'VITE_';

/**
 * Lecture depuis l'environnement du processus serveur.
 *
 * En production, l'environnement est alimenté au démarrage par KMS ou Vault ; c'est
 * l'orchestrateur qui injecte, pas le code qui va chercher. Pour brancher un coffre appelé à
 * chaud, implémenter `SecretProvider` et l'envelopper dans `CachingSecretProvider`.
 */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

  async get(nom: string): Promise<Secret> {
    if (nom.startsWith(PREFIXE_BUNDLE_CLIENT)) {
      throw new ClientBundleLeakError(nom);
    }
    const brut = this.env[nom];
    if (brut === undefined || brut.trim() === '') {
      throw new MissingSecretError(nom);
    }
    return new Secret(brut, nom);
  }
}

/**
 * Cache mémoire au-dessus d'un fournisseur.
 *
 * `invalidate` existe pour la rotation : on remplace la valeur au coffre, on invalide, et le
 * prochain appel relit — sans redémarrage. Voir la procédure §1 du runbook.
 */
export class CachingSecretProvider implements SecretProvider {
  readonly #cache = new Map<string, Secret>();

  constructor(private readonly source: SecretProvider) {}

  async get(nom: string): Promise<Secret> {
    const enCache = this.#cache.get(nom);
    if (enCache) return enCache;
    const secret = await this.source.get(nom);
    this.#cache.set(nom, secret);
    return secret;
  }

  invalidate(nom?: string): void {
    if (nom === undefined) {
      this.#cache.clear();
      return;
    }
    this.#cache.delete(nom);
  }
}
