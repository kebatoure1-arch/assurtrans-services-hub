/**
 * API HTTP.
 *
 * Quatre décisions structurent ce fichier :
 *
 *  1. **Le corps brut du webhook est conservé.** La signature porte sur les octets reçus ; un
 *     JSON re-sérialisé ne se vérifie pas.
 *  2. **La station vient du porteur du jeton, jamais du corps de la requête.** Un pompiste ne
 *     peut pas déclarer servir au nom d'une autre station.
 *  3. **Le montant vient de la session enregistrée, jamais du webhook.** Un événement annonçant
 *     un montant différent de celui demandé n'émet aucun bon.
 *  4. **Aucune réponse d'erreur ne recopie un détail interne.** Le client reçoit un code et un
 *     message court ; la trace complète reste dans les journaux serveur.
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { type XOF, xof } from '../domain/money.ts';
import {
  AlreadyRedeemedError,
  VoucherCancelledError,
  VoucherExpiredError,
} from '../domain/fuel-voucher.ts';
import type { EmitVoucherOnPayment } from '../application/emit-voucher-on-payment.ts';
import {
  MontantIncoherentError,
  type RedeemVoucherAtStation,
  VoucherIntrouvableError,
} from '../application/redeem-voucher-at-station.ts';
import type { AccessTokenVerifier, ApiRole, Principal } from '../infra/auth/api-tokens.ts';
import { SignatureError } from '../infra/security/voucher-signature.ts';
import {
  type WebhookDeduplicator,
  type WebhookVerifier,
  WebhookError,
} from '../infra/webhooks/webhook.ts';
import { EndpointContractUnknownError } from '../infra/wave/wave-client.ts';
import type { CollectionChannel } from '../ports/collection-channel.ts';
import type {
  CheckoutSessionRepository,
  IdGenerator,
  VoucherRepository,
} from '../ports/repositories.ts';
import type { CheckoutCompletedMapper } from './checkout-mapper.ts';
import {
  ManageDirectory,
  NumeroDejaUtiliseError,
  ReferentielRefuseError,
} from '../application/admin/manage-directory.ts';
import type { TableauDeBord } from '../application/admin/tableau-de-bord.ts';
import type { AuditLogger } from '../ports/audit.ts';
import type { JournalAudit } from '../ports/journal.ts';
import type { ReleveRepository } from '../ports/rapprochement.ts';
import type { EnvoyerLesBons } from '../application/envoyer-les-bons.ts';
import {
  LigneIntrouvableError,
  NoteRequiseError,
  type RapprocherLaPeriode,
  ReleveVideError,
} from '../application/rapprocher.ts';
import type { ReprendreEnvoisInterrompus } from '../application/settlement/reprise.ts';
import {
  ConcurrenceError,
  CycleBloqueError,
  CycleReglement,
  FactureIntrouvableError,
  IntentionIntrouvableError,
  NumeroFactureDejaUtiliseError,
} from '../application/settlement/cycle-reglement.ts';
import {
  InvalidTransitionError,
  LimitExceededError,
  SecondFactorRequiredError,
  SegregationOfDutiesError,
} from '../domain/payment-intent.ts';
import {
  AuthenticateByPhone,
  AuthentificationRefuseeError,
  TropDeDemandesError,
} from '../application/authenticate-by-phone.ts';
import { MsisdnInvalideError } from '../domain/otp.ts';
import type { VoucherSigner } from '../infra/security/voucher-signature.ts';

export interface ServerDeps {
  readonly encaissement: CollectionChannel;
  readonly sessions: CheckoutSessionRepository;
  readonly emission: EmitVoucherOnPayment;
  readonly consommation: RedeemVoucherAtStation;
  readonly bons: VoucherRepository;
  readonly jetons: AccessTokenVerifier;
  readonly webhook: WebhookVerifier;
  readonly dedup: WebhookDeduplicator;
  readonly mappeur: CheckoutCompletedMapper;
  readonly ids: IdGenerator;
  readonly cles: IdGenerator;
  readonly horloge: () => string;
  readonly montantBon: { readonly minXof: XOF; readonly maxXof: XOF };
  readonly auth: AuthenticateByPhone;
  readonly signer: VoucherSigner;
  /** Origines autorisees pour le front. Vide = aucune requete inter-origine acceptee. */
  readonly originesAutorisees: readonly string[];
  /**
   * Referentiel et pilotage. Optionnels : le harnais de demonstration tourne sans base, et
   * l'API repond alors 503 sur les routes d'administration plutot que d'echouer au demarrage.
   */
  readonly referentiel?: ManageDirectory;
  readonly tableauDeBord?: TableauDeBord;
  /** Trace des actions sensibles hors referentiel : encaissement, consommation. */
  readonly audit?: AuditLogger;
  /**
   * Cycle de reglement TotalEnergies. Optionnel comme le referentiel : sans base, les routes
   * repondent 503 plutot que d'empecher le demarrage.
   */
  readonly reglement?: CycleReglement;
  /** Contrat servi par ce deploiement. Les listes de factures et d'intentions s'y rapportent. */
  readonly contractId?: string;
  /**
   * Reprise des envois interrompus. Elle tourne au demarrage ; la route permet de la relancer
   * sans redemarrer, ce qui compte le jour ou une intention reste bloquee.
   */
  readonly reprise?: ReprendreEnvoisInterrompus;
  /**
   * Worker d'envoi des bons. La file se vide toute seule ; la route permet de la pousser sans
   * attendre, ce qui compte le jour ou un chauffeur appelle en disant n'avoir rien recu.
   */
  readonly envoi?: EnvoyerLesBons;
  /**
   * Rapprochement a trois voies. Le releve est expose a part : il s'alimente a la main, faute
   * d'endpoint Wave documente.
   */
  readonly rapprochement?: RapprocherLaPeriode;
  readonly releve?: ReleveRepository;
  /**
   * Consultation du journal d'audit. Lecture seule : il n'existe aucune route d'ecriture
   * depuis l'exterieur, et il n'en existera pas.
   */
  readonly journal?: JournalAudit;
}

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
    principal?: Principal;
  }
}

