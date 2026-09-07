/**
 * Espace d'administration.
 *
 * Deux écrans : le pilotage, qui répond à « quelque chose demande-t-il mon attention ? »,
 * et le référentiel, qui répond à « qui existe, et comment le tenir à jour ? ».
 *
 * Les cas de projection d'encours sont vérifiés un par un : c'est le chiffre sur lequel une
 * décision se prend, et le seul endroit de l'interface où une valeur brute serait trompeuse.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { FauxServeur, ouvrirSession, sessionDe } from './faux-serveur.ts';

const ADMIN = sessionDe('ADMIN');

const CONTRAT = {
  numeroCompte: 'TE-4471',
  encoursAutorise: 10_000_000,
  seuilAlertePct: 70,
  seuilBlocagePct: 90,
  canalReglement: 'DRY_RUN',
};

function etat(surcharges: Record<string, unknown> = {}) {
  return {
    contrat: CONTRAT,
    encours: {
      encoursAutorise: 10_000_000,
      encoursCourant: 3_500_000,
      disponible: 6_500_000,
      utilisationPct: 35,
      depassement: 0,
      seuilAlerteXof: 7_000_000,
      seuilBlocageXof: 9_000_000,
      niveau: 'NORMAL',
    },
    projection: { joursRestants: 40, date: '2026-10-17', raison: 'PROJETE' },
    bonsEnCirculation: 800_000,
    activite: { bonsEmis: 14, montantEmis: 230_000, bonsConsommes: 11, montantConsomme: 185_000 },
    incidents: [],
    avertissements: [],
    arreteA: '2026-09-07T09:00:00.000Z',
    ...surcharges,
  };
}

let serveur: FauxServeur;

function referentielVide() {
  serveur
    .repond('GET /api/admin/drivers', { corps: [] })
    .repond('GET /api/admin/stations', { corps: [] })
    .repond('GET /api/admin/operators', { corps: [] });
}

beforeEach(() => {
  serveur = new FauxServeur().installer();
  ouvrirSession(ADMIN);
  serveur.repond('GET /api/admin/tableau-de-bord', { corps: etat() });
  referentielVide();
});

describe('pilotage', () => {
  it('montre l’encours, le disponible et les bons en circulation', async () => {
    render(<App />);

    expect(await screen.findByText('3 500 000')).toBeVisible();
    expect(screen.getByText('6 500 000')).toBeVisible();
    expect(screen.getByText('800 000')).toBeVisible();
    expect(screen.getByText(/35 % du plafond/)).toBeVisible();
  });

  it('annonce la date d’atteinte du seuil, avec l’année', async () => {
    render(<App />);

    expect(await screen.findByText(/seuil de blocage atteint dans/i)).toBeVisible();
    expect(screen.getByText(/40/)).toBeVisible();
    // Sans l'annee, « 17 octobre » se lirait comme ce mois-ci.
    expect(screen.getByText(/17 octobre 2026/)).toBeVisible();
  });

  it('renonce à chiffrer une projection au-delà de six mois', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({ projection: { joursRestants: 7685, date: '2047-09-22', raison: 'PROJETE' } }),
    });
    render(<App />);

    expect(await screen.findByText(/plus de 6 mois/i)).toBeVisible();
    expect(screen.queryByText(/7685/)).toBeNull();
  });

  it('signale un seuil déjà atteint et ce qu’il faut faire', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({ projection: { joursRestants: 0, date: null, raison: 'DEJA_ATTEINT' } }),
    });
    render(<App />);

    expect(await screen.findByText('Atteint')).toBeVisible();
    expect(screen.getByText(/réglez les factures échues/i)).toBeVisible();
  });

  it('ne projette rien sans consommation observée', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({ projection: { joursRestants: null, date: null, raison: 'CONSOMMATION_NULLE' } }),
    });
    render(<App />);

    expect(await screen.findByText(/pas de projection/i)).toBeVisible();
  });

  it('remonte les incidents avant les chiffres', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({
        incidents: [
          { type: 'REGLEMENT_EN_REVUE', gravite: 'CRITIQUE', nombre: 1, libelle: 'Règlement en revue' },
          { type: 'ENVOI_QR_ECHOUE', gravite: 'ATTENTION', nombre: 2, libelle: 'QR non parvenus' },
        ],
      }),
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'À traiter' })).toBeVisible();
    expect(screen.getByText('Règlement en revue')).toBeVisible();
    expect(screen.getByText('QR non parvenus')).toBeVisible();
  });

  it('conserve l’ordre de gravité rendu par le serveur', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({
        incidents: [
          { type: 'REGLEMENT_EN_REVUE', gravite: 'CRITIQUE', nombre: 1, libelle: 'Règlement en revue' },
          { type: 'ECART_RAPPROCHEMENT', gravite: 'CRITIQUE', nombre: 3, libelle: 'Écart de rapprochement' },
          { type: 'ENVOI_QR_ECHOUE', gravite: 'ATTENTION', nombre: 2, libelle: 'QR non parvenus' },
        ],
      }),
    });
    render(<App />);

    await screen.findByRole('heading', { name: 'À traiter' });
    const libelles = [...document.querySelectorAll('.liste-incidents li .quoi')].map(
      (e) => e.textContent,
    );
    expect(libelles).toEqual(['Règlement en revue', 'Écart de rapprochement', 'QR non parvenus']);
  });

  it('reste lisible quand le plafond est dépassé', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({
        encours: {
          encoursAutorise: 10_000_000,
          encoursCourant: 12_000_000,
          disponible: 0,
          utilisationPct: 120,
          depassement: 2_000_000,
          seuilAlerteXof: 7_000_000,
          seuilBlocageXof: 9_000_000,
          niveau: 'BLOCAGE',
        },
        projection: { joursRestants: 0, date: null, raison: 'DEJA_ATTEINT' },
      }),
    });
    render(<App />);

    expect(await screen.findByText(/120 % du plafond/)).toBeVisible();
    // La barre ne deborde pas de sa piste, et les deux seuils restent dans le cadre.
    const remplissage = document.querySelector('.jauge .remplissage') as HTMLElement;
    expect(remplissage.style.width).toBe('100%');
    const seuils = [...document.querySelectorAll('.jauge .seuil')].map((e) =>
      parseFloat((e as HTMLElement).style.left),
    );
    expect(Math.max(...seuils)).toBeLessThanOrEqual(100);
  });

  it('dit en clair que le règlement tourne à blanc', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({ avertissements: ['REGLEMENT_EN_DRY_RUN'] }),
    });
    render(<App />);

    expect(await screen.findByText(/aucun mouvement d’argent réel/i)).toBeVisible();
  });

  it('reste lisible sans contrat TotalEnergies', async () => {
    serveur.repond('GET /api/admin/tableau-de-bord', {
      corps: etat({
        contrat: null,
        encours: null,
        projection: null,
        avertissements: ['CONTRAT_TE_ABSENT'],
      }),
    });
    render(<App />);

    expect(await screen.findByText(/aucun contrat enregistré/i)).toBeVisible();
    expect(screen.getByText('14')).toBeVisible();
  });
});

describe('référentiel', () => {
  async function ouvrirReferentiel() {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Référentiel' }));
  }

  it('liste les chauffeurs avec leur statut', async () => {
    serveur.repond('GET /api/admin/drivers', {
      corps: [
        { id: 'c1', nom: 'Moussa Ndiaye', msisdn: '+221770000001', statut: 'ACTIF' },
        { id: 'c2', nom: 'Aminata Diop', msisdn: '+221779876543', statut: 'SUSPENDU' },
      ],
    });
    await ouvrirReferentiel();

    expect(await screen.findByText('Moussa Ndiaye')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Suspendre' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Réactiver' })).toBeVisible();
  });

  it('crée un chauffeur et recharge la liste', async () => {
    serveur.repond('POST /api/admin/drivers', {
      statut: 201,
      corps: { id: 'c9', nom: 'Awa', msisdn: '+221770000009', statut: 'ACTIF' },
    });
    await ouvrirReferentiel();

    await userEvent.type(await screen.findByPlaceholderText('Moussa Ndiaye'), 'Awa Fall');
    await userEvent.type(screen.getByPlaceholderText('77 000 00 01'), '77 000 00 09');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    const creation = await waitFor(() => {
      const post = serveur.appelsVers('/api/admin/drivers').find((a) => a.methode === 'POST');
      expect(post).toBeDefined();
      return post!;
    });
    expect(creation.corps).toEqual({ nom: 'Awa Fall', telephone: '77 000 00 09' });
    // La liste est rechargee apres coup : l'ecran ne se fie pas a ce qu'il vient d'envoyer.
    expect(serveur.appelsVers('/api/admin/drivers').filter((a) => a.methode === 'GET').length)
      .toBeGreaterThan(1);
  });

  it('affiche le refus du serveur quand le numéro est déjà pris', async () => {
    serveur.repond('POST /api/admin/drivers', {
      statut: 409,
      corps: { erreur: 'le numéro +221770000009 est déjà rattaché à une autre fiche' },
    });
    await ouvrirReferentiel();

    await userEvent.type(await screen.findByPlaceholderText('Moussa Ndiaye'), 'Awa');
    await userEvent.type(screen.getByPlaceholderText('77 000 00 01'), '770000009');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText(/déjà rattaché à une autre fiche/i)).toBeVisible();
  });

  it('exige un motif pour suspendre, et n’appelle rien si on l’annule', async () => {
    serveur.repond('GET /api/admin/drivers', {
      corps: [{ id: 'c1', nom: 'Moussa', msisdn: '+221770000001', statut: 'ACTIF' }],
    });
    vi.stubGlobal('prompt', vi.fn(() => null));
    await ouvrirReferentiel();

    await userEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));

    expect(serveur.appelsVers('/api/admin/drivers/c1/statut')).toHaveLength(0);
  });

  it('transmet le motif de suspension au serveur', async () => {
    serveur
      .repond('GET /api/admin/drivers', {
        corps: [{ id: 'c1', nom: 'Moussa', msisdn: '+221770000001', statut: 'ACTIF' }],
      })
      .repond('POST /api/admin/drivers/c1/statut', { corps: { id: 'c1', statut: 'SUSPENDU' } });
    vi.stubGlobal('prompt', vi.fn(() => 'impayé'));
    await ouvrirReferentiel();

    await userEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));

    await waitFor(() => expect(serveur.appelsVers('/api/admin/drivers/c1/statut')).toHaveLength(1));
    expect(serveur.appelsVers('/api/admin/drivers/c1/statut')[0].corps).toEqual({
      statut: 'SUSPENDU',
      motif: 'impayé',
    });
  });

  it('rattache un pompiste à une station choisie dans la liste', async () => {
    serveur
      .repond('GET /api/admin/stations', {
        corps: [{ id: 'st-1', code: 'DKR-07', nom: 'Liberté 6', ville: 'Dakar', statut: 'ACTIVE' }],
      })
      .repond('POST /api/admin/operators', { statut: 201, corps: { id: 'o1' } });
    await ouvrirReferentiel();

    await userEvent.click(await screen.findByRole('button', { name: /opérateurs/i }));
    await userEvent.type(screen.getByPlaceholderText('Moussa Ndiaye'), 'Cheikh Ba');
    await userEvent.type(screen.getByPlaceholderText('77 000 00 01'), '775551122');
    await userEvent.selectOptions(screen.getByLabelText(/station/i), 'st-1');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    const creation = await waitFor(() => {
      const post = serveur.appelsVers('/api/admin/operators').find((a) => a.methode === 'POST');
      expect(post).toBeDefined();
      return post!;
    });
    expect(creation.corps).toMatchObject({ role: 'STATION_OPERATOR', stationId: 'st-1' });
  });

  it('invite à créer une station avant un pompiste quand il n’y en a aucune', async () => {
    await ouvrirReferentiel();
    await userEvent.click(await screen.findByRole('button', { name: /stations/i }));

    expect(await screen.findByText(/avant de créer un pompiste/i)).toBeVisible();
  });

  it('résout la station d’un pompiste en son code, pas en identifiant', async () => {
    serveur
      .repond('GET /api/admin/stations', {
        corps: [{ id: 'st-1', code: 'DKR-07', nom: 'Liberté 6', ville: 'Dakar', statut: 'ACTIVE' }],
      })
      .repond('GET /api/admin/operators', {
        corps: [
          {
            id: 'o1',
            nom: 'Cheikh Ba',
            msisdn: '+221775551122',
            role: 'STATION_OPERATOR',
            stationId: 'st-1',
            statut: 'ACTIF',
          },
        ],
      });
    await ouvrirReferentiel();
    await userEvent.click(await screen.findByRole('button', { name: /opérateurs/i }));

    const ligne = (await screen.findByText('Cheikh Ba')).closest('tr');
    expect(within(ligne as HTMLElement).getByText('DKR-07')).toBeVisible();
    expect(within(ligne as HTMLElement).getByText('Pompiste')).toBeVisible();
  });
});

describe('cloisonnement', () => {
  it('un administrateur ne voit ni l’écran chauffeur ni celui du pompiste', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: /encours totalenergies/i });
    expect(screen.queryByText(/combien de carburant/i)).toBeNull();
    expect(screen.queryByText(/scannez le code/i)).toBeNull();
    expect(serveur.appelsVers('/api/bons')).toHaveLength(0);
  });
});
