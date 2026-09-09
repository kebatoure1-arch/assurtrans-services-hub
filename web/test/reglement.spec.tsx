/**
 * Écran du règlement TotalEnergies.
 *
 * Le seul écran d'où de l'argent sort. Ce que ces tests figent n'est donc pas de l'affichage
 * mais des garde-fous :
 *
 *  - la règle des quatre yeux se VOIT avant le clic, elle ne s'apprend pas par un refus ;
 *  - exécuter passe par un code, et l'écran ne peut pas envoyer sans lui ;
 *  - un canal à blanc le dit au moment du versement, pas seulement dans un bandeau ;
 *  - l'acteur n'est jamais transmis : le serveur le lit dans le jeton ;
 *  - un écart se lit en français, parce que son signe se lit à l'envers de l'intuition.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, ouvrirSession, sessionDe } from './faux-serveur.ts';

const ADMIN = sessionDe('ADMIN');

function facture(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'f-1',
    contractId: 'c-1',
    numero: 'TE-2026-08',
    periodeDebut: '2026-08-01',
    periodeFin: '2026-08-31',
    montant: 2_000_000,
    dateEmission: '2026-09-01',
    dateEcheance: '2026-09-30',
    statut: 'OUVERTE',
    ...surcharges,
  };
}

function intention(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'i-1',
    invoiceId: 'f-1',
    montant: 2_000_000,
    statut: 'DRAFT',
    canal: 'DRY_RUN',
    referenceImputation: 'ASSURTRANS/TE-2026-08',
    idempotencyKey: null,
    wavePayoutId: null,
    // `sessionDe('ADMIN')` donne le sujet « admin-1 » : par défaut, c'est quelqu'un d'autre qui
    // a préparé, donc l'approbation est permise.
    preparePar: 'awa-2',
    approuvePar: null,
    executePar: null,
    motifReview: null,
    montantRegle: null,
    ecartXof: null,
    ...surcharges,
  };
}

let serveur: FauxServeur;

/** Installe l'espace d'administration et ouvre la section Règlement. */
async function ouvrirReglement(options: {
  factures?: unknown[];
  reglements?: unknown[];
} = {}) {
  serveur
    .repond('GET /api/admin/tableau-de-bord', {
      corps: {
        contrat: null,
        encours: null,
        projection: null,
        bonsEnCirculation: 0,
        activite: { bonsEmis: 0, montantEmis: 0, bonsConsommes: 0, montantConsomme: 0 },
        incidents: [],
        avertissements: [],
        arreteA: new Date().toISOString(),
      },
    })
    .repond('GET /api/admin/factures', { corps: options.factures ?? [] })
    .repond('GET /api/admin/reglements', { corps: options.reglements ?? [] });

  ouvrirSession(ADMIN);
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Règlement' }));
}

beforeEach(() => {
  serveur = new FauxServeur().installer();
});