const CorpsSession = z.object({
  montantXof: z.number().int().positive(),
});

const CorpsDemandeCode = z.object({
  telephone: z.string().min(6).max(24),
});

const CorpsSession2 = z.object({
  telephone: z.string().min(6).max(24),
  code: z.string().regex(/^\d{6}$/),
});

const CorpsConsommation = z.object({
  token: z.string().min(1).max(4096),
  redemptionId: z.string().min(1).max(128),
});

const CorpsNouveauChauffeur = z.object({
  // Une seule entite en Beta : celle du deploiement. Le champ reste accepte pour le jour ou
  // Assur'Trans exploitera plusieurs comptes TotalEnergies.
  entityId: z.string().uuid().optional(),
  nom: z.string().trim().min(1).max(160),
  telephone: z.string().min(6).max(24),
});

const CorpsChangementStatut = z.object({
  statut: z.enum(['ACTIF', 'SUSPENDU']),
  motif: z.string().trim().min(1).max(280),
});

const CorpsNouvelleEntite = z.object({
  raisonSociale: z.string().trim().min(1).max(200),
  ninea: z.string().trim().max(80).nullable().optional(),
  rccm: z.string().trim().max(80).nullable().optional(),
});

const CorpsNouvelleStation = z.object({
  code: z.string().trim().min(1).max(64),
  nom: z.string().trim().min(1).max(160),
  ville: z.string().trim().max(160).nullable().optional(),
});

/**
 * Une facture arrive du fournisseur. Les dates sont des jours, sans heure : une facture porte
 * une periode et une echeance, pas un instant.
 */
