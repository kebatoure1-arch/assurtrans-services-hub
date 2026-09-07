/**
 * Écran chauffeur.
 *
 * La question à laquelle il répond : ai-je un bon à présenter ?
 * Ce qui est vérifié ici va au-delà de l'affichage — surtout le comportement hors connexion,
 * qui est la raison d'être du cache local.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, bon, ouvrirSession, sessionDe } from './faux-serveur.ts';

const CHAUFFEUR = sessionDe('DRIVER');
const CLE_BON = `assurtrans.dernier-bon.${CHAUFFEUR.subject}`;

let serveur: FauxServeur;

beforeEach(() => {
  serveur = new FauxServeur().installer();
  ouvrirSession(CHAUFFEUR);
});

describe('sans bon en cours', () => {
  beforeEach(() => {
    serveur.repond('GET /api/bons', { corps: [] });
  });

  it('propose de choisir un montant', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /combien de carburant/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /^20\s000$/ })).toBeVisible();
  });

  it('envoie le montant choisi et emmène le chauffeur payer', async () => {
    serveur.repond('POST /api/paiements/session', {
      statut: 201,
      corps: { reference: 'REF-1', urlPaiement: 'https://pay.test/1', montantXof: 20000 },
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /^20\s000$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Payer' }));

    await waitFor(() => {
      expect(serveur.appelsVers('/api/paiements/session')).toHaveLength(1);
    });
    expect(serveur.appelsVers('/api/paiements/session')[0].corps).toEqual({ montantXof: 20000 });
  });

  it('n’active Payer qu’une fois un montant choisi', async () => {
    render(<App />);

    const payer = await screen.findByRole('button', { name: 'Payer' });
    expect(payer).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /^10\s000$/ }));
    expect(payer).toBeEnabled();
  });

  it('accepte un montant libre et ignore ce qui n’est pas un chiffre', async () => {
    render(<App />);

    const champ = await screen.findByPlaceholderText('15 000');
    await userEvent.type(champ, '12a500');

    expect(champ).toHaveValue('12500');
    expect(screen.getByRole('button', { name: 'Payer' })).toBeEnabled();
  });
});

describe('avec un bon utilisable', () => {
  beforeEach(() => {
    serveur.repond('GET /api/bons', { corps: [bon()] });
  });

  it('montre le ticket, son montant et le code à présenter', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /montrez ce code/i })).toBeVisible();
    expect(screen.getByText(/^20\s000$/)).toBeVisible();
    expect(await screen.findByRole('img', { name: /code à présenter au pompiste/i })).toBeVisible();
  });

  it('annonce la durée de validité restante', async () => {
    render(<App />);
    expect(await screen.findByText(/valable encore/i)).toBeVisible();
  });

  it('conserve le bon localement, rattaché à ce chauffeur', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: /montrez ce code/i });
    await waitFor(() => expect(localStorage.getItem(CLE_BON)).not.toBeNull());
  });
});

describe('hors connexion', () => {
  it('affiche le bon conservé et dit clairement ce qu’il en est', async () => {
    localStorage.setItem(CLE_BON, JSON.stringify(bon()));
    serveur.horsLigne = true;
    render(<App />);

    expect(await screen.findByRole('heading', { name: /montrez ce code/i })).toBeVisible();
    expect(screen.getByText(/sans connexion/i)).toBeVisible();
    expect(screen.getByText(/c’est le pompiste qui le vérifie/i)).toBeVisible();
  });

  it('empêche de payer sans réseau plutôt que de laisser échouer', async () => {
    serveur.horsLigne = true;
    render(<App />);

    const payer = await screen.findByRole('button', { name: /réseau requis pour payer/i });
    expect(payer).toBeDisabled();
  });

  it('ne ressort pas un bon périmé du cache', async () => {
    localStorage.setItem(
      CLE_BON,
      JSON.stringify(bon({ expireA: new Date(Date.now() - 3_600_000).toISOString() })),
    );
    serveur.horsLigne = true;
    render(<App />);

    expect(await screen.findByRole('heading', { name: /combien de carburant/i })).toBeVisible();
    expect(localStorage.getItem(CLE_BON)).toBeNull();
  });

  it('ne montre pas le bon d’un autre chauffeur sur le même téléphone', async () => {
    // Les telephones se pretent : le cache est rattache a un chauffeur precis.
    localStorage.setItem('assurtrans.dernier-bon.chauffeur-autre', JSON.stringify(bon()));
    serveur.horsLigne = true;
    render(<App />);

    expect(await screen.findByRole('heading', { name: /combien de carburant/i })).toBeVisible();
    expect(screen.queryByRole('img', { name: /code à présenter/i })).toBeNull();
  });
});

describe('cas limites du ticket', () => {
  it('ne laisse pas un ticket muet quand le bon n’a pas de jeton', async () => {
    // Le serveur n'accompagne d'un jeton que les bons encore utilisables. Un bon EMIS non
    // expire sans jeton ne devrait pas exister, mais s'il arrive, l'ecran doit le dire.
    serveur.repond('GET /api/bons', { corps: [bon({ jeton: null })] });
    render(<App />);

    await screen.findByRole('heading', { name: /montrez ce code/i });
    const ticket = document.querySelector('.ticket .corps') as HTMLElement;
    expect(ticket.textContent?.trim()).not.toBe('');
  });
});

describe('bons passés', () => {
  it('distingue un bon servi d’un bon expiré', async () => {
    serveur.repond('GET /api/bons', {
      corps: [
        bon({ id: 'BON-2', statut: 'CONSOMME', consommeA: new Date().toISOString(), jeton: null }),
        bon({
          id: 'BON-3',
          statut: 'EMIS',
          expireA: new Date(Date.now() - 3_600_000).toISOString(),
          jeton: null,
        }),
      ],
    });
    render(<App />);

    expect(await screen.findByText(/servi le/i)).toBeVisible();
    expect(screen.getByText('expiré')).toBeVisible();
  });
});

describe('déconnexion', () => {
  it('efface la session et le bon conservé sur l’appareil', async () => {
    serveur.repond('GET /api/bons', { corps: [bon()] });
    render(<App />);

    await screen.findByRole('heading', { name: /montrez ce code/i });
    await waitFor(() => expect(localStorage.getItem(CLE_BON)).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Quitter' }));

    // Un bon est un titre de carburant : il ne reste pas sur un appareil qu'on vient de quitter.
    expect(localStorage.getItem(CLE_BON)).toBeNull();
    expect(localStorage.getItem('assurtrans.session')).toBeNull();
    expect(await screen.findByRole('heading', { name: /votre carburant/i })).toBeVisible();
  });
});