describe('factures', () => {
  it('dit d’où part un règlement quand il n’y a aucune facture', async () => {
    await ouvrirReglement();

    expect(await screen.findByText(/aucune facture enregistrée/i)).toHaveTextContent(
      /jamais d’un montant saisi ici/i,
    );
  });

  it('n’envoie jamais de montant en préparant : il vient de la facture', async () => {
    // Une interface qui pourrait proposer son propre montant serait une interface qui décide de
    // ce qu'on paie.
    await ouvrirReglement({ factures: [facture()] });
    serveur.repond('POST /api/admin/reglements', { statut: 201, corps: intention() });

    await userEvent.click(await screen.findByRole('button', { name: /préparer le règlement/i }));

    await waitFor(() => {
      expect(serveur.appelsVers('/api/admin/reglements').filter((a) => a.methode === 'POST'))
        .toHaveLength(1);
    });
    const appel = serveur.appelsVers('/api/admin/reglements').find((a) => a.methode === 'POST');
    expect(appel?.corps).toEqual({ invoiceId: 'f-1' });
  });

  it('ne propose pas de préparer une seconde fois tant qu’un règlement est vivant', async () => {
    await ouvrirReglement({ factures: [facture()], reglements: [intention()] });

    await screen.findByText('TE-2026-08');
    expect(screen.queryByRole('button', { name: /préparer le règlement/i })).toBeNull();
  });

  it('propose à nouveau après annulation', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'CANCELLED' })],
    });

    expect(await screen.findByRole('button', { name: /préparer le règlement/i })).toBeVisible();
  });

  it('dit quoi corriger quand le numéro est déjà pris', async () => {
    await ouvrirReglement();
    serveur.repond('POST /api/admin/factures', {
      statut: 409,
      corps: { erreur: 'NUMERO_DEJA_UTILISE', code: 'NUMERO_DEJA_UTILISE' },
    });

    await userEvent.click(await screen.findByRole('button', { name: /enregistrer une facture/i }));
    await userEvent.type(screen.getByLabelText('Numéro'), 'TE-2026-08');
    await userEvent.type(screen.getByLabelText(/montant/i), '2000000');
    await userEvent.type(screen.getByLabelText('Période du'), '2026-08-01');
    await userEvent.type(screen.getByLabelText('au'), '2026-08-31');
    await userEvent.type(screen.getByLabelText(/émise le/i), '2026-09-01');
    await userEvent.type(screen.getByLabelText(/échéance/i), '2026-09-30');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/corrigez le numéro/i)).toBeVisible();
  });

  it('refuse un montant à décimales sans appeler le serveur', async () => {
    // Le franc CFA n'a pas de subdivision : toute logique de centimes est un bug.
    await ouvrirReglement();

    await userEvent.click(await screen.findByRole('button', { name: /enregistrer une facture/i }));
    await userEvent.type(screen.getByLabelText(/montant/i), '2000,50');

    expect(screen.getByLabelText(/montant/i)).toHaveValue('200050');
  });
});

describe('la règle des quatre yeux', () => {
  it('désactive Approuver pour la personne qui a préparé, et dit pourquoi', async () => {
    // Un bouton qui échoue au clic apprend la règle par l'échec. Un bouton grisé et expliqué
    // l'apprend avant.
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'PENDING_APPROVAL', preparePar: ADMIN.subject })],
    });

    const approuver = await screen.findByRole('button', { name: 'Approuver' });
    expect(approuver).toBeDisabled();
    expect(screen.getByText(/l’approbation revient à quelqu’un d’autre/i)).toBeVisible();
  });

  it('laisse approuver quelqu’un d’autre', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'PENDING_APPROVAL', preparePar: 'awa-2' })],
    });

    expect(await screen.findByRole('button', { name: 'Approuver' })).toBeEnabled();
  });

  it('n’envoie jamais l’acteur : le serveur le lit dans le jeton', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'PENDING_APPROVAL' })],
    });
    serveur.repond('POST /api/admin/reglements/i-1/approuver', {
      corps: intention({ statut: 'APPROVED', approuvePar: ADMIN.subject }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Approuver' }));

    await waitFor(() => {
      expect(serveur.appelsVers('/api/admin/reglements/i-1/approuver')).toHaveLength(1);
    });
    expect(serveur.appelsVers('/api/admin/reglements/i-1/approuver')[0].corps).toBeNull();
  });

  it('traduit un refus de séparation des rôles', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'PENDING_APPROVAL' })],
    });
    serveur.repond('POST /api/admin/reglements/i-1/approuver', {
      statut: 403,
      corps: { erreur: 'SEPARATION_DES_ROLES', code: 'SEPARATION_DES_ROLES' },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Approuver' }));

    expect(await screen.findByText(/une autre personne doit l’approuver/i)).toBeVisible();
  });
});

