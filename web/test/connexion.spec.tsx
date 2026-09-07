/**
 * Écran de connexion, et aiguillage vers le bon écran.
 *
 * Commun aux trois rôles. Deux points méritent d'être tenus à l'œil : le code affiché en clair
 * faute de passerelle SMS, qui ne doit jamais rester à l'écran plus longtemps que nécessaire,
 * et le fait qu'une session périmée renvoie à la connexion plutôt que de laisser croire à un
 * accès qui n'existe plus.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, sessionDe } from './faux-serveur.ts';

let serveur: FauxServeur;

async function saisirNumero(numero = '77 000 00 01') {
  await userEvent.type(screen.getByLabelText(/numéro de téléphone/i), numero);
  await userEvent.click(screen.getByRole('button', { name: /recevoir mon code/i }));
}

async function saisirCode(code = '123456') {
  await userEvent.type(await screen.findByLabelText(/code à six chiffres/i), code);
  await userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
}

beforeEach(() => {
  serveur = new FauxServeur().installer();
});

describe('demande de code', () => {
  it('passe à l’étape du code et rappelle le numéro saisi', async () => {
    serveur.repond('POST /api/auth/code', { statut: 202, corps: { valideSecondes: 300 } });
    render(<App />);

    await saisirNumero();

    expect(await screen.findByRole('heading', { name: /entrez le code/i })).toBeVisible();
    expect(screen.getByText(/77 000 00 01/)).toBeVisible();
  });

  it('n’active le bouton qu’une fois un numéro plausible saisi', async () => {
    render(<App />);

    const bouton = screen.getByRole('button', { name: /recevoir mon code/i });
    expect(bouton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/numéro de téléphone/i), '770000001');
    expect(bouton).toBeEnabled();
  });

  it('affiche le code quand le serveur le renvoie, en disant pourquoi', async () => {
    serveur.repond('POST /api/auth/code', {
      statut: 202,
      corps: { valideSecondes: 300, code: '654321' },
    });
    render(<App />);

    await saisirNumero();

    const avis = await screen.findByText(/passerelle sms non branchée/i);
    expect(avis).toHaveTextContent('654321');
  });

  it('n’affiche aucun code quand le serveur n’en renvoie pas', async () => {
    serveur.repond('POST /api/auth/code', { statut: 202, corps: { valideSecondes: 300 } });
    render(<App />);

    await saisirNumero();

    await screen.findByRole('heading', { name: /entrez le code/i });
    expect(screen.queryByText(/passerelle sms/i)).toBeNull();
  });

  it('efface le code affiché quand on revient corriger le numéro', async () => {
    // Un code laisse a l'ecran apres un retour arriere ne correspond plus a rien.
    serveur.repond('POST /api/auth/code', {
      statut: 202,
      corps: { valideSecondes: 300, code: '654321' },
    });
    render(<App />);

    await saisirNumero();
    await screen.findByText(/654321/);
    await userEvent.click(screen.getByRole('button', { name: /corriger le numéro/i }));

    expect(screen.getByRole('heading', { name: /votre carburant/i })).toBeVisible();
    expect(screen.queryByText(/654321/)).toBeNull();
  });

  it('dit quoi faire quand on a demandé trop de codes', async () => {
    serveur.repond('POST /api/auth/code', {
      statut: 429,
      corps: { erreur: 'trop de demandes, reessayez plus tard' },
    });
    render(<App />);

    await saisirNumero();

    expect(await screen.findByText(/trop de demandes/i)).toBeVisible();
  });

  it('signale un numéro invalide sans quitter l’écran', async () => {
    serveur.repond('POST /api/auth/code', {
      statut: 400,
      corps: { erreur: 'numero de telephone invalide' },
    });
    render(<App />);

    await saisirNumero('123456');

    expect(await screen.findByText(/invalide/i)).toBeVisible();
    expect(screen.getByLabelText(/numéro de téléphone/i)).toBeVisible();
  });

  it('distingue une panne réseau d’un refus du serveur', async () => {
    serveur.horsLigne = true;
    render(<App />);

    await saisirNumero();

    expect(await screen.findByText(/pas de connexion/i)).toBeVisible();
  });
});

describe('vérification du code', () => {
  beforeEach(() => {
    serveur.repond('POST /api/auth/code', { statut: 202, corps: { valideSecondes: 300 } });
  });

  it('n’accepte que six chiffres et ignore les autres caractères', async () => {
    render(<App />);
    await saisirNumero();

    const champ = await screen.findByLabelText(/code à six chiffres/i);
    await userEvent.type(champ, '12a34b5678');

    expect(champ).toHaveValue('123456');
  });

  it('vide le champ après un code refusé, prêt pour un nouvel essai', async () => {
    serveur.repond('POST /api/auth/session', {
      statut: 401,
      corps: { erreur: 'code incorrect, 4 essai(s) restant(s)' },
    });
    render(<App />);
    await saisirNumero();
    await saisirCode('000000');

    expect(await screen.findByText(/code incorrect/i)).toBeVisible();
    expect(screen.getByLabelText(/code à six chiffres/i)).toHaveValue('');
  });
});

describe('aiguillage selon le rôle', () => {
  beforeEach(() => {
    serveur.repond('POST /api/auth/code', { statut: 202, corps: { valideSecondes: 300 } });
  });

  const cas = [
    ['DRIVER', /montrez ce code|combien de carburant/i],
    ['STATION_OPERATOR', /scannez le code/i],
    ['ADMIN', /encours totalenergies/i],
  ] as const;

  it.each(cas)('un %s arrive sur son écran', async (role, attendu) => {
    serveur
      .repond('POST /api/auth/session', { corps: sessionDe(role, 'station-1') })
      .repond('GET /api/bons', { corps: [] })
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
      .repond('GET /api/admin/drivers', { corps: [] })
      .repond('GET /api/admin/stations', { corps: [] })
      .repond('GET /api/admin/operators', { corps: [] });

    render(<App />);
    await saisirNumero();
    await saisirCode();

    expect(await screen.findByText(attendu)).toBeVisible();
  });
});

describe('session en mémoire', () => {
  it('renvoie à la connexion quand la session a expiré', async () => {
    // Mieux vaut redemander un code que laisser croire a un acces qui n'existe plus.
    localStorage.setItem(
      'assurtrans.session',
      JSON.stringify({ ...sessionDe('DRIVER'), expireA: new Date(Date.now() - 1000).toISOString() }),
    );
    render(<App />);

    expect(screen.getByRole('heading', { name: /votre carburant/i })).toBeVisible();
    await waitFor(() => expect(localStorage.getItem('assurtrans.session')).toBeNull());
  });

  it('ignore une session illisible plutôt que de planter', async () => {
    localStorage.setItem('assurtrans.session', 'ceci-n-est-pas-du-json');
    render(<App />);

    expect(screen.getByRole('heading', { name: /votre carburant/i })).toBeVisible();
  });
});
