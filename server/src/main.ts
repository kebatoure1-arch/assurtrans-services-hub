/**
 * Point d'entrée — câblage.
 *
 * Seul fichier où les implémentations concrètes rencontrent les cas d'usage. Tout ce qui précède
 * ne connaît que des ports, ce qui rend le domaine testable sans base ni réseau.
 *
 * Le démarrage échoue bruyamment si la configuration est incomplète. C'est voulu : mieux vaut un
 * serveur qui refuse de démarrer qu'un serveur qui découvre au premier paiement qu'il lui manque
 * une clé.
 */

import { randomUUID } from 'node:crypto';
import { AuthenticateByPhone } from './application/authenticate-by-phone.ts';
import { EmitVoucherOnPayment } from './application/emit-voucher-on-payment.ts';
import { RedeemVoucherAtStation } from './application/redeem-voucher-at-station.ts';
import { loadConfig } from './config.ts';
import { PgAccessTokenVerifier } from './infra/auth/api-tokens.ts';
import {
  PgAnnuaireComptes,
  PgApiTokenIssuer,
  PgOtpChallengeRepository,
} from './infra/db/pg-auth.ts';
import { AfricasTalkingOtpSender, LogOtpSender } from './infra/auth/otp-senders.ts';
import { PgDatabase } from './infra/db/pg-pool.ts';
import {
  PgCheckoutSessionRepository,
  PgDriverPaymentRepository,
  PgDriverRepository,
  PgProcessedEventStore,
  PgVoucherDeliveryQueue,
  PgVoucherRepository,
} from './infra/db/pg-repositories.ts';
import {
  PgContratRepository,
  PgDirectoryRepository,
  PgPilotageRepository,
} from './infra/db/pg-admin.ts';
import { ManageDirectory } from './application/admin/manage-directory.ts';
import { TableauDeBord } from './application/admin/tableau-de-bord.ts';
import { PgAuditLogger } from './infra/audit/audit-logger.ts';
import { CachingSecretProvider, EnvSecretProvider } from './infra/secrets/secrets.ts';
import { VoucherSigner } from './infra/security/voucher-signature.ts';
import { WebhookDeduplicator, WebhookVerifier } from './infra/webhooks/webhook.ts';
import { resolveCollectionChannel } from './infra/wave/resolve-collection.ts';
import { CheckoutCompletedMapper } from './http/checkout-mapper.ts';
import { buildServer } from './http/server.ts';

const uuid = { next: () => randomUUID() };

async function main(): Promise<void> {
  const secrets = new CachingSecretProvider(new EnvSecretProvider());
  const config = await loadConfig(secrets);

  const db = new PgDatabase(await secrets.get('DATABASE_URL'));

  const bons = new PgVoucherRepository(db);
  const sessions = new PgCheckoutSessionRepository(db);

  // Clé de signature des QR : l'active, plus les héritées le temps d'une rotation.
  // Les bons vivent le temps de `validiteBonHeures` ; retirer une clé plus tôt les invaliderait.
  const clesHeritees = process.env.QR_SIGNATURE_SECRET_PRECEDENT
    ? [await secrets.get('QR_SIGNATURE_SECRET_PRECEDENT')]
    : [];
  const signer = new VoucherSigner(await secrets.get('QR_SIGNATURE_SECRET'), clesHeritees);

  const transport = async (req: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
  }) => {
    const reponse = await fetch(`${config.wave.baseUrl}${req.path}`, {
      method: req.method,
      headers: req.headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
    const texte = await reponse.text();
    let corps: unknown = {};
    if (texte.length > 0) {
      try {
        corps = JSON.parse(texte);
      } catch {
        corps = { message: 'réponse non analysable' };
      }
    }
    return { status: reponse.status, body: corps };
  };

  const app = buildServer({
    encaissement: resolveCollectionChannel(
      { canal: config.canalEncaissement },
      config.wave,
      transport,
    ),
    sessions,
    emission: new EmitVoucherOnPayment({
      paiements: new PgDriverPaymentRepository(db),
      bons,
      chauffeurs: new PgDriverRepository(db),
      file: new PgVoucherDeliveryQueue(db),
      signer,
      idsPaiement: uuid,
      idsBon: uuid,
      validiteHeures: config.validiteBonHeures,
    }),
    consommation: new RedeemVoucherAtStation({ bons, signer }),
    bons,
    jetons: new PgAccessTokenVerifier(db),
    webhook: new WebhookVerifier(await secrets.get('WAVE_WEBHOOK_SECRET'), config.webhook),
    dedup: new WebhookDeduplicator(new PgProcessedEventStore(db)),
    mappeur: new CheckoutCompletedMapper(config.checkout),
    ids: uuid,
    cles: uuid,
    horloge: () => new Date().toISOString(),
    montantBon: config.montantBon,
    signer,
    originesAutorisees: config.originesAutorisees,
    auth: new AuthenticateByPhone({
      challenges: new PgOtpChallengeRepository(db),
      sender:
        config.sms.provider === 'AFRICAS_TALKING'
          ? new AfricasTalkingOtpSender({
              apiKey: config.sms.apiKey!,
              username: config.sms.username!,
              baseUrl: config.sms.baseUrl,
              senderId: config.sms.senderId,
            })
          : new LogOtpSender(),
      annuaire: new PgAnnuaireComptes(db),
      jetons: new PgApiTokenIssuer(db),
      ids: uuid,
      otp: config.otp,
      sessionDureeHeures: config.sessionDureeHeures,
    }),
    audit: new PgAuditLogger(db),
    referentiel: new ManageDirectory({
      annuaire: new PgDirectoryRepository(db),
      audit: new PgAuditLogger(db),
      ids: uuid,
      entityId: config.entityId,
    }),
    tableauDeBord: new TableauDeBord({
      contrats: new PgContratRepository(db),
      pilotage: new PgPilotageRepository(db),
      horloge: () => new Date().toISOString(),
      entityId: config.entityId,
      fenetreJours: config.fenetreConsommationJours,
    }),
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });

  // Journal de démarrage : ce qui est actif, sans aucune valeur sensible.
  console.log(
    JSON.stringify({
      port: config.port,
      canalReglement: config.canalParDefaut,
      canalEncaissement: config.canalEncaissement,
      webhooksArmes: config.webhook.signatureHeader !== '',
      envoiCodeParSms: config.sms.provider === 'AFRICAS_TALKING',
      passerelleSms: config.sms.provider,
      echoCodeActif: config.otp.echoCode,
      originesAutorisees: config.originesAutorisees,
      lectureEvenementsArmee: config.checkout.eventType !== '',
    }),
  );

  const arreter = async (): Promise<void> => {
    await app.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', arreter);
  process.on('SIGINT', arreter);
}

main().catch((cause) => {
  // Le message peut nommer une variable manquante ; il ne contient jamais de valeur de secret,
  // `Secret` s'en assure.
  console.error(cause instanceof Error ? `${cause.name} : ${cause.message}` : String(cause));
  process.exit(1);
});