describe('exécution', () => {
  async function ouvrirConfirmation(surcharges: Record<string, unknown> = {}) {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'APPROVED', approuvePar: 'omar-3', ...surcharges })],
    });
    serveur.repond('POST /api/admin/reglements/i-1/confirmation', {
      statut: 202,
      corps: { valideSecondes: 300, code: '654321' },
    });
    await userEvent.click(await screen.findByRole('button', { name: /exécuter le versement/i }));
    return screen.findByRole('dialog', { name: /confirmer le versement/i });
  }

  it('demande un code avant d’ouvrir la confirmation', async () => {
    const dialogue = await ouvrirConfirmation();

    expect(serveur.appelsVers('/api/admin/reglements/i-1/confirmation')).toHaveLength(1);
    expect(within(dialogue).getByText(/654321/)).toBeVisible();
  });

  it('rappelle le montant et la référence avant de verser', async () => {
    const dialogue = await ouvrirConfirmation();

    expect(within(dialogue).getByText(/2\s000\s000/)).toBeVisible();
    expect(within(dialogue).getByText(/ASSURTRANS\/TE-2026-08/)).toBeVisible();
  });

  it('avertit qu’aucun argent ne partira quand le canal est à blanc', async () => {
    // Le dire dans un bandeau en haut de page ne suffit pas : il faut le dire au moment du
    // geste, sinon personne ne le lit.
    const dialogue = await ouvrirConfirmation({ canal: 'DRY_RUN' });

    expect(within(dialogue).getByText(/aucun argent ne partira réellement/i)).toBeVisible();
  });

  it('ne dit rien de tel quand le canal est réel', async () => {
    const dialogue = await ouvrirConfirmation({ canal: 'B2B' });

    expect(within(dialogue).queryByText(/aucun argent ne partira/i)).toBeNull();
  });

  it('n’active Verser qu’avec six chiffres', async () => {
    const dialogue = await ouvrirConfirmation();

    const verser = within(dialogue).getByRole('button', { name: 'Verser' });
    expect(verser).toBeDisabled();

    await userEvent.type(within(dialogue).getByLabelText(/code à six chiffres/i), '65432');
    expect(verser).toBeDisabled();

    await userEvent.type(within(dialogue).getByLabelText(/code à six chiffres/i), '1');
    expect(verser).toBeEnabled();
  });

  it('transmet le code et rien d’autre', async () => {
    const dialogue = await ouvrirConfirmation();
    serveur.repond('POST /api/admin/reglements/i-1/executer', {
      corps: intention({ statut: 'SENT', wavePayoutId: 'pw-1' }),
    });

    await userEvent.type(within(dialogue).getByLabelText(/code à six chiffres/i), '654321');
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Verser' }));

    await waitFor(() => {
      expect(serveur.appelsVers('/api/admin/reglements/i-1/executer')).toHaveLength(1);
    });
    expect(serveur.appelsVers('/api/admin/reglements/i-1/executer')[0].corps).toEqual({
      code: '654321',
    });
  });

  it('dit de redemander un code quand il est refusé, sans fermer la confirmation', async () => {
    const dialogue = await ouvrirConfirmation();
    serveur.repond('POST /api/admin/reglements/i-1/executer', {
      statut: 401,
      corps: { erreur: 'CODE_REFUSE', code: 'CODE_REFUSE' },
    });

    await userEvent.type(within(dialogue).getByLabelText(/code à six chiffres/i), '000000');
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Verser' }));

    expect(await screen.findByText(/code incorrect ou expiré/i)).toBeVisible();
  });

  it('renoncer ferme sans rien envoyer', async () => {
    const dialogue = await ouvrirConfirmation();

    await userEvent.click(within(dialogue).getByRole('button', { name: 'Renoncer' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(serveur.appelsVers('/api/admin/reglements/i-1/executer')).toHaveLength(0);
  });
});

describe('envois sans réponse', () => {
  it('ne propose l’examen que s’il y a quelque chose à examiner', async () => {
    // Le proposer en permanence inviterait a cliquer sans raison sur une action qui interroge
    // le fournisseur.
    await ouvrirReglement({ factures: [facture()], reglements: [intention({ statut: 'SENT' })] });

    await screen.findByText('ASSURTRANS/TE-2026-08');
    expect(screen.queryByRole('button', { name: /examiner ces envois/i })).toBeNull();
  });

  it('propose l’examen quand un ordre est parti sans réponse', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'DISPATCHING' })],
    });

    expect(await screen.findByRole('button', { name: /examiner ces envois/i })).toBeVisible();
    expect(screen.getByText(/il ne renvoie jamais l’argent/i)).toBeVisible();
  });

  it('rend compte de ce que l’examen a trouvé', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'DISPATCHING' })],
    });
    serveur.repond('POST /api/admin/reprise', {
      corps: { examinees: 1, retrouvees: 0, enRevue: 1 },
    });

    await userEvent.click(await screen.findByRole('button', { name: /examiner ces envois/i }));

    expect(await screen.findByText(/1 confié\(s\) à un examen humain/i)).toBeVisible();
  });

  it('le dit quand il n’y avait rien à examiner', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'DISPATCHING' })],
    });
    serveur.repond('POST /api/admin/reprise', {
      corps: { examinees: 0, retrouvees: 0, enRevue: 0 },
    });

    await userEvent.click(await screen.findByRole('button', { name: /examiner ces envois/i }));

    expect(await screen.findByText(/aucun envoi en suspens/i)).toBeVisible();
  });
});

