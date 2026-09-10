/**
 * Écran du journal d'audit.
 *
 * Un journal d'audit qui trompe est pire qu'aucun journal. Ce que ces tests figent :
 *
 *  - l'écran dit que le contenu des actions n'est pas conservé, au lieu de laisser croire
 *    qu'on peut « ouvrir » un événement ;
 *  - un identifiant devient un nom quand on le connaît, et reste lisible sinon ;
 *  - une action inconnue s'affiche telle quelle plutôt que de disparaître ;
 *  - charger la suite ajoute, ne remplace pas ;
 *  - les gestes qui touchent à l'argent se repèrent.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, ouvrirSession, sessionDe } from './faux-serveur.ts';

const ADMIN = sessionDe('ADMIN');

function evenement(surcharges: Record<string, unknown> = {}) {
  return {
    id: '42',
    ts: '2026-09-10T09:30:00.000Z',
    acteur: '618a2c0c-0118-46c5-b68b-8399f1d2bbf9',
    acteurNom: 'Awa Fall',
    action: 'REGLEMENT_EXECUTE',
    cibleType: 'payment_intent',
    cibleId: 'eb89a273-9c39-49f4-a85d-e98d118ee073',
    empreinte: 'a'.repeat(64),
    ...surcharges,
  };
}

let serveur: FauxServeur;

async function ouvrirJournal(
  options: { evenements?: unknown[]; curseurSuivant?: string | null; actions?: string[] } = {},
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
      if (appel.chemin.startsWith('/api/admin/journal/actions')) {
        return { corps: options.actions ?? ['REGLEMENT_EXECUTE', 'CHAUFFEUR_CREE'] };
      }
      if (appel.chemin.startsWith('/api/admin/journal')) {
        return {
          corps: {
            evenements: options.evenements ?? [],
            curseurSuivant: options.curseurSuivant ?? null,
          },
        };
      }
      return undefined;
    });

  ouvrirSession(ADMIN);
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Journal' }));
}

/**
 * Le tableau, pas la page entiere.
 *
 * Les libelles d'action figurent aussi dans le menu de filtrage : chercher dans toute la page
 * trouverait l'option au lieu de la ligne.
 */
function tableau(): HTMLElement {
  return screen.getByRole('table');
}

beforeEach(() => {
  serveur = new FauxServeur().installer();
});

describe('ce que le journal ne contient pas', () => {
  it('dit que le contenu des actions n’est pas conservé', async () => {
    // Sans cela, on cliquerait indefiniment pour ouvrir un evenement qui ne s'ouvre pas.
    await ouvrirJournal({ evenements: [evenement()] });

    expect(await screen.findByText(/seule son empreinte/i)).toBeVisible();
  });

  it('montre une empreinte tronquée, jamais un payload', async () => {
    await ouvrirJournal({ evenements: [evenement()] });

    await screen.findByText(/aaaaaaaaaaaa…/);
    expect(screen.queryByText(/payload/i)).toBeNull();
  });
});

describe('qui a agi', () => {
  it('montre le nom quand le compte est connu', async () => {
    await ouvrirJournal({ evenements: [evenement({ acteurNom: 'Awa Fall' })] });

    expect(await screen.findByText('Awa Fall')).toBeVisible();
  });

  it('nomme un mécanisme plutôt que d’afficher un mot technique', async () => {
    await ouvrirJournal({
      evenements: [evenement({ acteur: 'reprise', acteurNom: null, action: 'REGLEMENT_REPRIS' })],
    });

    expect(await screen.findByText(/la reprise automatique/i)).toBeVisible();
  });

  it('rend un identifiant tronqué quand le compte a disparu', async () => {
    // Le journal survit au referentiel : l'evenement reste, meme sans nom.
    await ouvrirJournal({
      evenements: [evenement({ acteur: '9f8e7d6c-1111-2222-3333-444455556666', acteurNom: null })],
    });

    expect(await screen.findByText('9f8e7d6c')).toBeVisible();
  });
});

