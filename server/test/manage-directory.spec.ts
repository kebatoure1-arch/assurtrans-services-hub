import { beforeEach, describe, expect, it } from 'vitest';
import {
  ManageDirectory,
  NumeroDejaUtiliseError,
  ReferentielRefuseError,
} from '../src/application/admin/manage-directory.ts';
import { InMemoryAuditLogger } from '../src/infra/audit/audit-logger.ts';
import type {
  DirectoryRepository,
  FicheChauffeur,
  FicheEntite,
  FicheOperateur,
  FicheStation,
} from '../src/ports/admin.ts';

class Annuaire implements DirectoryRepository {
  entites: FicheEntite[] = [];
  rattachements = new Map<string, string>();
  chauffeurs: FicheChauffeur[] = [];
  stations: FicheStation[] = [];
  operateurs: FicheOperateur[] = [];

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
  async creerEntite(f: FicheEntite) {
    this.entites.push(f);
  }
  async creerChauffeur(f: FicheChauffeur, entityId: string) {
    this.chauffeurs.push(f);
    this.rattachements.set(f.id, entityId);
  }
  async creerStation(f: FicheStation) {
    this.stations.push(f);
  }
  async creerOperateur(f: FicheOperateur) {
    this.operateurs.push(f);
  }
  async changerStatutChauffeur(id: string, statut: FicheChauffeur['statut']) {
    const i = this.chauffeurs.findIndex((c) => c.id === id);
    if (i < 0) return false;
    this.chauffeurs[i] = { ...this.chauffeurs[i], statut };
    return true;
  }
  async changerStatutOperateur(id: string, statut: FicheOperateur['statut']) {
    const i = this.operateurs.findIndex((o) => o.id === id);
    if (i < 0) return false;
    this.operateurs[i] = { ...this.operateurs[i], statut };
    return true;
  }
  async trouverStation(id: string) {
    return this.stations.find((s) => s.id === id) ?? null;
  }
}

function compteur() {
  let n = 0;
  return { next: () => `id-${(n += 1)}` };
}

const ADMIN = 'admin-1';
const ENTITE = 'entite-1';

let annuaire: Annuaire;
let audit: InMemoryAuditLogger;
let referentiel: ManageDirectory;

beforeEach(() => {
  annuaire = new Annuaire();
  audit = new InMemoryAuditLogger();
  referentiel = new ManageDirectory({ annuaire, audit, ids: compteur(), entityId: ENTITE });
});

describe('chauffeurs', () => {
  it('crée un chauffeur et normalise son numéro', async () => {
    const c = await referentiel.creerChauffeur({ nom: 'Moussa Ndiaye', telephone: '77 000 00 01' }, ADMIN);

    expect(c.msisdn).toBe('+221770000001');
    expect(c.statut).toBe('ACTIF');
    expect(annuaire.chauffeurs).toHaveLength(1);
    // Rattache a l'entite du deploiement quand l'appelant n'en precise pas.
    expect(annuaire.rattachements.get(c.id)).toBe(ENTITE);
  });

  it('refuse un numéro déjà utilisé, et dit par qui', async () => {
    await referentiel.creerChauffeur({ nom: 'Moussa', telephone: '770000001' }, ADMIN);

    await expect(
      referentiel.creerChauffeur({ nom: 'Autre', telephone: '+221 77 000 00 01' }, ADMIN),
    ).rejects.toThrow(NumeroDejaUtiliseError);
    expect(annuaire.chauffeurs).toHaveLength(1);
  });

  it('refuse un numéro inexploitable', async () => {
    await expect(
      referentiel.creerChauffeur({ nom: 'Moussa', telephone: 'abc' }, ADMIN),
    ).rejects.toThrow(/inexploitable/);
  });

  it('refuse un nom vide', async () => {
    await expect(
      referentiel.creerChauffeur({ nom: '   ', telephone: '770000001' }, ADMIN),
    ).rejects.toThrow(ReferentielRefuseError);
  });

  it('suspend un chauffeur, puis le réactive', async () => {
    const c = await referentiel.creerChauffeur({ nom: 'Moussa', telephone: '770000001' }, ADMIN);

    await referentiel.changerStatutChauffeur(c.id, 'SUSPENDU', ADMIN, 'impayé');
    expect(annuaire.chauffeurs[0].statut).toBe('SUSPENDU');

    await referentiel.changerStatutChauffeur(c.id, 'ACTIF', ADMIN, 'régularisé');
    expect(annuaire.chauffeurs[0].statut).toBe('ACTIF');
  });

  it('exige un motif pour suspendre', async () => {
    const c = await referentiel.creerChauffeur({ nom: 'Moussa', telephone: '770000001' }, ADMIN);
    await expect(referentiel.changerStatutChauffeur(c.id, 'SUSPENDU', ADMIN, '')).rejects.toThrow(
      /motif/i,
    );
  });

  it('signale un chauffeur introuvable plutôt que de réussir en silence', async () => {
    await expect(
      referentiel.changerStatutChauffeur('inconnu', 'SUSPENDU', ADMIN, 'x'),
    ).rejects.toThrow(/introuvable/);
  });
});

