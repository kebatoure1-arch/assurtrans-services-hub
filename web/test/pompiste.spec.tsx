/**
 * Écran pompiste.
 *
 * La question à laquelle il répond : est-ce que je sers, et combien ?
 *
 * Ce qui est vérifié ici tient surtout à la lisibilité du refus et à ce que l'écran envoie.
 * Un pompiste ne doit jamais lire un identifiant technique, et ne doit jamais pouvoir servir
 * au nom d'une autre station.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, ouvrirSession, sessionDe } from './faux-serveur.ts';

const POMPISTE = sessionDe('STATION_OPERATOR', 'station-3');

let serveur: FauxServeur;

/** La caméra n'existe pas sous jsdom : l'écran doit basculer seul en saisie manuelle. */
function sansCamera() {
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject(new Error('pas de caméra'))) },
  });
}

/** Le mot du verdict, tel qu'il est ecrit dans le DOM ; la feuille de style le met en capitales. */
function motDuVerdict(verdict: HTMLElement): string {
  return verdict.querySelector('.mot')?.textContent ?? '';
}

async function scanner(contenu = 'AT1.charge.signature') {
  const champ = await screen.findByPlaceholderText('AT1…');
  await userEvent.type(champ, contenu);
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
}

beforeEach(() => {
  serveur = new FauxServeur().installer();
  ouvrirSession(POMPISTE);
  sansCamera();
});

describe('quand la caméra est indisponible', () => {
  it('bascule seul en saisie manuelle et le dit', async () => {
    render(<App />);

    expect(await screen.findByText(/caméra indisponible/i)).toBeVisible();
    expect(screen.getByPlaceholderText('AT1…')).toBeVisible();
  });
});

