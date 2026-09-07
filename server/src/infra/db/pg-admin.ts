/**
 * Dépôts PostgreSQL du côté administration.
 *
 * Une approximation assumée, à lever quand l'import du relevé TotalEnergies existera : le
 * carburant réellement tiré n'est pas encore connu de nous. On prend pour mesure les **bons
 * consommés**, ce qui est le meilleur signal disponible — un bon consommé correspond à un plein
 * servi. L'écart avec la facture réelle se verra au rapprochement, et c'est précisément son
 * rôle. La méthode le dit plutôt que de laisser croire à une donnée d'origine TotalEnergies.
 */

import { randomUUID } from 'node:crypto';
import { type XOF, xof } from '../../domain/money.ts';
import type {
  ActiviteDuJour,
  ContratRepository,
  ContratTe,
  DirectoryRepository,
  FicheChauffeur,
  FicheEntite,
  FicheOperateur,
  FicheStation,
  Incident,
  PilotageRepository,
  StatutFiche,
} from '../../ports/admin.ts';
import type { ApiRole } from '../auth/api-tokens.ts';
import type { SqlExecutor } from './sql-executor.ts';

function texte(v: unknown): string {
  return typeof v === 'string' ? v : String(v);
}

function texteOuNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Les BIGINT arrivent en chaîne. Un montant décimal est refusé, jamais arrondi. */
function montant(v: unknown): XOF {
  if (v === null || v === undefined) return xof(0);
  if (typeof v === 'number') return xof(v);
  const brut = String(v);
  if (!/^-?\d+$/.test(brut)) {
    throw new Error(`montant non entier lu en base : « ${brut} »`);
  }
  return xof(Math.max(0, Number(brut)));
}

function entier(v: unknown): number {
  return Number(v ?? 0);
}

// ---------------------------------------------------------------- référentiel

export class PgDirectoryRepository implements DirectoryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async creerEntite(fiche: FicheEntite): Promise<void> {
    await this.db.query(
      `INSERT INTO entities (id, raison_sociale, ninea, rccm) VALUES ($1, $2, $3, $4)`,
      [fiche.id, fiche.raisonSociale, fiche.ninea, fiche.rccm],
    );
  }

  async listerChauffeurs(): Promise<readonly FicheChauffeur[]> {
    const r = await this.db.query(
      `SELECT id, nom, msisdn, statut FROM drivers ORDER BY nom`,
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      nom: texte(l.nom),
      msisdn: texte(l.msisdn),
      statut: texte(l.statut) as StatutFiche,
    }));
  }

  async listerStations(): Promise<readonly FicheStation[]> {
    const r = await this.db.query(
      `SELECT id, code, nom, ville, statut FROM stations ORDER BY code`,
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      code: texte(l.code),
      nom: texte(l.nom),
      ville: texteOuNull(l.ville),
      statut: texte(l.statut) as FicheStation['statut'],
    }));
  }

  async listerOperateurs(): Promise<readonly FicheOperateur[]> {
    const r = await this.db.query(
      `SELECT id, nom, msisdn, role, station_id, statut FROM operateurs ORDER BY nom`,
    );
    return r.rows.map((l) => ({
      id: texte(l.id),
      nom: texte(l.nom),
      msisdn: texte(l.msisdn),
      role: texte(l.role) as ApiRole,
      stationId: texteOuNull(l.station_id),
      statut: texte(l.statut) as StatutFiche,
    }));
  }

  /** Un numéro n'appartient qu'à une personne, chauffeurs et opérateurs confondus. */
  async numeroLibre(msisdn: string): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1
         FROM (SELECT msisdn FROM drivers UNION ALL SELECT msisdn FROM operateurs) AS tous
        WHERE msisdn = $1
        LIMIT 1`,
      [msisdn],
    );
    return r.rows.length === 0;
  }

  async trouverStation(id: string): Promise<FicheStation | null> {
    const r = await this.db.query(
      `SELECT id, code, nom, ville, statut FROM stations WHERE id = $1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    const l = r.rows[0];
    return {
      id: texte(l.id),
      code: texte(l.code),
      nom: texte(l.nom),
      ville: texteOuNull(l.ville),
      statut: texte(l.statut) as FicheStation['statut'],
    };
  }

  async creerChauffeur(fiche: FicheChauffeur, entityId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO drivers (id, entity_id, nom, msisdn, statut) VALUES ($1, $2, $3, $4, $5)`,
      [fiche.id, entityId, fiche.nom, fiche.msisdn, fiche.statut],
    );
  }

  async creerStation(fiche: FicheStation): Promise<void> {
    await this.db.query(
      `INSERT INTO stations (id, code, nom, ville, statut) VALUES ($1, $2, $3, $4, $5)`,
      [fiche.id, fiche.code, fiche.nom, fiche.ville, fiche.statut],
    );
  }

  async creerOperateur(fiche: FicheOperateur): Promise<void> {
    await this.db.query(
      `INSERT INTO operateurs (id, nom, msisdn, role, station_id, statut)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fiche.id, fiche.nom, fiche.msisdn, fiche.role, fiche.stationId, fiche.statut],
    );
  }

  async changerStatutChauffeur(id: string, statut: StatutFiche): Promise<boolean> {
    const r = await this.db.query(`UPDATE drivers SET statut = $2 WHERE id = $1`, [id, statut]);
    return r.rowCount > 0;
  }

  async changerStatutOperateur(id: string, statut: StatutFiche): Promise<boolean> {
    const r = await this.db.query(`UPDATE operateurs SET statut = $2 WHERE id = $1`, [id, statut]);
    return r.rowCount > 0;
  }
}

