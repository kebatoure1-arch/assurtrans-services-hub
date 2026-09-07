import { describe, expect, it } from 'vitest';
import { xof } from '../src/domain/money.ts';
import { TableauDeBord } from '../src/application/admin/tableau-de-bord.ts';
import type {
  ActiviteDuJour,
  ContratRepository,
  ContratTe,
  Incident,
  PilotageRepository,
} from '../src/ports/admin.ts';

const MAINTENANT = '2026-09-07T09:00:00.000Z';
const ENTITE = 'entite-1';

const CONTRAT: ContratTe = {
  id: 'contrat-1',
  numeroCompte: 'TE-4471',
  encoursAutorise: xof(10_000_000),
  delaiReglementJours: 30,
  seuilAlertePct: 70,
  seuilBlocagePct: 90,
  canalReglement: 'DRY_RUN',
};

function contrats(contrat: ContratTe | null = CONTRAT): ContratRepository {
  return { async courant() { return contrat; } };
}

interface ChiffresFactices {
  nonFacturee?: number;
  surFenetre?: number;
  circulation?: number;
  impayees?: number;
  activite?: ActiviteDuJour;
  incidents?: readonly Incident[];
}

function pilotage(c: ChiffresFactices = {}): PilotageRepository {
  return {
    async consommationNonFacturee() {
      return xof(c.nonFacturee ?? 0);
    },
    async consommationSurFenetre() {
      return xof(c.surFenetre ?? 0);
    },
    async bonsEnCirculation() {
      return xof(c.circulation ?? 0);
    },
    async facturesEchuesImpayees() {
      return xof(c.impayees ?? 0);
    },
    async activiteDuJour() {
      return (
        c.activite ?? {
          bonsEmis: 0,
          montantEmis: xof(0),
          bonsConsommes: 0,
          montantConsomme: xof(0),
        }
      );
    },
    async incidents() {
      return c.incidents ?? [];
    },
  };
}

function bord(chiffres: ChiffresFactices = {}, contrat: ContratTe | null = CONTRAT) {
  return new TableauDeBord({
    contrats: contrats(contrat),
    pilotage: pilotage(chiffres),
    horloge: () => MAINTENANT,
    entityId: ENTITE,
    fenetreJours: 30,
  });
}

describe('encours', () => {
  it('distingue la dette du rythme : un mois sans facture ne change pas la vitesse', async () => {
    // La consommation non facturee grossit, la consommation de la fenetre ne bouge pas.
    const etat = await bord({ nonFacturee: 8_000_000, surFenetre: 1_000_000 }).etat();

    expect(etat.encours?.encoursCourant).toBe(8_000_000);
    // Manque 1 000 000 pour atteindre 9 000 000, au rythme de 1 000 000 sur 30 jours.
    expect(etat.projection?.joursRestants).toBe(30);
  });

  it('additionne la consommation non facturée et les factures échues impayées', async () => {
    const etat = await bord({ nonFacturee: 2_000_000, impayees: 1_500_000 }).etat();

    expect(etat.encours?.encoursCourant).toBe(3_500_000);
    expect(etat.encours?.disponible).toBe(6_500_000);
    expect(etat.encours?.utilisationPct).toBe(35);
    expect(etat.encours?.niveau).toBe('NORMAL');
  });

  it('projette la date d’atteinte du seuil de blocage au rythme observé', async () => {
    // Encours 5 000 000, seuil de blocage 9 000 000, manque 4 000 000.
    // Rythme observé : 3 000 000 sur 30 jours, soit 40 jours pour combler 4 000 000.
    const etat = await bord({ nonFacturee: 5_000_000, surFenetre: 3_000_000 }).etat();

    expect(etat.projection?.joursRestants).toBe(40);
    expect(etat.projection?.date).toBe('2026-10-17');
    expect(etat.projection?.raison).toBe('PROJETE');
  });

  it('ne projette rien quand la consommation est nulle, sans diviser par zéro', async () => {
    const etat = await bord({ nonFacturee: 1_000_000, surFenetre: 0 }).etat();
    expect(etat.projection?.raison).toBe('CONSOMMATION_NULLE');
    expect(etat.projection?.date).toBeNull();
  });

  it('signale un seuil déjà atteint sans rendre de nombre négatif', async () => {
    const etat = await bord({ nonFacturee: 9_500_000, surFenetre: 3_000_000 }).etat();
    expect(etat.encours?.niveau).toBe('BLOCAGE');
    expect(etat.projection?.joursRestants).toBe(0);
  });
});

describe('bons en circulation', () => {
  it('sont comptés à part de l’encours : le carburant n’est pas encore tiré', async () => {
    const etat = await bord({ nonFacturee: 2_000_000, circulation: 800_000 }).etat();

    // TotalEnergies n'a rien facturé pour un bon qui n'a pas encore servi. Le montrer dans
    // l'encours gonflerait artificiellement la dette ; l'ignorer masquerait un engagement pris.
    expect(etat.encours?.encoursCourant).toBe(2_000_000);
    expect(etat.bonsEnCirculation).toBe(800_000);
  });
});

describe('activité et incidents', () => {
  it('rend les chiffres du jour', async () => {
    const etat = await bord({
      activite: {
        bonsEmis: 14,
        montantEmis: xof(230_000),
        bonsConsommes: 11,
        montantConsomme: xof(185_000),
      },
    }).etat();

    expect(etat.activite.bonsEmis).toBe(14);
    expect(etat.activite.montantConsomme).toBe(185_000);
  });

  it('remonte les incidents les plus graves en premier', async () => {
    const etat = await bord({
      incidents: [
        { type: 'ENVOI_ECHOUE', gravite: 'ATTENTION', nombre: 2, libelle: 'QR non envoyés' },
        { type: 'REGLEMENT_EN_REVUE', gravite: 'CRITIQUE', nombre: 1, libelle: 'Règlement en revue' },
      ],
    }).etat();

    expect(etat.incidents.map((i) => i.gravite)).toEqual(['CRITIQUE', 'ATTENTION']);
  });
});

describe('sans contrat TotalEnergies', () => {
  it('rend un état exploitable plutôt que d’échouer', async () => {
    // Un compte TotalEnergies pas encore saisi est une situation normale au démarrage.
    // Le reste du tableau de bord doit rester lisible.
    const etat = await bord({ activite: { bonsEmis: 3, montantEmis: xof(50_000), bonsConsommes: 1, montantConsomme: xof(20_000) } }, null).etat();

    expect(etat.contrat).toBeNull();
    expect(etat.encours).toBeNull();
    expect(etat.projection).toBeNull();
    expect(etat.activite.bonsEmis).toBe(3);
    expect(etat.avertissements).toContain('CONTRAT_TE_ABSENT');
  });
});

describe('canal de règlement', () => {
  it('signale que le règlement tourne à blanc', async () => {
    const etat = await bord().etat();
    expect(etat.contrat?.canalReglement).toBe('DRY_RUN');
    expect(etat.avertissements).toContain('REGLEMENT_EN_DRY_RUN');
  });

  it('ne le signale plus une fois le canal réel configuré', async () => {
    const etat = await bord({}, { ...CONTRAT, canalReglement: 'B2B' }).etat();
    expect(etat.avertissements).not.toContain('REGLEMENT_EN_DRY_RUN');
  });
});