describe('bon valable', () => {
  beforeEach(() => {
    serveur.repond('POST /api/station/consommation', {
      corps: { servir: true, montantXof: 20000, bon: 'BON-1', dejaServi: false },
    });
  });

  it('affiche SERVIR et le montant, en pleine page', async () => {
    render(<App />);
    await scanner();

    const verdict = await screen.findByRole('alert');
    expect(motDuVerdict(verdict)).toBe('Servir');
    expect(verdict.className).toContain('servir');
    expect(verdict).toHaveTextContent(/20\s000/);
    expect(verdict).toHaveTextContent('FCFA');
  });

  it('n’envoie jamais la station : elle vient du jeton', async () => {
    render(<App />);
    await scanner();

    await waitFor(() => expect(serveur.appelsVers('/api/station/consommation')).toHaveLength(1));
    const corps = serveur.appelsVers('/api/station/consommation')[0].corps;
    expect(corps).not.toHaveProperty('stationId');
    expect(corps).toHaveProperty('redemptionId');
  });

  it('ne referme pas le verdict tout seul : c’est le pompiste qui le fait', async () => {
    render(<App />);
    await scanner();

    await screen.findByRole('alert');
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.getByRole('alert')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: /scanner le bon suivant/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('protection contre le double envoi', () => {
  it('n’envoie qu’une seule fois quand le pompiste appuie deux fois', async () => {
    // Deux appels signifieraient deux identifiants de scan differents, donc un refus pour
    // « deja servi » sur le second — alors que le pompiste n'a servi qu'une fois.
    serveur.repond('POST /api/station/consommation', {
      corps: { servir: true, montantXof: 20000, bon: 'BON-1', dejaServi: false },
    });
    render(<App />);

    const champ = await screen.findByPlaceholderText('AT1…');
    await userEvent.type(champ, 'AT1.charge.signature');
    const bouton = screen.getByRole('button', { name: 'Vérifier' });
    await Promise.all([userEvent.click(bouton), userEvent.click(bouton)]);

    await screen.findByRole('alert');
    expect(serveur.appelsVers('/api/station/consommation')).toHaveLength(1);
  });

  it('repart d’un champ vide après avoir refermé le verdict', async () => {
    serveur.repond('POST /api/station/consommation', {
      corps: { servir: true, montantXof: 20000, bon: 'BON-1', dejaServi: false },
    });
    render(<App />);
    await scanner();

    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: /scanner le bon suivant/i }));

    expect(await screen.findByPlaceholderText('AT1…')).toHaveValue('');
  });
});

describe('bon déjà utilisé', () => {
  it('traduit le refus en une phrase, sans identifiant technique', async () => {
    serveur.repond('POST /api/station/consommation', {
      statut: 409,
      corps: {
        erreur: 'DEJA_SERVI',
        code: 'DEJA_SERVI',
        consommeA: '2026-09-07T14:48:00.000Z',
        memeStation: true,
      },
    });
    render(<App />);
    await scanner();

    const verdict = await screen.findByRole('alert');
    expect(motDuVerdict(verdict)).toBe('Ne pas servir');
    expect(verdict.className).toContain('refus');
    expect(verdict).toHaveTextContent(/déjà servi ici à \d{2}:\d{2}/i);
    // Ce que le pompiste ne doit jamais lire.
    expect(verdict).not.toHaveTextContent('BON-1');
    expect(verdict).not.toHaveTextContent('2026-09-07T14:48');
  });

  it('distingue un service dans une autre station', async () => {
    serveur.repond('POST /api/station/consommation', {
      statut: 409,
      corps: {
        erreur: 'DEJA_SERVI',
        code: 'DEJA_SERVI',
        consommeA: '2026-09-07T14:48:00.000Z',
        memeStation: false,
      },
    });
    render(<App />);
    await scanner();

    expect(await screen.findByText(/dans une autre station/i)).toBeVisible();
  });

  it('confirme un rescan du même bon sans le servir une seconde fois', async () => {
    serveur.repond('POST /api/station/consommation', {
      corps: { servir: true, montantXof: 20000, bon: 'BON-1', dejaServi: true },
    });
    render(<App />);
    await scanner();

    const verdict = await screen.findByRole('alert');
    expect(verdict).toHaveTextContent(/déjà servi/i);
    expect(verdict).toHaveTextContent(/ne servez pas une seconde fois/i);
  });
});

describe('autres refus', () => {
  const cas = [
    ['BON_EXPIRE', /a expiré/i],
    ['BON_ANNULE', /a été annulé/i],
    ['BON_INCONNU', /ne correspond à aucun bon/i],
    ['QR_ILLISIBLE', /n’a pas été émis/i],
    ['BON_NON_CONFORME', /incohérent/i],
  ] as const;

  it.each(cas)('traduit %s en une phrase actionnable', async (code, attendu) => {
    serveur.repond('POST /api/station/consommation', {
      statut: 409,
      corps: { erreur: code, code },
    });
    render(<App />);
    await scanner();

    const verdict = await screen.findByRole('alert');
    expect(motDuVerdict(verdict)).toBe('Ne pas servir');
    expect(verdict).toHaveTextContent(attendu);
  });
});

describe('sans réseau', () => {
  it('refuse de servir plutôt que d’afficher un feu vert qui ne veut rien dire', async () => {
    // Seul le serveur sait si un bon a deja servi. Sans lui, on ne sert pas.
    serveur.horsLigne = true;
    render(<App />);
    await scanner();

    const verdict = await screen.findByRole('alert');
    expect(motDuVerdict(verdict)).toBe('Ne pas servir');
    expect(verdict.className).toContain('refus');
    expect(verdict).toHaveTextContent(/pas de réseau/i);
    expect(verdict).toHaveTextContent(/ne servez pas/i);
  });
});

describe('cloisonnement des rôles', () => {
  it('un pompiste ne voit jamais l’écran du chauffeur', async () => {
    serveur.repond('POST /api/station/consommation', { corps: { servir: true, montantXof: 1, bon: 'B', dejaServi: false } });
    render(<App />);

    expect(await screen.findByRole('heading', { name: /scannez le code/i })).toBeVisible();
    expect(screen.queryByText(/combien de carburant/i)).toBeNull();
    expect(serveur.appelsVers('/api/bons')).toHaveLength(0);
  });
});
