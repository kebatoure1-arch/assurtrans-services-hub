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

const CorpsConsommation = z.object({
  token: z.string().min(1).max(4096),
  redemptionId: z.string().min(1).max(128),
});

function erreur(reply: FastifyReply, code: number, message: string): FastifyReply {
  return reply.code(code).send({ erreur: message });
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });

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

  // ------------------------------------------------------------- encaissement

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
    return reply.code(201).send({ reference, urlPaiement: resultat.launchUrl, montantXof: montant });
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
      return reply.code(200).send({
        servir: true,
        montantXof: r.montant,
        bon: r.voucherId,
        dejaServi: !r.servi,
      });
    } catch (cause) {
      if (cause instanceof SignatureError) {
        return erreur(reply, 400, 'QR illisible ou non authentique');
      }
      if (cause instanceof VoucherIntrouvableError) {
        return erreur(reply, 404, 'bon inconnu');
      }
      if (cause instanceof AlreadyRedeemedError) {
        return erreur(reply, 409, cause.message);
      }
      if (cause instanceof VoucherExpiredError) {
        return erreur(reply, 410, 'bon expiré');
      }
      if (cause instanceof VoucherCancelledError) {
        return erreur(reply, 409, 'bon annulé');
      }
      if (cause instanceof MontantIncoherentError) {
        // Le QR est signé mais ment sur le montant : incident de sécurité, pas erreur de saisie.
        req.log.error({ err: cause.message }, 'montant du QR divergent de la base');
        return erreur(reply, 409, 'bon non conforme, ne pas servir');
      }
      throw cause;
    }
  });

  // ------------------------------------------------------------- consultation

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
    req.log.error({ err: cause }, 'erreur non rattrapée');
    // Le détail reste au serveur : un message d'erreur est une surface d'information.
    erreur(reply, 500, 'erreur interne');
  });

  return app;
}