// ---------------------------------------------------------------- contrat

export class PgContratRepository implements ContratRepository {
  constructor(private readonly db: SqlExecutor) {}

  async courant(entityId: string): Promise<ContratTe | null> {
    const r = await this.db.query(
      `SELECT id, numero_compte_te, encours_autorise, delai_reglement_jours,
              seuil_alerte_pct, seuil_blocage_pct, canal_reglement
         FROM te_contracts
        WHERE entity_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [entityId],
    );
    if (r.rows.length === 0) return null;

    const l = r.rows[0];
    return {
      id: texte(l.id),
      numeroCompte: texte(l.numero_compte_te),
      encoursAutorise: montant(l.encours_autorise),
      delaiReglementJours: entier(l.delai_reglement_jours),
      seuilAlertePct: entier(l.seuil_alerte_pct),
      seuilBlocagePct: entier(l.seuil_blocage_pct),
      canalReglement: texte(l.canal_reglement) as ContratTe['canalReglement'],
    };
  }
}

// ---------------------------------------------------------------- pilotage

export class PgPilotageRepository implements PilotageRepository {
  constructor(private readonly db: SqlExecutor) {}

  /**
   * Carburant servi depuis la dernière facture émise sur ce contrat.
   *
   * Faute d'import du relevé TotalEnergies, la mesure est celle des bons consommés. C'est un
   * substitut, pas la donnée du fournisseur.
   */
  async consommationNonFacturee(contractId: string): Promise<XOF> {
    const r = await this.db.query(
      `SELECT COALESCE(SUM(v.montant_xof), 0) AS total
         FROM fuel_vouchers v
        WHERE v.statut = 'CONSOMME'
          AND v.consomme_a > COALESCE(
                (SELECT MAX(i.periode_fin) FROM invoices i WHERE i.contract_id = $1),
                '-infinity'::timestamptz)`,
      [contractId],
    );
    return montant(r.rows[0]?.total);
  }

  async consommationSurFenetre(contractId: string, depuis: string): Promise<XOF> {
    void contractId;
    const r = await this.db.query(
      `SELECT COALESCE(SUM(montant_xof), 0) AS total
         FROM fuel_vouchers
        WHERE statut = 'CONSOMME' AND consomme_a >= $1`,
      [depuis],
    );
    return montant(r.rows[0]?.total);
  }

  /** Bons payés, pas encore servis, pas encore périmés : un engagement en cours. */
  async bonsEnCirculation(): Promise<XOF> {
    const r = await this.db.query(
      `SELECT COALESCE(SUM(montant_xof), 0) AS total
         FROM fuel_vouchers
        WHERE statut = 'EMIS' AND expire_a > now()`,
    );
    return montant(r.rows[0]?.total);
  }

  async facturesEchuesImpayees(contractId: string): Promise<XOF> {
    const r = await this.db.query(
      `SELECT COALESCE(SUM(montant_xof), 0) AS total
         FROM invoices
        WHERE contract_id = $1
          AND date_echeance < now()
          AND statut NOT IN ('REGLEE', 'LETTREE')`,
      [contractId],
    );
    return montant(r.rows[0]?.total);
  }

  async activiteDuJour(depuis: string): Promise<ActiviteDuJour> {
    const r = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE emis_a >= $1)                             AS nb_emis,
         COALESCE(SUM(montant_xof) FILTER (WHERE emis_a >= $1), 0)        AS montant_emis,
         COUNT(*) FILTER (WHERE consomme_a >= $1)                         AS nb_consommes,
         COALESCE(SUM(montant_xof) FILTER (WHERE consomme_a >= $1), 0)    AS montant_consomme
       FROM fuel_vouchers`,
      [depuis],
    );
    const l = r.rows[0] ?? {};
    return {
      bonsEmis: entier(l.nb_emis),
      montantEmis: montant(l.montant_emis),
      bonsConsommes: entier(l.nb_consommes),
      montantConsomme: montant(l.montant_consomme),
    };
  }