const CorpsNouvelleFacture = z.object({
  numero: z.string().trim().min(1).max(64),
  periodeDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodeFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Entier de francs. Aucun centime, aucun flottant : le franc CFA n'a pas de subdivision.
  montantXof: z.number().int().positive(),
  dateEmission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEcheance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const CorpsPreparation = z.object({
  invoiceId: z.string().uuid(),
});

/** L'execution exige un code frais, envoye au numero enregistre de l'operateur (§9). */
const CorpsExecution = z.object({
  code: z.string().regex(/^\d{6}$/),
});

/** Une periode de rapprochement se designe par son dernier jour : c'est un arrete. */
const CorpsRapprochement = z.object({
  periode: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Entier de francs. Zero en l'absence de justification ecrite d'une tolerance.
  toleranceXof: z.number().int().min(0).default(0),
});

const CorpsResolution = z.object({
  note: z.string().trim().min(1).max(500),
});

/** Une ligne du releve du portefeuille, saisie depuis le portail Wave Business. */
const CorpsMouvement = z.object({
  waveTxId: z.string().trim().min(1).max(128),
  dateTx: z.string().min(10).max(40),
  sens: z.enum(['IN', 'OUT']),
  montantXof: z.number().int().positive(),
  contrepartie: z.string().trim().max(200).nullable().optional(),
});

const CorpsNouvelOperateur = z.object({
  nom: z.string().trim().min(1).max(160),
  telephone: z.string().min(6).max(24),
  role: z.enum(['STATION_OPERATOR', 'ADMIN']),
  stationId: z.string().uuid().nullable().optional(),
});

function erreur(reply: FastifyReply, code: number, message: string): FastifyReply {
  return reply.code(code).send({ erreur: message });
}

/**
 * Refus de consommation, sous forme exploitable par une interface.
 *
 * Le message technique reste dans les journaux. Ce que recoit le pompiste est un code et les
 * quelques donnees dont il a besoin — a son ecran de les formuler dans sa langue. Lui afficher
 * un identifiant de bon et un horodatage ISO serait lui faire lire nos entrailles.
 */
function refus(
  reply: FastifyReply,
  statut: number,
  code: string,
  details: Record<string, unknown> = {},
): FastifyReply {
  return reply.code(statut).send({ erreur: code, code, ...details });
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });

  // Le front est servi depuis une autre origine. La liste est explicite : pas de joker.
  if (deps.originesAutorisees.length > 0) {
    void app.register(cors, {
      origin: deps.originesAutorisees as string[],
      methods: ['GET', 'POST'],
      allowedHeaders: ['content-type', 'authorization'],
      maxAge: 600,
    });
  }

  // Le corps brut est conservé pour la vérification de signature des webhooks.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, corps, done) => {
    const texte = typeof corps === 'string' ? corps : corps.toString('utf8');
    req.rawBody = texte;
    if (texte.length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(texte));
    } catch {
      done(Object.assign(new Error('corps JSON invalide'), { statusCode: 400 }), undefined);
    }
  });

  async function exigerRole(
    req: FastifyRequest,
    reply: FastifyReply,
    roles: readonly ApiRole[],
  ): Promise<Principal | null> {
    const entete = req.headers.authorization;
    if (typeof entete !== 'string' || !entete.startsWith('Bearer ')) {
      erreur(reply, 401, 'authentification requise');
      return null;
    }
    const principal = await deps.jetons.verify(entete.slice('Bearer '.length).trim());
    if (principal === null) {
      erreur(reply, 401, 'jeton invalide ou révoqué');
      return null;
    }
    if (!roles.includes(principal.role)) {
      erreur(reply, 403, 'rôle insuffisant');
      return null;
    }
    req.principal = principal;
    return principal;
  }

  app.get('/health', async () => ({ statut: 'ok' }));

  // ------------------------------------------------------------- authentification

  app.post('/api/auth/code', async (req, reply) => {
    const corps = CorpsDemandeCode.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'numero de telephone attendu');

    try {
      const r = await deps.auth.demanderCode(corps.data.telephone, deps.horloge());
      return reply.code(202).send(r);
    } catch (cause) {
      if (cause instanceof MsisdnInvalideError) {
        return erreur(reply, 400, 'numero de telephone invalide : attendu un mobile senegalais (9 chiffres, 70/75/76/77/78) ou ivoirien (10 chiffres, 01/05/07)');
      }
      if (cause instanceof TropDeDemandesError) {
        return reply
          .code(429)
          .header('Retry-After', String(cause.reessayerDansSecondes))
          .send({ erreur: 'trop de demandes, reessayez plus tard' });
      }
      throw cause;
    }
  });

  app.post('/api/auth/session', async (req, reply) => {
    const corps = CorpsSession2.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'numero et code a six chiffres attendus');

    try {
      const session = await deps.auth.ouvrirSession(
        corps.data.telephone,
        corps.data.code,
        deps.horloge(),
      );
      return reply.code(200).send(session);
    } catch (cause) {
      if (cause instanceof MsisdnInvalideError) {
        return erreur(reply, 400, 'numero de telephone invalide : attendu un mobile senegalais (9 chiffres, 70/75/76/77/78) ou ivoirien (10 chiffres, 01/05/07)');
      }
      if (cause instanceof AuthentificationRefuseeError) {
        return erreur(reply, 401, cause.message);
      }
      throw cause;
    }
  });

  app.get('/api/moi', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['DRIVER', 'ADMIN', 'STATION_OPERATOR']);
    if (principal === null) return reply;
    return reply.send(principal);
  });

  // ------------------------------------------------------------- administration

  /**
   * Toutes les routes d'administration passent par `ManageDirectory`.
   *
   * Les regles metier — unicite d'un numero tous roles confondus, station verifiee, motif
   * obligatoire pour un changement de statut — et la trace d'audit y vivent en un seul endroit.
   * Les rejouer dans chaque gestionnaire de route finirait par les faire diverger.
   */
  function refusReferentiel(reply: FastifyReply, cause: unknown): FastifyReply | null {
    if (cause instanceof NumeroDejaUtiliseError) return erreur(reply, 409, cause.message);
    if (cause instanceof ReferentielRefuseError) return erreur(reply, 400, cause.message);
    if (cause instanceof Error && cause.message.includes('inexploitable')) {
      return erreur(reply, 400, 'numero de telephone invalide : attendu un mobile senegalais (9 chiffres, 70/75/76/77/78) ou ivoirien (10 chiffres, 01/05/07)');
    }
    if (cause instanceof Error && cause.message.includes('duplicate key')) {
      return erreur(reply, 409, 'fiche deja existante');
    }
    return null;
  }

  async function avecReferentiel<T>(
    reply: FastifyReply,
    bloc: (referentiel: ManageDirectory) => Promise<T>,
  ): Promise<T | FastifyReply> {
    if (deps.referentiel === undefined) {
      return erreur(reply, 503, 'referentiel indisponible');
    }
    try {
      return await bloc(deps.referentiel);
    } catch (cause) {
      const refus = refusReferentiel(reply, cause);
      if (refus !== null) return refus;
      throw cause;
    }
  }

  app.get('/api/admin/tableau-de-bord', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    if (deps.tableauDeBord === undefined) return erreur(reply, 503, 'pilotage indisponible');
    return reply.send(await deps.tableauDeBord.etat());
  });

  app.post('/api/admin/entities', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsNouvelleEntite.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'raison sociale attendue');

    return avecReferentiel(reply, async (referentiel) => {
      const entite = await referentiel.creerEntite(
        { raisonSociale: corps.data.raisonSociale, ninea: corps.data.ninea, rccm: corps.data.rccm },
        principal.subject,
      );
      return reply.code(201).send(entite);
    });
  });

  app.get('/api/admin/drivers', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    return avecReferentiel(reply, async (r) => reply.send(await r.listerChauffeurs()));
  });

  app.post('/api/admin/drivers', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsNouveauChauffeur.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'nom et telephone attendus');

    return avecReferentiel(reply, async (referentiel) => {
      const chauffeur = await referentiel.creerChauffeur(
        { nom: corps.data.nom, telephone: corps.data.telephone, entityId: corps.data.entityId },
        principal.subject,
      );
      return reply.code(201).send(chauffeur);
    });
  });

  app.post<{ Params: { id: string } }>('/api/admin/drivers/:id/statut', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsChangementStatut.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'statut et motif attendus');

    return avecReferentiel(reply, async (referentiel) => {
      await referentiel.changerStatutChauffeur(
        req.params.id,
        corps.data.statut,
        principal.subject,
        corps.data.motif,
      );
      return reply.code(200).send({ id: req.params.id, statut: corps.data.statut });
    });
  });

  app.get('/api/admin/stations', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    return avecReferentiel(reply, async (r) => reply.send(await r.listerStations()));
  });

  app.post('/api/admin/stations', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsNouvelleStation.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'code et nom de station attendus');

    return avecReferentiel(reply, async (referentiel) => {
      const station = await referentiel.creerStation(
        { code: corps.data.code, nom: corps.data.nom, ville: corps.data.ville ?? undefined },
        principal.subject,
      );
      return reply.code(201).send(station);
    });
  });

  app.get('/api/admin/operators', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    return avecReferentiel(reply, async (r) => reply.send(await r.listerOperateurs()));
  });

  app.post('/api/admin/operators', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsNouvelOperateur.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'nom, telephone et role attendus');

    return avecReferentiel(reply, async (referentiel) => {
      const operateur = await referentiel.creerOperateur(
        {
          nom: corps.data.nom,
          telephone: corps.data.telephone,
          role: corps.data.role,
          stationId: corps.data.stationId ?? null,
        },
        principal.subject,
      );
      return reply.code(201).send(operateur);
    });
  });

  app.post<{ Params: { id: string } }>('/api/admin/operators/:id/statut', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsChangementStatut.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'statut et motif attendus');

    return avecReferentiel(reply, async (referentiel) => {
      await referentiel.changerStatutOperateur(
        req.params.id,
        corps.data.statut,
        principal.subject,
        corps.data.motif,
      );
      return reply.code(200).send({ id: req.params.id, statut: corps.data.statut });
    });
  });

  // ------------------------------------------------------------- encaissement

  // ------------------------------------------------------- reglement TotalEnergies

  /**
   * Traduit les refus du cycle en codes stables.
   *
   * Chaque cas appelle une conduite differente cote interface : 409 « quelqu'un est passe
   * avant, relisez », 403 « il faut quelqu'un d'autre », 428 « confirmez par code ». Un 500
   * generique laisserait l'administrateur cliquer a nouveau sur un bouton qui ne marchera pas.
   */
  function refusReglement(reply: FastifyReply, cause: unknown): FastifyReply | null {
    if (cause instanceof CycleBloqueError) {
      // §11. Sans cette traduction, l'administrateur recevait « erreur interne » et n'avait
      // aucun moyen de comprendre qu'il lui faut d'abord solder son rapprochement.
      return refus(reply, 409, 'RAPPROCHEMENT_A_SOLDER');
    }
    if (cause instanceof NumeroFactureDejaUtiliseError) {
      return refus(reply, 409, 'NUMERO_DEJA_UTILISE');
    }
    if (cause instanceof ConcurrenceError) {
      return refus(reply, 409, 'ETAT_MODIFIE');
    }
    if (cause instanceof SegregationOfDutiesError) {
      return refus(reply, 403, 'SEPARATION_DES_ROLES');
    }
    if (cause instanceof SecondFactorRequiredError) {
      return refus(reply, 428, 'CONFIRMATION_REQUISE');
    }
    if (cause instanceof LimitExceededError) {
      return refus(reply, 409, 'PLAFOND_DEPASSE');
    }
    if (cause instanceof FactureIntrouvableError || cause instanceof IntentionIntrouvableError) {
      return refus(reply, 404, 'INTROUVABLE');
    }
    if (cause instanceof InvalidTransitionError) {
      return refus(reply, 409, 'TRANSITION_INTERDITE');
    }
    if (cause instanceof AuthentificationRefuseeError) {
      return refus(reply, 401, 'CODE_REFUSE');
    }
    return null;
  }

  async function avecReglement<T>(
    reply: FastifyReply,
    bloc: (cycle: CycleReglement, contractId: string) => Promise<T>,
  ): Promise<T | FastifyReply> {
    if (deps.reglement === undefined || deps.contractId === undefined) {
      return erreur(reply, 503, 'cycle de reglement indisponible');
    }
    try {
      return await bloc(deps.reglement, deps.contractId);
    } catch (cause) {
      const r = refusReglement(reply, cause);
      if (r !== null) return r;
      throw cause;
    }
  }

  app.get('/api/admin/factures', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    return avecReglement(reply, async (cycle, contractId) =>
      reply.send(await cycle.listerFactures(contractId)),
    );
  });

  app.post('/api/admin/factures', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsNouvelleFacture.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'facture incomplete');
    if (corps.data.periodeDebut > corps.data.periodeFin) {
      return erreur(reply, 400, 'periode inversee');
    }
    if (corps.data.dateEcheance < corps.data.dateEmission) {
      return erreur(reply, 400, 'echeance anterieure a l emission');
    }

    return avecReglement(reply, async (cycle, contractId) => {
      const facture = await cycle.enregistrerFacture({
        id: deps.ids.next(),
        contractId,
        numero: corps.data.numero,
        periodeDebut: corps.data.periodeDebut,
        periodeFin: corps.data.periodeFin,
        montant: xof(corps.data.montantXof),
        dateEmission: corps.data.dateEmission,
        dateEcheance: corps.data.dateEcheance,
        statut: 'OUVERTE',
      });
      return reply.code(201).send(facture);
    });
  });

  app.get('/api/admin/reglements', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    return avecReglement(reply, async (cycle, contractId) =>
      reply.send(await cycle.listerIntentions(contractId)),
    );
  });

  app.post('/api/admin/reglements', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsPreparation.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'identifiant de facture attendu');

    // Le montant ne figure pas dans le corps, et n'y figurera jamais : il vient de la facture.
    // Une interface qui pourrait proposer son propre montant serait une interface qui decide
    // de ce qu'on paie.
    return avecReglement(reply, async (cycle) => {
      const intent = await cycle.preparer({
        invoiceId: corps.data.invoiceId,
        acteur: principal.subject,
      });
      return reply.code(201).send(intent);
    });
  });

  app.post<{ Params: { id: string } }>(
    '/api/admin/reglements/:id/soumettre',
    async (req, reply) => {
      const principal = await exigerRole(req, reply, ['ADMIN']);
      if (principal === null) return reply;
      return avecReglement(reply, async (cycle) =>
        reply.send(await cycle.soumettre({ intentId: req.params.id, acteur: principal.subject })),
      );
    },
  );

  app.post<{ Params: { id: string } }>('/api/admin/reglements/:id/approuver', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    // L'acteur vient du jeton, jamais du corps : sinon la separation des roles se contournerait
    // en envoyant le nom d'un collegue.
    return avecReglement(reply, async (cycle) =>
      reply.send(await cycle.approuver({ intentId: req.params.id, acteur: principal.subject })),
    );
  });

  app.post<{ Params: { id: string } }>('/api/admin/reglements/:id/annuler', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    return avecReglement(reply, async (cycle) =>
      reply.send(await cycle.annuler({ intentId: req.params.id, acteur: principal.subject })),
    );
  });

  /**
   * Envoie le code de confirmation avant execution.
   *
   * Le numero destinataire vient de la base, pas de la requete : laisser l'appelant choisir ou
   * son second facteur arrive reviendrait a ne plus en avoir.
   */
  app.post<{ Params: { id: string } }>(
    '/api/admin/reglements/:id/confirmation',
    async (req, reply) => {
      const principal = await exigerRole(req, reply, ['ADMIN']);
      if (principal === null) return reply;

      return avecReglement(reply, async () => {
        const r = await deps.auth.demanderConfirmation(principal.subject, deps.horloge());
        return reply.code(202).send(r);
      });
    },
  );

  /**
   * Execute le versement.
   *
   * Deux verrous en amont de l'appel sortant : le code frais consomme ici, et la separation des
   * roles verifiee par le domaine. Le code est consomme AVANT l'envoi — un code qui resterait
   * utilisable apres un premier virement en autoriserait un second.
   */
  app.post<{ Params: { id: string } }>('/api/admin/reglements/:id/executer', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsExecution.safeParse(req.body);
    if (!corps.success) return refus(reply, 428, 'CONFIRMATION_REQUISE');

    return avecReglement(reply, async (cycle) => {
      await deps.auth.confirmerAction(principal.subject, corps.data.code, deps.horloge());

      const intent = await cycle.executer({
        intentId: req.params.id,
        acteur: principal.subject,
        secondFactorVerifie: true,
      });
      return reply.send(intent);
    });
  });

  app.post<{ Params: { id: string } }>(
    '/api/admin/reglements/:id/rapprocher',
    async (req, reply) => {
      const principal = await exigerRole(req, reply, ['ADMIN']);
      if (principal === null) return reply;
      return avecReglement(reply, async (cycle) =>
        reply.send(await cycle.rapprocher({ intentId: req.params.id, acteur: principal.subject })),
      );
    },
  );

  /**
   * Relance la reprise des envois interrompus.
   *
   * Elle ne reemet jamais : elle interroge le fournisseur sur le sort des ordres restes en
   * suspens et enregistre ce qu'il repond. Elle est exposee parce qu'un administrateur qui voit
   * une intention bloquee doit pouvoir la faire examiner sans attendre un redemarrage.
   */
  app.post('/api/admin/reprise', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    if (deps.reprise === undefined) return erreur(reply, 503, 'reprise indisponible');

    return reply.send(await deps.reprise.executer());
  });

  /**
   * Pousse la file d'envoi des bons.
   *
   * Reessayer un envoi est sur : un bon est a usage unique et son jeton est deterministe. Deux
   * envois donnent deux fois le meme code, dont un seul servira.
   */
  app.post('/api/admin/envois', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    if (deps.envoi === undefined) return erreur(reply, 503, 'envoi indisponible');

    return reply.send(await deps.envoi.executer());
  });

  // ------------------------------------------------------- rapprochement

  function refusRapprochement(reply: FastifyReply, cause: unknown): FastifyReply | null {
    if (cause instanceof ReleveVideError) {
      // 409 et non 400 : la demande est bonne, c'est l'etat du systeme qui ne s'y prete pas.
      return refus(reply, 409, 'RELEVE_VIDE');
    }
    if (cause instanceof NoteRequiseError) return refus(reply, 400, 'NOTE_REQUISE');
    if (cause instanceof LigneIntrouvableError) return refus(reply, 409, 'DEJA_RESOLUE');
    return null;
  }

  async function avecRapprochement<T>(
    reply: FastifyReply,
    bloc: (r: RapprocherLaPeriode) => Promise<T>,
  ): Promise<T | FastifyReply> {
    if (deps.rapprochement === undefined) {
      return erreur(reply, 503, 'rapprochement indisponible');
    }
    try {
      return await bloc(deps.rapprochement);
    } catch (cause) {
      const r = refusRapprochement(reply, cause);
      if (r !== null) return r;
      throw cause;
    }
  }

  app.get<{ Params: { periode: string } }>(
    '/api/admin/rapprochements/:periode',
    async (req, reply) => {
      const principal = await exigerRole(req, reply, ['ADMIN']);
      if (principal === null) return reply;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.periode)) {
        return erreur(reply, 400, 'periode attendue au format AAAA-MM-JJ');
      }
      return avecRapprochement(reply, async (r) =>
        reply.send({
          lignes: await r.lignes(req.params.periode),
          cycleBloque: await r.cycleBloque(),
        }),
      );
    },
  );

  app.post('/api/admin/rapprochements', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsRapprochement.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'periode attendue au format AAAA-MM-JJ');

    return avecRapprochement(reply, async (r) =>
      reply.send(
        await r.executer({
          periode: corps.data.periode,
          toleranceXof: xof(corps.data.toleranceXof),
          acteur: principal.subject,
        }),
      ),
    );
  });

  app.post<{ Params: { id: string } }>(
    '/api/admin/rapprochements/lignes/:id/resoudre',
    async (req, reply) => {
      const principal = await exigerRole(req, reply, ['ADMIN']);
      if (principal === null) return reply;

      const corps = CorpsResolution.safeParse(req.body);
      if (!corps.success) return refus(reply, 400, 'NOTE_REQUISE');

      return avecRapprochement(reply, async (r) => {
        await r.resoudre({
          id: req.params.id,
          acteur: principal.subject,
          note: corps.data.note,
        });
        return reply.send({ resolu: true });
      });
    },
  );

  /**
   * Saisie du releve du portefeuille.
   *
   * Aucun endpoint Wave documente ne rend le releve — `fetchStatement` leve, et c'est voulu :
   * deviner une URL ferait rapprocher des chiffres inventes. Les lignes se saisissent donc
   * depuis le portail Wave Business, et l'index unique sur `wave_tx_id` absorbe les doubles
   * frappes, qui sont la regle dans une saisie manuelle.
   */
  app.post('/api/admin/releve', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    if (deps.releve === undefined) return erreur(reply, 503, 'releve indisponible');

    const corps = CorpsMouvement.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'mouvement incomplet');

    const pose = await deps.releve.ajouterSiNouveau({
      id: deps.ids.next(),
      waveTxId: corps.data.waveTxId,
      dateTx: corps.data.dateTx,
      sens: corps.data.sens,
      montant: xof(corps.data.montantXof),
      contrepartie: corps.data.contrepartie ?? null,
    });

    return pose
      ? reply.code(201).send({ ajoute: true })
      : refus(reply, 409, 'MOUVEMENT_DEJA_SAISI');
  });

  app.get<{ Querystring: { debut?: string; fin?: string } }>(
    '/api/admin/releve',
    async (req, reply) => {
      const principal = await exigerRole(req, reply, ['ADMIN']);
      if (principal === null) return reply;
      if (deps.releve === undefined) return erreur(reply, 503, 'releve indisponible');

      const { debut, fin } = req.query;
      if (!debut || !fin) return erreur(reply, 400, 'debut et fin attendus');

      return reply.send(await deps.releve.listerSurPeriode(debut, fin));
    },
  );

  /**
   * Journal d'audit.
   *
   * Reserve a l'ADMIN : le journal dit qui a fait quoi, et cela ne regarde ni un chauffeur ni
   * un pompiste. Il ne rend que des empreintes, jamais un payload — la table n'en conserve
   * aucun, et c'est une decision inscrite dans le schema.
   */
  app.get<{
    Querystring: {
      action?: string;
      acteur?: string;
      cible?: string;
      depuis?: string;
      jusqua?: string;
      curseur?: string;
      limite?: string;
    };
  }>('/api/admin/journal', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    if (deps.journal === undefined) return erreur(reply, 503, 'journal indisponible');

    const jour = /^\d{4}-\d{2}-\d{2}$/;
    const { depuis, jusqua, curseur } = req.query;
    if (depuis !== undefined && !jour.test(depuis)) {
      return erreur(reply, 400, 'depuis attendu au format AAAA-MM-JJ');
    }
    if (jusqua !== undefined && !jour.test(jusqua)) {
      return erreur(reply, 400, 'jusqua attendu au format AAAA-MM-JJ');
    }
    // Le curseur est un identifiant sequentiel : tout le reste est une tentative d'injection
    // ou une erreur d'appelant, et dans les deux cas on refuse plutot que de deviner.
    if (curseur !== undefined && !/^\d+$/.test(curseur)) {
      return erreur(reply, 400, 'curseur invalide');
    }

    const limite = Number(req.query.limite ?? '50');
    const page = await deps.journal.consulter(
      {
        action: req.query.action,
        acteur: req.query.acteur,
        cibleId: req.query.cible,
        depuis,
        jusqua,
      },
      curseur ?? null,
      Number.isInteger(limite) ? limite : 50,
    );

    return reply.send(page);
  });

  app.get('/api/admin/journal/actions', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['ADMIN']);
    if (principal === null) return reply;
    if (deps.journal === undefined) return erreur(reply, 503, 'journal indisponible');

    return reply.send(await deps.journal.actionsConnues());
  });

  app.post('/api/paiements/session', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['DRIVER', 'ADMIN']);
    if (principal === null) return reply;

    const corps = CorpsSession.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'montantXof entier positif attendu');

    let montant: XOF;
    try {
      montant = xof(corps.data.montantXof);
    } catch {
      return erreur(reply, 400, 'montant invalide');
    }
    if (montant < deps.montantBon.minXof || montant > deps.montantBon.maxXof) {
      return erreur(
        reply,
        400,
        `montant hors bornes : attendu entre ${deps.montantBon.minXof} et ${deps.montantBon.maxXof} XOF`,
      );
    }

    const reference = deps.ids.next();
    await deps.sessions.save({
      reference,
      driverId: principal.subject,
      montant,
      canal: deps.encaissement.canal,
      sessionId: null,
    });

    const resultat = await deps.encaissement.createSession({
      driverId: principal.subject,
      montant,
      idempotencyKey: deps.cles.next(),
      reference,
    });

    if (resultat.kind === 'REJECTED') {
      return erreur(reply, 422, 'paiement refusé par le prestataire');
    }
    if (resultat.kind === 'AMBIGUOUS') {
      // Une session peut exister sans que nous sachions y renvoyer le chauffeur. On ne prétend
      // pas que tout va bien, et on ne rejoue pas non plus.
      return erreur(reply, 502, 'session de paiement indéterminée, à vérifier avant de réessayer');
    }

    await deps.sessions.attacherSessionId(reference, resultat.sessionId);
    await deps.audit?.enregistrer({
      actor: principal.subject,
      action: 'PAYMENT_SESSION_CREATED',
      targetType: 'checkout_session',
      targetId: reference,
      payload: { montantXof: montant, canal: deps.encaissement.canal },
    });
    // Le canal est annonce au front. En DRY_RUN, `launchUrl` pointe volontairement vers un
    // domaine `.invalid`, qui ne peut par construction jamais resoudre : c'est ce qui garantit
    // qu'une URL de demonstration ne sera jamais prise pour une vraie page de paiement. Restait
    // a le DIRE — sans quoi l'interface y envoyait le chauffeur, qui tombait sur une erreur de
    // navigateur et croyait le service en panne.
    return reply.code(201).send({
      reference,
      urlPaiement: resultat.launchUrl,
      montantXof: montant,
      canal: deps.encaissement.canal,
    });
  });

  // ------------------------------------------------------------- webhook

  app.post('/webhooks/wave', async (req, reply) => {
    let verifie;
    try {
      verifie = deps.webhook.verify({
        rawBody: req.rawBody ?? '',
        headers: req.headers as Record<string, string>,
        asOf: deps.horloge(),
      });
    } catch (cause) {
      if (cause instanceof EndpointContractUnknownError) {
        return erreur(reply, 503, 'réception de webhooks non configurée');
      }
      if (cause instanceof WebhookError) {
        req.log.warn({ err: cause.name }, 'webhook rejeté');
        return erreur(reply, 400, 'webhook rejeté');
      }
      throw cause;
    }

    let paiement;
    try {
      paiement = deps.mappeur.lire(verifie.eventType, verifie.payload);
    } catch (cause) {
      if (cause instanceof EndpointContractUnknownError) {
        return erreur(reply, 503, 'lecture des événements non configurée');
      }
      throw cause;
    }

    // Événement d'un autre type : accusé de réception, sans traitement. Sans cela, Wave
    // rejouerait indéfiniment un événement qui ne nous concerne pas.
    if (paiement === null) return reply.code(202).send({ traite: false, motif: 'type ignoré' });

    const session = await deps.sessions.findByReference(paiement.reference);
    if (session === null) {
      return reply.code(202).send({ traite: false, motif: 'référence inconnue' });
    }

    if (paiement.montantPaye !== session.montant) {
      // Le montant reçu diffère de celui demandé. Aucun bon n'est émis : la divergence est
      // traitée par un humain, pas absorbée par un arrondi ou une confiance mal placée.
      req.log.error(
        { reference: paiement.reference, attendu: session.montant, recu: paiement.montantPaye },
        'montant de paiement divergent',
      );
      return erreur(reply, 422, 'montant reçu différent du montant demandé');
    }

    let emis = false;
    const traite = await deps.dedup.once(
      verifie.eventId,
      async () => {
        const r = await deps.emission.execute({
          canal: session.canal,
          reference: session.reference,
          driverId: session.driverId,
          montant: session.montant,
          recuA: verifie.emisA,
        });
        emis = !r.deja;
      },
      { eventType: verifie.eventType, payloadHash: verifie.payloadHash },
    );

    return reply.code(200).send({ traite, emis });
  });

  // ------------------------------------------------------------- station

  app.post('/api/station/consommation', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['STATION_OPERATOR']);
    if (principal === null) return reply;

    // La station vient du jeton. Un pompiste ne sert pas au nom d'une autre station.
    if (principal.stationId === null) {
      return erreur(reply, 403, 'opérateur sans station de rattachement');
    }

    const corps = CorpsConsommation.safeParse(req.body);
    if (!corps.success) return erreur(reply, 400, 'token et redemptionId attendus');

    try {
      const r = await deps.consommation.execute({
        token: corps.data.token,
        stationId: principal.stationId,
        operateurId: principal.subject,
        redemptionId: corps.data.redemptionId,
        asOf: deps.horloge(),
      });
      await deps.audit?.enregistrer({
        actor: principal.subject,
        action: r.servi ? 'VOUCHER_REDEEMED' : 'VOUCHER_REDEEM_REPLAYED',
        targetType: 'fuel_voucher',
        targetId: r.voucherId,
        payload: { stationId: principal.stationId, redemptionId: corps.data.redemptionId },
      });
      return reply.code(200).send({
        servir: true,
        montantXof: r.montant,
        bon: r.voucherId,
        dejaServi: !r.servi,
      });
    } catch (cause) {
      if (cause instanceof SignatureError) {
        return refus(reply, 400, 'QR_ILLISIBLE');
      }
      if (cause instanceof VoucherIntrouvableError) {
        return refus(reply, 404, 'BON_INCONNU');
      }
      if (cause instanceof AlreadyRedeemedError) {
        return refus(reply, 409, 'DEJA_SERVI', {
          consommeA: cause.consommeA,
          memeStation: cause.stationId === principal.stationId,
        });
      }
      if (cause instanceof VoucherExpiredError) {
        return refus(reply, 410, 'BON_EXPIRE');
      }
      if (cause instanceof VoucherCancelledError) {
        return refus(reply, 409, 'BON_ANNULE');
      }
      if (cause instanceof MontantIncoherentError) {
        // Le QR est signé mais ment sur le montant : incident de sécurité, pas erreur de saisie.
        req.log.error({ err: cause.message }, 'montant du QR divergent de la base');
        return refus(reply, 409, 'BON_NON_CONFORME');
      }
      throw cause;
    }
  });

  // ------------------------------------------------------------- consultation

  app.get('/api/bons', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['DRIVER']);
    if (principal === null) return reply;

    const bons = await deps.bons.listerParChauffeur(principal.subject, 20);
    const maintenant = deps.horloge();

    return reply.send(
      bons.map((b) => ({
        id: b.id,
        montantXof: b.montant,
        statut: b.statut,
        emisA: b.emisA,
        expireA: b.expireA,
        consommeA: b.consommeA,
        // Le jeton n'accompagne que les bons encore utilisables : inutile de faire circuler
        // de quoi afficher un QR qui ne servira plus.
        jeton:
          b.statut === 'EMIS' && b.expireA > maintenant
            ? deps.signer.sign({ id: b.id, montant: b.montant, expireA: b.expireA })
            : null,
      })),
    );
  });

  app.get<{ Params: { id: string } }>('/api/bons/:id', async (req, reply) => {
    const principal = await exigerRole(req, reply, ['DRIVER', 'ADMIN', 'STATION_OPERATOR']);
    if (principal === null) return reply;

    const bon = await deps.bons.findById(req.params.id);
    if (bon === null) return erreur(reply, 404, 'bon inconnu');

    // Un chauffeur ne consulte que ses propres bons.
    if (principal.role === 'DRIVER' && bon.driverId !== principal.subject) {
      return erreur(reply, 404, 'bon inconnu');
    }

    return reply.code(200).send({
      id: bon.id,
      montantXof: bon.montant,
      statut: bon.statut,
      emisA: bon.emisA,
      expireA: bon.expireA,
      consommeA: bon.consommeA,
    });
  });

  app.setErrorHandler((cause, req, reply) => {
    // `logger: false` rend `req.log` muet : sans cette ligne, une erreur non rattrapee ne
    // laisse aucune trace et le 500 se debogue a l'aveugle. On ecrit la route et le message,
    // jamais le corps de la requete ni la pile — l'un porte des donnees personnelles, l'autre
    // des chemins de fichiers.
    console.error(
      JSON.stringify({
        erreur: 'non rattrapee',
        methode: req.method,
        route: req.routeOptions?.url ?? req.url,
        cause: cause instanceof Error ? `${cause.name} : ${cause.message}` : String(cause),
      }),
    );
    // Le détail reste au serveur : un message d'erreur est une surface d'information.
    erreur(reply, 500, 'erreur interne');
  });

  return app;
}