describe('entites', () => {
  it('crée une entité et trace sa création', async () => {
    const e = await referentiel.creerEntite({ raisonSociale: "Assur'Trans SARL" }, ADMIN);
    expect(e.raisonSociale).toBe("Assur'Trans SARL");
    expect(audit.evenements[0].action).toBe('ENTITE_CREEE');
  });

  it('refuse une raison sociale vide', async () => {
    await expect(referentiel.creerEntite({ raisonSociale: '  ' }, ADMIN)).rejects.toThrow(
      ReferentielRefuseError,
    );
  });
});

describe('stations', () => {
  it('crée une station', async () => {
    const s = await referentiel.creerStation({ code: 'ST-3', nom: 'Dakar 3', ville: 'Dakar' }, ADMIN);
    expect(s.code).toBe('ST-3');
    expect(annuaire.stations).toHaveLength(1);
  });

  it('refuse un code de station vide', async () => {
    await expect(referentiel.creerStation({ code: '', nom: 'X' }, ADMIN)).rejects.toThrow(
      ReferentielRefuseError,
    );
  });
});

describe('opérateurs', () => {
  async function station() {
    return referentiel.creerStation({ code: 'ST-3', nom: 'Dakar 3' }, ADMIN);
  }

  it('crée un pompiste rattaché à sa station', async () => {
    const s = await station();
    const o = await referentiel.creerOperateur(
      { nom: 'Fatou Sow', telephone: '770000002', role: 'STATION_OPERATOR', stationId: s.id },
      ADMIN,
    );

    expect(o.role).toBe('STATION_OPERATOR');
    expect(o.stationId).toBe(s.id);
  });

  it('refuse un pompiste sans station : il ne servirait au nom de personne', async () => {
    await expect(
      referentiel.creerOperateur(
        { nom: 'Fatou', telephone: '770000002', role: 'STATION_OPERATOR', stationId: null },
        ADMIN,
      ),
    ).rejects.toThrow(/station/i);
  });

  it('refuse un pompiste rattaché à une station inconnue', async () => {
    await expect(
      referentiel.creerOperateur(
        { nom: 'Fatou', telephone: '770000002', role: 'STATION_OPERATOR', stationId: 'inconnue' },
        ADMIN,
      ),
    ).rejects.toThrow(/station/i);
  });

  it('crée un administrateur, sans station', async () => {
    const o = await referentiel.creerOperateur(
      { nom: 'Awa Fall', telephone: '770000003', role: 'ADMIN', stationId: null },
      ADMIN,
    );
    expect(o.stationId).toBeNull();
  });

  it('refuse de créer un opérateur avec le rôle chauffeur', async () => {
    await expect(
      referentiel.creerOperateur(
        { nom: 'X', telephone: '770000004', role: 'DRIVER', stationId: null },
        ADMIN,
      ),
    ).rejects.toThrow(ReferentielRefuseError);
  });

  it('refuse un numéro déjà porté par un chauffeur', async () => {
    await referentiel.creerChauffeur({ nom: 'Moussa', telephone: '770000001' }, ADMIN);
    await expect(
      referentiel.creerOperateur(
        { nom: 'Fatou', telephone: '770000001', role: 'ADMIN', stationId: null },
        ADMIN,
      ),
    ).rejects.toThrow(NumeroDejaUtiliseError);
  });
});

describe('trace', () => {
  it('chaque mutation laisse une trace nommant son auteur', async () => {
    const c = await referentiel.creerChauffeur({ nom: 'Moussa', telephone: '770000001' }, ADMIN);
    await referentiel.changerStatutChauffeur(c.id, 'SUSPENDU', 'admin-2', 'impayé');

    expect(audit.evenements.map((e) => e.action)).toEqual(['CHAUFFEUR_CREE', 'CHAUFFEUR_SUSPENDU']);
    expect(audit.evenements[0].actor).toBe(ADMIN);
    expect(audit.evenements[1].actor).toBe('admin-2');
    expect(audit.evenements[1].targetId).toBe(c.id);
  });

  it('une tentative refusée ne laisse pas de trace de réussite', async () => {
    await referentiel
      .creerChauffeur({ nom: '', telephone: '770000001' }, ADMIN)
      .catch(() => undefined);
    expect(audit.evenements).toHaveLength(0);
  });
});