  /**
   * Ce qui demande une décision humaine.
   *
   * Un règlement en revue est critique : de l'argent est peut-être parti sans qu'on le sache.
   * Un QR non envoyé est sérieux mais rattrapable : le chauffeur a payé, son bon existe, il
   * suffit de le lui renvoyer.
   */
  async incidents(): Promise<readonly Incident[]> {
    const r = await this.db.query(
      `SELECT 'REGLEMENT_EN_REVUE' AS type, COUNT(*)::int AS n
         FROM payment_intents WHERE statut = 'NEEDS_REVIEW'
       UNION ALL
       SELECT 'ECART_RAPPROCHEMENT', COUNT(*)::int
         FROM reconciliations WHERE statut <> 'MATCHED' AND resolu_at IS NULL
       UNION ALL
       SELECT 'ENVOI_QR_ECHOUE', COUNT(*)::int
         FROM voucher_deliveries WHERE statut = 'ECHEC'`,
    );

    const libelles: Record<string, { libelle: string; gravite: Incident['gravite'] }> = {
      REGLEMENT_EN_REVUE: {
        libelle: 'Règlement en revue : sort des fonds indéterminé',
        gravite: 'CRITIQUE',
      },
      ECART_RAPPROCHEMENT: {
        libelle: 'Écart de rapprochement non résolu',
        gravite: 'CRITIQUE',
      },
      ENVOI_QR_ECHOUE: {
        libelle: 'QR non parvenus au chauffeur',
        gravite: 'ATTENTION',
      },
    };

    return r.rows
      .map((l) => ({ type: texte(l.type), nombre: entier(l.n) }))
      .filter((i) => i.nombre > 0)
      .map((i) => ({
        type: i.type,
        nombre: i.nombre,
        gravite: libelles[i.type]?.gravite ?? 'ATTENTION',
        libelle: libelles[i.type]?.libelle ?? i.type,
      }));
  }
}

/** Identifiants des fiches créées. Injecté pour que les tests restent déterministes. */
export const idsAleatoires = { next: () => randomUUID() };
