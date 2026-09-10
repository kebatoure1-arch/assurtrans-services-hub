/**
 * Écran du rapprochement à trois voies.
 *
 * Ce que ces tests figent n'est pas la mise en page mais la façon de ne pas tromper :
 *
 *  - un relevé vide se distingue d'un rapprochement raté ;
 *  - un rapprochement incomplet ne se présente jamais comme un rapprochement ;
 *  - l'écart se lit en français, parce que sa convention de signe est l'inverse de celle du
 *    règlement — deux nombres signés côte à côte se liraient à l'envers l'un de l'autre ;
 *  - clore une ligne exige d'écrire pourquoi ;
 *  - l'acteur n'est jamais transmis : le serveur le lit dans le jeton.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, ouvrirSession, sessionDe } from './faux-serveur.ts';

const ADMIN = sessionDe('ADMIN');

function ligne(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'l-1',
    periode: '2026-08-31',
    statut: 'ORPHAN',
    invoiceId: null,
    paymentIntentId: null,
    waveTransactionId: 'w-1',
    ecartXof: 0,
    toleranceXof: 0,
    motif: 'sortie de fonds de 2000000 XOF sans aucune intention de règlement',
    resoluPar: null,
    resoluA: null,
    note: null,
    ...surcharges,
  };
}

function mouvement(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'w-1',
    waveTxId: 'pw-1',
    dateTx: '2026-08-15T10:00:00.000Z',
    sens: 'OUT',
    montant: 2_000_000,
    contrepartie: 'TotalEnergies',
    ...surcharges,
  };
}

let serveur: FauxServeur;

async function ouvrirRapprochement(
  options: { lignes?: unknown[]; releve?: unknown[]; cycleBloque?: boolean } = {},
) {
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
    .parDefaut((appel) => {
      if (appel.chemin.startsWith('/api/admin/rapprochements/')) {
        return {
          corps: {
            lignes: options.lignes ?? [],
            cycleBloque: options.cycleBloque ?? false,
          },
        };
      }
      if (appel.chemin.startsWith('/api/admin/releve')) {
        return { corps: options.releve ?? [] };
      }
      return undefined;
    });

  ouvrirSession(ADMIN);
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Rapprochement' }));
}

beforeEach(() => {
  serveur = new FauxServeur().installer();
});

describe('un relevé vide', () => {
  it('dit que rien n’a été saisi, et pourquoi cela compte', async () => {
    await ouvrirRapprochement();

    const avis = await screen.findByText(/relevé vide pour cette période/i);
    expect(avis).toHaveTextContent(/ressortira en écart/i);
  });

  it('explique qu’aucun accès automatique n’existe', async () => {
    // Sans cela, on croirait à une panne plutôt qu'à une limite assumée.
    await ouvrirRapprochement();

    expect(await screen.findByText(/wave ne documente pas d’endpoint/i)).toBeVisible();
  });

  it('traduit le refus du serveur en étape manquante', async () => {
    await ouvrirRapprochement();
    serveur.repond('POST /api/admin/rapprochements', {
      statut: 409,
      corps: { erreur: 'RELEVE_VIDE', code: 'RELEVE_VIDE' },
    });

    await userEvent.click(await screen.findByRole('button', { name: /rapprocher la période/i }));

    expect(await screen.findByText(/saisissez le relevé du portefeuille/i)).toBeVisible();
  });
});

describe('ce qui ne colle pas', () => {
  it('met les lignes à traiter en tête et masque les lettrées', async () => {
    // Un rapprochement ou tout va bien n'a rien a dire ; celui ou trois lignes clochent n'a que
    // cela a dire.
    await ouvrirRapprochement({
      lignes: [ligne(), ligne({ id: 'l-2', statut: 'MATCHED', motif: 'facture TE-A lettrée' })],
      releve: [mouvement()],
    });

    expect(await screen.findByText(/1 ligne\(s\) à traiter/i)).toBeVisible();
    expect(screen.queryByText(/facture TE-A lettrée/i)).toBeNull();
  });

  it('déplie tout à la demande', async () => {
    await ouvrirRapprochement({
      lignes: [ligne(), ligne({ id: 'l-2', statut: 'MATCHED', motif: 'facture TE-A lettrée' })],
      releve: [mouvement()],
    });

    await userEvent.click(await screen.findByRole('button', { name: /voir tout \(2\)/i }));

    expect(screen.getByText(/facture TE-A lettrée/i)).toBeVisible();
  });

  it('écrit un manque en toutes lettres, pas en nombre signé', async () => {
    // La convention est ici `constaté − attendu` : un écart NÉGATIF veut dire qu'on a réglé
    // moins que dû — l'inverse de celle du règlement. Deux nombres signés côte à côte se
    // liraient à l'envers l'un de l'autre.
    await ouvrirRapprochement({
      lignes: [ligne({ statut: 'VARIANCE', ecartXof: -100_000 })],
      releve: [mouvement()],
    });

    expect(await screen.findByText(/100\s000 de moins que dû/i)).toBeVisible();
  });

  it('distingue un trop-versé', async () => {
    await ouvrirRapprochement({
      lignes: [ligne({ statut: 'VARIANCE', ecartXof: 100_000 })],
      releve: [mouvement()],
    });

    expect(await screen.findByText(/100\s000 de plus que dû/i)).toBeVisible();
  });
});

describe('l’intégrité du rapprochement', () => {
  it('avertit quand des mouvements n’ont reçu aucune ligne', async () => {
    // Aucun etat silencieux : un rapprochement incomplet ne fait pas foi.
    await ouvrirRapprochement({ releve: [mouvement()] });
    serveur.repond('POST /api/admin/rapprochements', {
      corps: {
        resume: { matched: 1, variance: 0, orphan: 0, enAttente: 0 },
        integrite: { toutesTransactionsClassees: false, transactionsNonClassees: ['w-9'] },
        bloqueCycleSuivant: false,
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: /rapprocher la période/i }));

    // `findByText` rend le <strong> qui porte le titre ; l'avis complet est le paragraphe.
    const avis = (await screen.findByText(/rapprochement incomplet/i)).closest('p');
    expect(avis).toHaveTextContent(/ne fait pas foi/i);
  });

  it('annonce le blocage du cycle suivant, avec sa raison', async () => {
    await ouvrirRapprochement({
      lignes: [ligne()],
      releve: [mouvement()],
      cycleBloque: true,
    });

    const avis = await screen.findByText(/le cycle suivant est bloqué/i);
    expect(avis.closest('p')).toHaveTextContent(/empiler une seconde inconnue/i);
  });

  it('ne dit rien de tel quand rien ne bloque', async () => {
    await ouvrirRapprochement({ lignes: [], releve: [mouvement()], cycleBloque: false });

    await screen.findByText(/rien à traiter/i);
    expect(screen.queryByText(/cycle suivant est bloqué/i)).toBeNull();
  });
});

describe('résoudre une ligne', () => {
  async function ouvrirResolution() {
    await ouvrirRapprochement({
      lignes: [ligne({ statut: 'VARIANCE', ecartXof: -100_000 })],
      releve: [mouvement()],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Résoudre' }));
    return screen.findByRole('dialog', { name: /résoudre l’écart/i });
  }

  it('rappelle le motif et l’écart avant de clore', async () => {
    const dialogue = await ouvrirResolution();

    expect(within(dialogue).getByText(/sans aucune intention de règlement/i)).toBeVisible();
    expect(within(dialogue).getByText(/100\s000 de moins que dû/i)).toBeVisible();
  });

  it('n’active Clore qu’une fois la note écrite', async () => {
    // La note n'est pas une formalité : c'est ce qui rend le journal relisible six mois plus
    // tard.
    const dialogue = await ouvrirResolution();

    const clore = within(dialogue).getByRole('button', { name: /clore la ligne/i });
    expect(clore).toBeDisabled();

    await userEvent.type(within(dialogue).getByLabelText(/pourquoi/i), 'frais bancaires');
    expect(clore).toBeEnabled();
  });

  it('n’envoie que la note : l’acteur vient du jeton', async () => {
    const dialogue = await ouvrirResolution();
    serveur.repond('POST /api/admin/rapprochements/lignes/l-1/resoudre', {
      corps: { resolu: true },
    });

    await userEvent.type(within(dialogue).getByLabelText(/pourquoi/i), 'frais bancaires');
    await userEvent.click(within(dialogue).getByRole('button', { name: /clore la ligne/i }));

    await waitFor(() => {
      expect(serveur.appelsVers('/api/admin/rapprochements/lignes/l-1/resoudre')).toHaveLength(1);
    });
    expect(
      serveur.appelsVers('/api/admin/rapprochements/lignes/l-1/resoudre')[0].corps,
    ).toEqual({ note: 'frais bancaires' });
  });

  it('dit qu’un autre est passé avant, sans perdre l’écran', async () => {
    const dialogue = await ouvrirResolution();
    serveur.repond('POST /api/admin/rapprochements/lignes/l-1/resoudre', {
      statut: 409,
      corps: { erreur: 'DEJA_RESOLUE', code: 'DEJA_RESOLUE' },
    });

    await userEvent.type(within(dialogue).getByLabelText(/pourquoi/i), 'frais bancaires');
    await userEvent.click(within(dialogue).getByRole('button', { name: /clore la ligne/i }));

    expect(await screen.findByText(/déjà tranché cette ligne/i)).toBeVisible();
  });

  it('renoncer ferme sans rien envoyer', async () => {
    const dialogue = await ouvrirResolution();

    await userEvent.click(within(dialogue).getByRole('button', { name: 'Renoncer' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(serveur.appelsVers('/api/admin/rapprochements/lignes/l-1/resoudre')).toHaveLength(0);
  });

  it('affiche la note d’une ligne déjà résolue', async () => {
    await ouvrirRapprochement({
      lignes: [
        ligne({ resoluPar: 'omar-1', resoluA: '2026-09-01T10:00:00.000Z', note: 'frais Wave' }),
      ],
      releve: [mouvement()],
    });

    await userEvent.click(await screen.findByRole('button', { name: /voir tout/i }));
    // La note cotoie l'horodatage dans le meme <small> : on cherche le texte, pas le noeud.
    expect(screen.getByText(/frais Wave/)).toBeVisible();
  });
});

describe('saisie du relevé', () => {
  it('refuse un montant à décimales sans appeler le serveur', async () => {
    // Le franc CFA n'a pas de subdivision.
    await ouvrirRapprochement();

    await userEvent.click(await screen.findByRole('button', { name: /saisir un mouvement/i }));
    await userEvent.type(screen.getByLabelText(/montant/i), '2000,50');

    expect(screen.getByLabelText(/montant/i)).toHaveValue('200050');
  });

  it('dit qu’un mouvement figure déjà, au lieu de le doubler', async () => {
    await ouvrirRapprochement();
    serveur.repond('POST /api/admin/releve', {
      statut: 409,
      corps: { erreur: 'MOUVEMENT_DEJA_SAISI', code: 'MOUVEMENT_DEJA_SAISI' },
    });

    await userEvent.click(await screen.findByRole('button', { name: /saisir un mouvement/i }));
    await userEvent.type(screen.getByLabelText(/identifiant wave/i), 'pw-1');
    await userEvent.type(screen.getByLabelText('Date'), '2026-08-15');
    await userEvent.type(screen.getByLabelText(/montant/i), '2000000');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText(/figure déjà au relevé/i)).toBeVisible();
  });
});