describe('ce qui s’est passé', () => {
  it('traduit les actions connues', async () => {
    await ouvrirJournal({ evenements: [evenement({ action: 'VOUCHER_REDEEMED' })] });

    expect(await screen.findByText('Bon servi')).toBeVisible();
  });

  it('affiche telle quelle une action qu’il ne connaît pas', async () => {
    // Une action ajoutee plus tard ne doit pas disparaitre de l'ecran parce que personne n'a
    // pense a la traduire.
    await ouvrirJournal({ evenements: [evenement({ action: 'ACTION_TOUTE_NEUVE' })] });

    expect(await screen.findByText('ACTION_TOUTE_NEUVE')).toBeVisible();
  });

  it('signale les gestes qui touchent à l’argent', async () => {
    await ouvrirJournal({ evenements: [evenement({ action: 'REGLEMENT_EXECUTE' })] });

    await screen.findByRole('table');
    expect(within(tableau()).getByText('Règlement exécuté')).toHaveClass('etat', 'grave');
  });

  it('ne signale pas une création de fiche', async () => {
    await ouvrirJournal({ evenements: [evenement({ action: 'CHAUFFEUR_CREE' })] });

    await screen.findByRole('table');
    expect(within(tableau()).getByText('Chauffeur créé')).not.toHaveClass('grave');
  });
});

describe('filtrer', () => {
  it('rassemble toute la vie d’une cible d’un clic', async () => {
    // La question qu'on se pose vraiment : qu'est-il arrive a ce reglement ?
    await ouvrirJournal({ evenements: [evenement()] });

    await screen.findByRole('table');
    await userEvent.click(
      within(tableau()).getByRole('button', { name: /payment_intent eb89a273/i }),
    );

    await waitFor(() => {
      const avecCible = serveur
        .appelsVers('/api/admin/journal')
        .filter((a) => a.requete.cible !== undefined);
      expect(avecCible[0]?.requete.cible).toBe('eb89a273-9c39-49f4-a85d-e98d118ee073');
    });
  });

  it('ne propose que les actions réellement présentes', async () => {
    // Une liste ecrite en dur proposerait des filtres qui ne rendent rien.
    await ouvrirJournal({ actions: ['ECART_RESOLU'] });

    const choix = await screen.findByLabelText('Action');
    expect(within(choix).getByRole('option', { name: 'Écart résolu' })).toBeInTheDocument();
    expect(within(choix).queryByRole('option', { name: 'Bon servi' })).toBeNull();
  });

  it('dit qu’aucun événement ne correspond, et non que le journal est vide', async () => {
    await ouvrirJournal({ actions: ['ECART_RESOLU'] });

    await userEvent.selectOptions(await screen.findByLabelText('Action'), 'ECART_RESOLU');

    expect(await screen.findByText(/aucun événement ne correspond/i)).toBeVisible();
  });

  it('distingue un journal vide d’un filtre trop étroit', async () => {
    await ouvrirJournal();

    expect(await screen.findByText(/le journal est vide/i)).toBeVisible();
  });
});

describe('charger la suite', () => {
  it('ajoute au lieu de remplacer', async () => {
    // Le journal grossit pendant qu'on le lit : ce qui a ete lu doit rester lu.
    await ouvrirJournal({
      evenements: [evenement({ id: '42', action: 'REGLEMENT_EXECUTE' })],
      curseurSuivant: '42',
    });
    await screen.findByRole('table');
    expect(within(tableau()).getByText('Règlement exécuté')).toBeVisible();

    serveur.parDefaut((appel) => {
      if (appel.chemin.startsWith('/api/admin/journal/actions')) return { corps: [] };
      if (appel.requete.curseur === '42') {
        return {
          corps: {
            evenements: [evenement({ id: '41', action: 'CHAUFFEUR_CREE' })],
            curseurSuivant: null,
          },
        };
      }
      if (appel.chemin.startsWith('/api/admin/journal')) {
        return { corps: { evenements: [], curseurSuivant: null } };
      }
      return undefined;
    });

    await userEvent.click(screen.getByRole('button', { name: /charger la suite/i }));

    await waitFor(() => {
      expect(within(tableau()).getByText('Chauffeur créé')).toBeVisible();
    });
    expect(within(tableau()).getByText('Règlement exécuté')).toBeVisible();
  });

  it('ne propose pas de suite quand il n’y en a pas', async () => {
    await ouvrirJournal({ evenements: [evenement()], curseurSuivant: null });

    await screen.findByRole('table');
    expect(within(tableau()).getByText('Règlement exécuté')).toBeVisible();
    expect(screen.queryByRole('button', { name: /charger la suite/i })).toBeNull();
  });
});
