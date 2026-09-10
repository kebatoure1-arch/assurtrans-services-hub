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
import { hostname } from 'node:os';
import { PgAuditLogger } from './infra/audit/audit-logger.ts';
import { EnvoyerLesBons } from './application/envoyer-les-bons.ts';
import { CycleReglement } from './application/settlement/cycle-reglement.ts';
import { ReprendreEnvoisInterrompus } from './application/settlement/reprise.ts';
import { PgVerrouTravaux } from './infra/db/pg-verrou.ts';
import { ExpediteurJournal, ExpediteurSms } from './infra/envoi/expediteurs.ts';
import {
  PgInvoiceRepository,
  PgPaymentIntentRepository,
} from './infra/db/pg-settlement.ts';
import { resolveSettlementChannel } from './infra/wave/resolve-channel.ts';
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

  // La passerelle sert deux usages : les codes d'authentification, et l'acheminement des bons
  // tant que WhatsApp Business n'est pas ouvert. Une seule instance, une seule configuration.
  const passerelleSms =
    config.sms.provider === 'AFRICAS_TALKING'
      ? new AfricasTalkingOtpSender({
          apiKey: config.sms.apiKey!,
          username: config.sms.username!,
          baseUrl: config.sms.baseUrl,
          senderId: config.sms.senderId,
        })
      : new LogOtpSender();

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

  // Le contrat porte le canal de reglement et le beneficiaire. On le lit AVANT de construire
  // le serveur : sans contrat, le cycle de reglement n'existe pas et ses routes repondent 503,
  // plutot que d'accepter une intention qui n'aurait nulle part ou aller.
  const contrat = await new PgContratRepository(db).courant(config.entityId);
  const canalReglement = resolveSettlementChannel(
    {
      canal: contrat?.canalReglement ?? config.canalParDefaut,
      teB2bId: contrat?.teB2bId ?? null,
      teMsisdn: contrat?.teMsisdn ?? null,
    },
    config.wave,
    transport,
  );

  /**
   * Reprise des envois interrompus.
   *
   * Le delai avant reprise doit depasser le temps d'un appel sortant : en dessous, on volerait
   * l'intention d'un envoi encore en vol. La duree du verrou doit depasser celle d'un passage,
   * sinon deux exemplaires s'y retrouveraient ensemble.
   */
  const reprise =
    contrat === null
      ? undefined
      : new ReprendreEnvoisInterrompus({
          intentions: new PgPaymentIntentRepository(db),
          canal: canalReglement,
          verrou: new PgVerrouTravaux(db, `${process.pid}@${hostname()}`, 300),
          horloge: () => new Date().toISOString(),
          delaiAvantRepriseSecondes: 120,
          audit: new PgAuditLogger(db),
        });

  /**
   * Worker d'envoi des bons.
   *
   * Le canal vise est WhatsApp Business ; il reste bloque sur des identifiants Meta. En
   * attendant, on expedie par la passerelle SMS deja branchee pour les codes — le parcours du
   * chauffeur fonctionne de bout en bout, avec un canal de moindre confort mais reel.
   */
  const envoi = new EnvoyerLesBons({
    file: new PgVoucherDeliveryQueue(db),
    expediteur:
      config.sms.provider === 'LOG'
        ? new ExpediteurJournal(config.originesAutorisees[0] ?? 'http://localhost:5174')
        : new ExpediteurSms(
            passerelleSms,
            config.originesAutorisees[0] ?? 'http://localhost:5174',
          ),
    verrou: new PgVerrouTravaux(db, `${process.pid}@${hostname()}`, 120),
    bons,
    signer,
    horloge: () => new Date().toISOString(),
    // Trois tentatives, puis la ligne reste en incident : un numero qui ne repond pas demande
    // un humain, pas une boucle.
    maxTentatives: 3,
    audit: new PgAuditLogger(db),
  });

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
      sender: passerelleSms,
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
    contractId: contrat?.id,
    reprise,
    envoi,
    reglement:
      contrat === null
        ? undefined
        : new CycleReglement({
            factures: new PgInvoiceRepository(db),
            intentions: new PgPaymentIntentRepository(db),
            canal: canalReglement,
            limites: config.plafonds,
            // Tant que TotalEnergies n'a pas fourni le format de sa reference d'imputation
            // (§14, parametre 2), on emet une reference lisible portant notre identite et le
            // numero de facture. Le canal reste DRY_RUN d'ici la : aucune reference
            // approximative ne part chez le fournisseur.
            referenceImputation: contrat.referenceImputation ?? 'ASSURTRANS/{numero}',
            horloge: () => new Date().toISOString(),
            nouvelId: () => uuid.next(),
            nouvelleCle: () => uuid.next(),
            audit: new PgAuditLogger(db),
          }),
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });

  // Un premier passage au demarrage : c'est precisement apres un arret brutal que des
  // intentions restent en DISPATCHING, et c'est donc au redemarrage qu'il faut aller demander
  // au fournisseur ce qu'elles sont devenues. Le resultat est journalise ; un echec du passage
  // n'empeche pas le serveur de servir.
  // La file d'envoi se vide toute seule, sans attendre qu'un administrateur y pense : c'est
  // apres un redemarrage qu'elle risque d'avoir des lignes en souffrance.
  const bilanEnvoi = await envoi.executer().catch((cause) => ({
    erreur: cause instanceof Error ? cause.message : String(cause),
  }));

  const bilanReprise = await reprise?.executer().catch((cause) => ({
    erreur: cause instanceof Error ? cause.message : String(cause),
  }));

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
      reprise: bilanReprise ?? 'inactive',
      envoiDesBons: bilanEnvoi,
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
