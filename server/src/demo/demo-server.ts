/**
 * ================== HARNAIS DE DÉMONSTRATION — PAS UN SERVEUR DE PRODUCTION ==================
 *
 * Ce fichier n'est jamais importé par `main.ts`. Il existe pour rendre le flux manipulable sans
 * base de données ni compte Wave.
 *
 * Ce qui est RÉEL ici — c'est tout l'intérêt :
 *   - les routes sont celles de `buildServer`, sans aucune variante ;
 *   - la machine à états du bon, la signature du QR, la vérification de webhook et les
 *     contrôles d'accès sont le code de production, à l'identique.
 *
 * Ce qui est SIMULÉ, et clairement délimité :
 *   - le stockage, en mémoire : tout disparaît à l'arrêt ;
 *   - le prestataire d'encaissement : la route `/demo/simuler-paiement` fabrique et signe
 *     l'événement que Wave enverrait. Elle n'existe que dans ce fichier.
 *
 * Les jetons d'API sont écrits en clair ci-dessous. C'est acceptable **uniquement** parce que
 * rien ici ne touche à de l'argent réel et que le serveur n'écoute que sur la boucle locale.
 * =============================================================================================
 */

import { createHmac, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { xof } from '../domain/money.ts';
import type { FuelVoucher, VoucherStatut } from '../domain/fuel-voucher.ts';
import { EmitVoucherOnPayment } from '../application/emit-voucher-on-payment.ts';
import { RedeemVoucherAtStation } from '../application/redeem-voucher-at-station.ts';
import { Secret } from '../infra/secrets/secrets.ts';
import { VoucherSigner } from '../infra/security/voucher-signature.ts';
import {
  InMemoryProcessedEventStore,
  WebhookDeduplicator,
  WebhookVerifier,
} from '../infra/webhooks/webhook.ts';
import { DryRunCollectionChannel } from '../infra/wave/dry-run-collection-channel.ts';
import type { AccessTokenVerifier, Principal } from '../infra/auth/api-tokens.ts';
import { CheckoutCompletedMapper } from '../http/checkout-mapper.ts';
import { AuthenticateByPhone } from '../application/authenticate-by-phone.ts';
import type {
  AnnuaireComptes,
  ApiTokenIssuer,
  OtpChallengeRepository,
  OtpSender,
} from '../ports/authentication.ts';
import type { OtpChallenge } from '../domain/otp.ts';
import { buildServer } from '../http/server.ts';
import { ManageDirectory } from '../application/admin/manage-directory.ts';
import { TableauDeBord } from '../application/admin/tableau-de-bord.ts';
import { InMemoryAuditLogger } from '../infra/audit/audit-logger.ts';
import type {
  ContratRepository,
  ContratTe,
  DirectoryRepository,
  FicheChauffeur,
  FicheEntite,
  FicheOperateur,
  FicheStation,
  PilotageRepository,
  StatutFiche,
} from '../ports/admin.ts';
import type {
  CheckoutSession,
  CheckoutSessionRepository,
  DeliveryRequest,
  Driver,
  DriverPayment,
  DriverPaymentRepository,
  DriverRepository,
  VoucherDeliveryQueue,
  VoucherRepository,
} from '../ports/repositories.ts';
import { pageDemo } from './demo-page.ts';

const PORT = Number(process.env.DEMO_PORT ?? 3001);
const ENTETE_SIGNATURE = 'wave-signature';

const CLE_QR = new Secret('demonstration-locale-uniquement-'.padEnd(64, 'x'), 'QR_SIGNATURE_SECRET');
const CLE_WEBHOOK = new Secret('demonstration-webhook-locale-'.padEnd(48, 'y'), 'WAVE_WEBHOOK_SECRET');

const JETON_CHAUFFEUR = 'demo-jeton-chauffeur';
const JETON_POMPISTE = 'demo-jeton-pompiste';

const CHAUFFEUR: Driver = {
  id: 'chauffeur-demo',
  nom: 'Moussa Ndiaye',
  msisdn: '+221770000001',
  statut: 'ACTIF',
};

// ------------------------------------------------------- stockage en mémoire

class Paiements implements DriverPaymentRepository {
  readonly lignes = new Map<string, DriverPayment>();
  async findByReference(c: string, r: string) {
    return this.lignes.get(`${c}|${r}`) ?? null;
  }
  async saveIfNew(p: DriverPayment) {
    const k = `${p.canal}|${p.reference}`;
    if (this.lignes.has(k)) return false;
    this.lignes.set(k, p);
    return true;
  }
}

class Bons implements VoucherRepository {
  readonly lignes = new Map<string, FuelVoucher>();
  readonly parPaiement = new Map<string, string>();
  async findById(id: string) {
    return this.lignes.get(id) ?? null;
  }
  async findByPaymentId(p: string) {
    const id = this.parPaiement.get(p);
    return id ? (this.lignes.get(id) ?? null) : null;
  }
  async saveIfNew(bon: FuelVoucher, paymentId: string) {
    if (this.parPaiement.has(paymentId)) return false;
    this.parPaiement.set(paymentId, bon.id);
    this.lignes.set(bon.id, bon);
    return true;
  }
  async saveIfStatut(bon: FuelVoucher, attendu: VoucherStatut) {
    const actuel = this.lignes.get(bon.id);
    if (!actuel || actuel.statut !== attendu) return false;
    this.lignes.set(bon.id, bon);
    return true;
  }
  async listerParChauffeur(driverId: string, limite: number) {
    return [...this.lignes.values()]
      .filter((b) => b.driverId === driverId)
      .sort((a, b) => b.emisA.localeCompare(a.emisA))
      .slice(0, limite);
  }
}

class Sessions implements CheckoutSessionRepository {
  readonly lignes = new Map<string, CheckoutSession>();
  async findByReference(r: string) {
    return this.lignes.get(r) ?? null;
  }
  async save(s: CheckoutSession) {
    this.lignes.set(s.reference, s);
  }
  async attacherSessionId(r: string, sessionId: string) {
    const s = this.lignes.get(r);
    if (s) this.lignes.set(r, { ...s, sessionId });
  }
}

class Chauffeurs implements DriverRepository {
  async findById(id: string) {
    return id === CHAUFFEUR.id ? CHAUFFEUR : null;
  }
}

class FileEnvois implements VoucherDeliveryQueue {
  readonly envois: DeliveryRequest[] = [];
  async enqueue(d: DeliveryRequest) {
    this.envois.push(d);
    return `envoi-${this.envois.length}`;
  }
}

class Jetons implements AccessTokenVerifier {
  private readonly table: Record<string, Principal> = {
    [JETON_CHAUFFEUR]: { subject: CHAUFFEUR.id, role: 'DRIVER', stationId: null },
    [JETON_POMPISTE]: {
      subject: 'pompiste-demo',
      role: 'STATION_OPERATOR',
      stationId: 'station-demo',
    },
  };
  async verify(token: string) {
    return this.table[token] ?? jetonsEmis.get(token) ?? null;
  }
}

class ChallengesDemo implements OtpChallengeRepository {
  readonly tous: OtpChallenge[] = [];
  async trouverVivant(msisdn: string) {
    return this.tous.find((c) => c.msisdn === msisdn && !c.consomme) ?? null;
  }
  async remplacer(c: OtpChallenge) {
    this.tous.forEach((x, i) => {
      if (x.msisdn === c.msisdn && !x.consomme) this.tous[i] = { ...x, consomme: true };
    });
    this.tous.push(c);
  }
  async majTentative(c: OtpChallenge) {
    const i = this.tous.findIndex((x) => x.id === c.id);
    if (i >= 0) this.tous[i] = c;
  }
  async compterDepuis(msisdn: string, depuis: string) {
    return this.tous.filter((c) => c.msisdn === msisdn && c.emisA >= depuis).length;
  }
}

const jetonsEmis = new Map<string, Principal>();

const annuaireDemo: AnnuaireComptes = {
  async resoudre(msisdn) {
    if (msisdn === CHAUFFEUR.msisdn) {
      return { subject: CHAUFFEUR.id, role: 'DRIVER', stationId: null };
    }
    if (msisdn === '+221770000002') {
      return { subject: 'pompiste-demo', role: 'STATION_OPERATOR', stationId: 'station-demo' };
    }
    if (msisdn === '+221770000003') {
      return { subject: 'admin-demo', role: 'ADMIN', stationId: null };
    }
    return null;
  },
};

const emetteurDemo: ApiTokenIssuer = {
  async emettre(input) {
    const jeton = `session-${randomUUID()}`;
    jetonsEmis.set(jeton, {
      subject: input.subject,
      role: input.role,
      stationId: input.stationId,
    });
    return jeton;
  },
};

/** L'envoi passe par le journal du serveur : la page de demonstration affiche le code. */
class SenderDemo implements OtpSender {
  dernier: { msisdn: string; code: string } | null = null;
  async envoyer(msisdn: string, code: string) {
    this.dernier = { msisdn, code };
    return true;
  }
}

const senderDemo = new SenderDemo();
const challengesDemo = new ChallengesDemo();

// --------------------------------------------------- referentiel et pilotage

const ENTITE_DEMO = randomUUID();
const STATION_DEMO = 'station-demo';

class AnnuaireDemo implements DirectoryRepository {
  readonly entites: FicheEntite[] = [];
  readonly chauffeurs: FicheChauffeur[] = [
    { id: CHAUFFEUR.id, nom: CHAUFFEUR.nom, msisdn: CHAUFFEUR.msisdn, statut: 'ACTIF' },
  ];
  readonly stations: FicheStation[] = [
    { id: STATION_DEMO, code: 'DKR-03', nom: 'Dakar 3', ville: 'Dakar', statut: 'ACTIVE' },
  ];
  readonly operateurs: FicheOperateur[] = [
    {
      id: 'pompiste-demo',
      nom: 'Fatou Sow',
      msisdn: '+221770000002',
      role: 'STATION_OPERATOR',
      stationId: STATION_DEMO,
      statut: 'ACTIF',
    },
    {
      id: 'admin-demo',
      nom: 'Awa Fall',
      msisdn: '+221770000003',
      role: 'ADMIN',
      stationId: null,
      statut: 'ACTIF',
    },
  ];

  async listerChauffeurs() {
    return this.chauffeurs;
  }
  async listerStations() {
    return this.stations;
  }
  async listerOperateurs() {
    return this.operateurs;
  }
  async numeroLibre(msisdn: string) {
    return (
      !this.chauffeurs.some((c) => c.msisdn === msisdn) &&
      !this.operateurs.some((o) => o.msisdn === msisdn)
    );
  }
  async trouverStation(id: string) {
    return this.stations.find((st) => st.id === id) ?? null;
  }
  async creerEntite(f: FicheEntite) {
    this.entites.push(f);
  }
  async creerChauffeur(f: FicheChauffeur) {
    this.chauffeurs.push(f);
  }
  async creerStation(f: FicheStation) {
    this.stations.push(f);
  }
  async creerOperateur(f: FicheOperateur) {
    this.operateurs.push(f);
  }
  async changerStatutChauffeur(id: string, statut: StatutFiche) {
    const i = this.chauffeurs.findIndex((c) => c.id === id);
    if (i < 0) return false;
    this.chauffeurs[i] = { ...this.chauffeurs[i], statut };
    return true;
  }
  async changerStatutOperateur(id: string, statut: StatutFiche) {
    const i = this.operateurs.findIndex((o) => o.id === id);
    if (i < 0) return false;
    this.operateurs[i] = { ...this.operateurs[i], statut };
    return true;
  }
}

const CONTRAT_DEMO: ContratTe = {
  id: 'contrat-demo',
  numeroCompte: 'TE-4471',
  encoursAutorise: xof(10_000_000),
  delaiReglementJours: 30,
  seuilAlertePct: 70,
  seuilBlocagePct: 90,
  canalReglement: 'DRY_RUN',
};

const contratsDemo: ContratRepository = {
  async courant() {
    return CONTRAT_DEMO;
  },
};

/** Les chiffres viennent des bons reellement emis et consommes en memoire. */
const pilotageDemo: PilotageRepository = {
  async consommationNonFacturee() {
    return sommeBons((b) => b.statut === 'CONSOMME');
  },
  async consommationSurFenetre(_contractId, depuis) {
    return sommeBons((b) => b.statut === 'CONSOMME' && (b.consommeA ?? '') >= depuis);
  },
  async bonsEnCirculation() {
    return sommeBons((b) => b.statut === 'EMIS' && b.expireA > new Date().toISOString());
  },
  async facturesEchuesImpayees() {
    return xof(0);
  },
  async activiteDuJour(depuis) {
    const tous = [...bons.lignes.values()];
    const emis = tous.filter((b) => b.emisA >= depuis);
    const consommes = tous.filter((b) => (b.consommeA ?? '') >= depuis);
    return {
      bonsEmis: emis.length,
      montantEmis: xof(emis.reduce((t, b) => t + b.montant, 0)),
      bonsConsommes: consommes.length,
      montantConsomme: xof(consommes.reduce((t, b) => t + b.montant, 0)),
    };
  },
  async incidents() {
    const echecs = file.envois.length === 0 ? 0 : 0;
    return echecs === 0
      ? []
      : [
          {
            type: 'ENVOI_QR_ECHOUE',
            gravite: 'ATTENTION' as const,
            nombre: echecs,
            libelle: 'QR non parvenus au chauffeur',
          },
        ];
  },
};

function sommeBons(filtre: (b: FuelVoucher) => boolean) {
  return xof([...bons.lignes.values()].filter(filtre).reduce((t, b) => t + b.montant, 0));
}

const auditDemo = new InMemoryAuditLogger();
const referentielDemo = new AnnuaireDemo();

// ------------------------------------------------------------------ montage

const bons = new Bons();
const sessions = new Sessions();
const file = new FileEnvois();
const signer = new VoucherSigner(CLE_QR);
const uuid = { next: () => randomUUID() };

const app = buildServer({
  encaissement: new DryRunCollectionChannel(async () => {
    throw new Error('aucun appel réseau en démonstration');
  }),
  sessions,
  emission: new EmitVoucherOnPayment({
    paiements: new Paiements(),
    bons,
    chauffeurs: new Chauffeurs(),
    file,
    signer,
    idsPaiement: uuid,
    idsBon: uuid,
    validiteHeures: 24,
  }),
  consommation: new RedeemVoucherAtStation({ bons, signer }),
  bons,
  jetons: new Jetons(),
  webhook: new WebhookVerifier(CLE_WEBHOOK, {
    signatureHeader: ENTETE_SIGNATURE,
    toleranceSecondes: 300,
  }),
  dedup: new WebhookDeduplicator(new InMemoryProcessedEventStore()),
  mappeur: new CheckoutCompletedMapper({
    eventType: 'checkout.session.completed',
    referencePath: 'data.client_reference',
    montantPath: 'data.amount',
  }),
  ids: uuid,
  cles: uuid,
  horloge: () => new Date().toISOString(),
  montantBon: { minXof: xof(1_000), maxXof: xof(200_000) },
  signer,
  originesAutorisees: ['http://localhost:5174', 'http://127.0.0.1:5174'],
  audit: auditDemo,
  referentiel: new ManageDirectory({
    annuaire: referentielDemo,
    audit: auditDemo,
    ids: uuid,
    entityId: ENTITE_DEMO,
  }),
  tableauDeBord: new TableauDeBord({
    contrats: contratsDemo,
    pilotage: pilotageDemo,
    horloge: () => new Date().toISOString(),
    entityId: ENTITE_DEMO,
    fenetreJours: 30,
  }),
  auth: new AuthenticateByPhone({
    challenges: challengesDemo,
    sender: senderDemo,
    annuaire: annuaireDemo,
    jetons: emetteurDemo,
    ids: uuid,
    otp: { dureeSecondes: 300, maxTentatives: 5, maxDemandesParHeure: 20, echoCode: true },
    sessionDureeHeures: 12,
  }),
});

// ------------------------------------------------- routes de démonstration
// Aucune de ces routes n'existe dans `buildServer`.

app.get('/demo', async (_req, reply) => reply.type('text/html; charset=utf-8').send(pageDemo()));

app.get('/demo/config', async () => ({
  jetonChauffeur: JETON_CHAUFFEUR,
  jetonPompiste: JETON_POMPISTE,
  chauffeur: CHAUFFEUR,
}));

/**
 * Fabrique et signe l'événement que le prestataire d'encaissement enverrait, puis le poste sur
 * la vraie route de webhook. C'est le seul raccourci de cette démonstration.
 */
app.post<{ Body: { reference: string; montantXof: number } }>(
  '/demo/simuler-paiement',
  async (req, reply) => {
    const corps = JSON.stringify({
      id: `evt-${randomUUID()}`,
      type: 'checkout.session.completed',
      data: {
        client_reference: req.body.reference,
        amount: String(req.body.montantXof),
      },
    });
    const unix = Math.floor(Date.now() / 1000);
    const mac = createHmac('sha256', CLE_WEBHOOK.expose()).update(`${unix}.${corps}`).digest('hex');

    const reponse = await app.inject({
      method: 'POST',
      url: '/webhooks/wave',
      headers: {
        [ENTETE_SIGNATURE]: `t=${unix},v1=${mac}`,
        'content-type': 'application/json',
      },
      payload: corps,
    });

    return reply.code(reponse.statusCode).send(reponse.json());
  },
);

/** Le QR tel qu'il partirait sur WhatsApp, pour le dernier bon émis. */
app.get('/demo/dernier-qr', async (_req, reply) => {
  const dernier = file.envois.at(-1);
  if (!dernier) return reply.code(404).send({ erreur: 'aucun bon émis' });

  const bon = await bons.findById(dernier.voucherId);
  if (!bon) return reply.code(404).send({ erreur: 'bon introuvable' });

  const jeton = signer.sign({ id: bon.id, montant: bon.montant, expireA: bon.expireA });
  const image = await QRCode.toDataURL(jeton, { margin: 1, width: 320 });

  return reply.send({
    jeton,
    image,
    destinataire: dernier.destinataire,
    montantXof: bon.montant,
    expireA: bon.expireA,
    statut: bon.statut,
  });
});

/** Vue d'ensemble : ce que contient la mémoire à l'instant t. */
app.get('/demo/etat', async () => ({
  bons: [...bons.lignes.values()].map((b) => ({
    id: b.id,
    montantXof: b.montant,
    statut: b.statut,
    consommeA: b.consommeA,
    stationId: b.stationId,
    operateurId: b.operateurId,
  })),
  envoisWhatsApp: file.envois.length,
}));

await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`démonstration : http://localhost:${PORT}/demo`);