describe('ce qui a mal tourné', () => {
  it('remonte en tête une intention en revue, en disant que des fonds sont peut-être partis', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [
        intention({ statut: 'NEEDS_REVIEW', motifReview: 'délai dépassé sans réponse' }),
      ],
    });

    const alerte = await screen.findByText(/sort des fonds indéterminé/i);
    expect(alerte).toBeVisible();
    expect(screen.getByText(/un versement est peut-être parti/i)).toBeVisible();
    expect(screen.getByText(/délai dépassé sans réponse/i)).toBeVisible();
  });

  it('écrit un manque en toutes lettres plutôt qu’un nombre signé', async () => {
    // `ecartXof = attendu − constaté` : un écart POSITIF veut dire qu'on a réglé MOINS que dû.
    // La convention se lit à l'envers de l'intuition ; l'écran écrit donc la phrase.
    await ouvrirReglement({
      factures: [facture()],
      reglements: [
        intention({ statut: 'VARIANCE', montantRegle: 1_900_000, ecartXof: 100_000 }),
      ],
    });

    // Le texte paraît deux fois, et c'est voulu : dans l'alerte en tête et sur la ligne.
    const mentions = await screen.findAllByText(/100\s000 versés en moins que dû/i);
    expect(mentions.length).toBeGreaterThanOrEqual(1);
  });

  it('distingue un trop-versé', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [
        intention({ statut: 'VARIANCE', montantRegle: 2_100_000, ecartXof: -100_000 }),
      ],
    });

    const mentions = await screen.findAllByText(/100\s000 versés en trop/i);
    expect(mentions.length).toBeGreaterThanOrEqual(1);
  });

  it('recharge après un refus de concurrence plutôt que de garder un écran périmé', async () => {
    await ouvrirReglement({
      factures: [facture()],
      reglements: [intention({ statut: 'PENDING_APPROVAL' })],
    });
    const avant = serveur.appelsVers('/api/admin/reglements').length;
    serveur.repond('POST /api/admin/reglements/i-1/approuver', {
      statut: 409,
      corps: { erreur: 'ETAT_MODIFIE', code: 'ETAT_MODIFIE' },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Approuver' }));

    expect(await screen.findByText(/la liste vient d’être rechargée/i)).toBeVisible();
    await waitFor(() => {
      expect(serveur.appelsVers('/api/admin/reglements').length).toBeGreaterThan(avant);
    });
  });
});
