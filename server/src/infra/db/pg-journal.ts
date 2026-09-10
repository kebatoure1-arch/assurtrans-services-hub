/**
 * Lecture du journal d'audit.
 *
 * Deux choix méritent d'être expliqués.
 *
 * **Pagination par clé, pas par décalage.** Un `OFFSET` sur une table qui grossit pendant la
 * lecture saute ou répète des lignes. Sur un journal d'audit, une ligne sautée est une ligne
 * qu'on ne verra jamais — et c'est précisément celle qu'on cherchait. `id` étant un `BIGSERIAL`
 * monotone, `WHERE id < curseur ORDER BY id DESC` donne une pagination stable quoi qu'il
 * arrive en écriture pendant qu'on lit.
 *
 * **Le nom de l'acteur est résolu à la lecture, jamais stocké.** Le journal enregistre un
 * identifiant ; y écrire aussi le nom figerait une donnée personnelle dans une table qu'on ne
 * peut plus modifier, et qui se conserve longtemps. On joint donc au référentiel au moment
 * d'afficher : si le compte a été supprimé, l'identifiant reste et le nom manque — ce qui est
 * la bonne réponse, pas une anomalie.
 */

import type {
  EvenementJournal,
  FiltreJournal,
  JournalAudit,
  PageJournal,
} from '../../ports/journal.ts';
import type { SqlExecutor } from './sql-executor.ts';

function texte(v: unknown): string {
  return typeof v === 'string' ? v : String(v);
}

function texteOuNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function instant(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return texte(v);
}

export class PgJournalAudit implements JournalAudit {
  constructor(private readonly db: SqlExecutor) {}

  async consulter(
    filtre: FiltreJournal,
    curseur: string | null,
    limite: number,
  ): Promise<PageJournal> {
    // On demande une ligne de plus que la limite : sa présence dit qu'il y a une suite, sans
    // avoir à compter la table entière à chaque page.
    const parPage = Math.min(Math.max(limite, 1), 200);

    const r = await this.db.query(
      `SELECT e.id, e.ts, e.actor, e.action, e.target_type, e.target_id, e.payload_hash,
              COALESCE(o.nom, d.nom) AS acteur_nom
         FROM audit_events e
         LEFT JOIN operateurs o ON o.id::text = e.actor
         LEFT JOIN drivers    d ON d.id::text = e.actor
        WHERE ($1::bigint IS NULL OR e.id < $1::bigint)
          AND ($2::text   IS NULL OR e.action = $2::text)
          AND ($3::text   IS NULL OR e.actor = $3::text)
          AND ($4::text   IS NULL OR e.target_id = $4::text)
          AND ($5::date   IS NULL OR e.ts >= $5::date)
          AND ($6::date   IS NULL OR e.ts < ($6::date + interval '1 day'))
        ORDER BY e.id DESC
        LIMIT $7`,
      [
        curseur,
        filtre.action ?? null,
        filtre.acteur ?? null,
        filtre.cibleId ?? null,
        filtre.depuis ?? null,
        filtre.jusqua ?? null,
        parPage + 1,
      ],
    );

    const lignes = r.rows.slice(0, parPage);
    const ilYASuite = r.rows.length > parPage;

    return {
      evenements: lignes.map(
        (l): EvenementJournal => ({
          id: texte(l.id),
          ts: instant(l.ts),
          acteur: texte(l.actor),
          acteurNom: texteOuNull(l.acteur_nom),
          action: texte(l.action),
          cibleType: texte(l.target_type),
          cibleId: texte(l.target_id),
          empreinte: texte(l.payload_hash),
        }),
      ),
      curseurSuivant: ilYASuite && lignes.length > 0 ? texte(lignes[lignes.length - 1].id) : null,
    };
  }

  /**
   * Actions réellement présentes, et non une liste écrite en dur.
   *
   * Une liste figée dans le code proposerait des filtres qui ne rendent rien, et manquerait
   * les actions ajoutées depuis. Celle-ci ne peut pas mentir.
   */
  async actionsConnues(): Promise<readonly string[]> {
    const r = await this.db.query(
      `SELECT DISTINCT action FROM audit_events ORDER BY action ASC`,
    );
    return r.rows.map((l) => texte(l.action));
  }
}
