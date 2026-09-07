/**
 * Cas d'usage : l'état du système en une lecture.
 *
 * C'est ici que le moteur d'encours devient enfin atteignable. Il était écrit et testé depuis
 * le début, mais aucune route ne le rejoignait.
 *
 * Ce que le tableau de bord cherche à répondre, et qui n'est pas « combien avons-nous en
 * caisse » : **à quelle date l'encours atteint le seuil au-delà duquel TotalEnergies peut
 * suspendre les cartes, au rythme de consommation observé.** Le solde Wave, lui, ne dit rien
 * d'utile : il varie avec les encaissements du jour.
 *
 * Une distinction structure la lecture et mérite d'être tenue :
 *
 *   - **l'encours** est ce que TotalEnergies peut réclamer : du carburant tiré mais pas encore
 *     facturé, plus des factures échues impayées ;
 *   - **les bons en circulation** sont un engagement pris envers des chauffeurs, dont le
 *     carburant n'est pas encore tiré. Les compter dans l'encours gonflerait la dette ; les
 *     taire masquerait un engagement.
 *
 * Ils sont donc rendus séparément.
 */

import { evaluateCreditLine, projectBlockingDate, type CreditLineState, type Projection } from '../../domain/credit-line.ts';
import type { XOF } from '../../domain/money.ts';
import type {
  ActiviteDuJour,
  ContratRepository,
  ContratTe,
  Incident,
  PilotageRepository,
} from '../../ports/admin.ts';

export type Avertissement = 'CONTRAT_TE_ABSENT' | 'REGLEMENT_EN_DRY_RUN';

export interface EtatPilotage {
  readonly contrat: ContratTe | null;
  readonly encours: CreditLineState | null;
  readonly projection: Projection | null;
  readonly bonsEnCirculation: XOF;
  readonly activite: ActiviteDuJour;
  readonly incidents: readonly Incident[];
  readonly avertissements: readonly Avertissement[];
  readonly arreteA: string;
}

export interface TableauDeBordDeps {
  readonly contrats: ContratRepository;
  readonly pilotage: PilotageRepository;
  readonly horloge: () => string;
  readonly entityId: string;
  /** Largeur de la fenêtre d'observation de la consommation, en jours. */
  readonly fenetreJours: number;
}

const JOUR_MS = 86_400_000;

const ORDRE_GRAVITE = { CRITIQUE: 0, ATTENTION: 1 } as const;

export class TableauDeBord {
  constructor(private readonly deps: TableauDeBordDeps) {}

  async etat(): Promise<EtatPilotage> {
    const maintenant = this.deps.horloge();
    const avertissements: Avertissement[] = [];

    const contrat = await this.deps.contrats.courant(this.deps.entityId);
    if (contrat === null) avertissements.push('CONTRAT_TE_ABSENT');
    if (contrat !== null && contrat.canalReglement === 'DRY_RUN') {
      avertissements.push('REGLEMENT_EN_DRY_RUN');
    }

    const debutDuJour = `${maintenant.slice(0, 10)}T00:00:00.000Z`;
    const debutFenetre = new Date(
      Date.parse(maintenant) - this.deps.fenetreJours * JOUR_MS,
    ).toISOString();

    const [bonsEnCirculation, activite, incidents] = await Promise.all([
      this.deps.pilotage.bonsEnCirculation(),
      this.deps.pilotage.activiteDuJour(debutDuJour),
      this.deps.pilotage.incidents(),
    ]);

    let encours: CreditLineState | null = null;
    let projection: Projection | null = null;

    if (contrat !== null) {
      // Deux mesures distinctes : ce qui est dû, et à quelle vitesse cela monte.
      const [nonFacturee, surFenetre, impayees] = await Promise.all([
        this.deps.pilotage.consommationNonFacturee(contrat.id),
        this.deps.pilotage.consommationSurFenetre(contrat.id, debutFenetre),
        this.deps.pilotage.facturesEchuesImpayees(contrat.id),
      ]);

      encours = evaluateCreditLine({
        encoursAutorise: contrat.encoursAutorise,
        seuilAlertePct: contrat.seuilAlertePct,
        seuilBlocagePct: contrat.seuilBlocagePct,
        consommationNonFacturee: nonFacturee,
        facturesEchuesImpayees: impayees,
      });

      projection = projectBlockingDate({
        etat: encours,
        consommationFenetreXof: surFenetre,
        fenetreJours: this.deps.fenetreJours,
        asOf: maintenant.slice(0, 10),
      });
    }

    return {
      contrat,
      encours,
      projection,
      bonsEnCirculation,
      activite,
      incidents: [...incidents].sort(
        (a, b) => ORDRE_GRAVITE[a.gravite] - ORDRE_GRAVITE[b.gravite],
      ),
      avertissements,
      arreteA: maintenant,
    };
  }
}


