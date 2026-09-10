/**
 * Écran du rapprochement à trois voies.
 *
 * Il répond à une seule question : **l'argent parti du portefeuille correspond-il à ce qu'on
 * devait ?** Trois sources, une confrontation, et une liste de ce qui ne colle pas.
 *
 * Trois choix de présentation.
 *
 *  1. **Ce qui ne colle pas se lit en premier.** Un rapprochement où tout va bien n'a rien à
 *     dire ; celui où trois lignes clochent n'a que cela à dire. Les orphelins et les écarts
 *     sont en tête, le reste se déplie.
 *  2. **Un relevé vide se distingue d'un rapprochement raté.** Sans relevé, chaque règlement
 *     ressort en écart : exact, et parfaitement trompeur. L'écran dit l'étape manquante au lieu
 *     d'afficher douze fausses anomalies.
 *  3. **Résoudre demande d'écrire pourquoi.** La note n'est pas une formalité : c'est ce qui
 *     rend le journal relisible six mois plus tard, quand personne ne se souvient pourquoi cet
 *     écart de 1 200 francs était acceptable.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ErreurApi,
  ErreurReseau,
  api,
  type LigneRapprochement,
  type MouvementReleve,
  type ResumeRapprochement,
  type StatutRapprochement,
} from '../../lib/api.ts';
import { francs, jourEtHeure } from '../../lib/format.ts';
import { useSession } from '../../lib/session.tsx';

function message(cause: unknown): string {
  if (cause instanceof ErreurReseau) return 'Pas de connexion au serveur.';
  if (cause instanceof ErreurApi) return motifLisible(cause);
  return 'La demande n’a pas abouti.';
}

function motifLisible(erreur: ErreurApi): string {
  switch (erreur.code) {
    case 'RELEVE_VIDE':
      return (
        'Aucun mouvement au relevé pour cette période. Saisissez le relevé du portefeuille ' +
        'avant de rapprocher — sinon chaque règlement envoyé ressortira en écart.'
      );
    case 'NOTE_REQUISE':
      return 'Écrivez pourquoi cet écart est acceptable avant de le clore.';
    case 'DEJA_RESOLUE':
      return 'Quelqu’un a déjà tranché cette ligne. La liste vient d’être rechargée.';
    case 'MOUVEMENT_DEJA_SAISI':
      return 'Ce mouvement figure déjà au relevé.';
    default:
      return erreur.message;
  }
}

const ETATS: Record<StatutRapprochement, { libelle: string; ton: string }> = {
  MATCHED: { libelle: 'Lettré', ton: 'fini' },
  VARIANCE: { libelle: 'Écart', ton: 'grave' },
  ORPHAN: { libelle: 'Orphelin', ton: 'grave' },
};

/**
 * L'écart, en toutes lettres.
 *
 * Ici la convention est `constaté − attendu` : un écart négatif veut dire qu'on a réglé moins
 * que dû. C'est l'inverse de la convention du règlement, et c'est précisément pourquoi on écrit
 * la phrase plutôt que le nombre signé.
 */
function ecartLisible(ligne: LigneRapprochement): string | null {
  if (ligne.ecartXof === 0) return null;
  const manque = ligne.ecartXof < 0;
  const somme = francs(Math.abs(ligne.ecartXof));
  return manque ? `${somme} de moins que dû` : `${somme} de plus que dû`;
}

/** Le dernier jour du mois courant : la période qu'on arrête le plus souvent. */
function periodeParDefaut(): string {
  const maintenant = new Date();
  const dernier = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0);
  return dernier.toISOString().slice(0, 10);
}

function bornesDuMois(periode: string): { debut: string; fin: string } {
  return { debut: `${periode.slice(0, 7)}-01`, fin: periode };
}

export function Rapprochement() {
  const { session } = useSession();
  const jeton = session?.token ?? '';

  const [periode, setPeriode] = useState(periodeParDefaut());
  const [tolerance, setTolerance] = useState('0');
  const [lignes, setLignes] = useState<LigneRapprochement[]>([]);
  const [resume, setResume] = useState<ResumeRapprochement | null>(null);
  const [cycleBloque, setCycleBloque] = useState(false);
  const [releve, setReleve] = useState<MouvementReleve[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [toutAfficher, setToutAfficher] = useState(false);
  const [ouvrirSaisie, setOuvrirSaisie] = useState(false);

  /** Ligne dont on est en train d'écrire la résolution. */
  const [aResoudre, setAResoudre] = useState<LigneRapprochement | null>(null);
  const [note, setNote] = useState('');

  const [waveTxId, setWaveTxId] = useState('');
  const [dateTx, setDateTx] = useState('');
  const [sens, setSens] = useState<'IN' | 'OUT'>('OUT');
  const [montantXof, setMontantXof] = useState('');
  const [contrepartie, setContrepartie] = useState('');

  const charger = useCallback(async () => {
    try {
      const { debut, fin } = bornesDuMois(periode);
      const [r, m] = await Promise.all([
        api.rapprochement(jeton, periode),
        api.releve(jeton, debut, fin),
      ]);
      setLignes([...r.lignes]);
      setCycleBloque(r.cycleBloque);
      setReleve([...m]);
      setErreur(null);
    } catch (cause) {
      setErreur(message(cause));
    }
  }, [jeton, periode]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /**
   * Enveloppe commune. Le refus est posé APRÈS le rechargement : `charger` remet l'erreur à
   * null en réussissant, et le poser avant l'effacerait.
   */
  async function geste(action: () => Promise<unknown>) {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);

    let refus: string | null = null;
    try {
      await action();
    } catch (cause) {
      refus = message(cause);
    }
    await charger();
    setErreur(refus);
    setEnCours(false);
  }

  async function rapprocher() {
    const t = Number(tolerance);
    if (!Number.isInteger(t) || t < 0) {
      setErreur('La tolérance doit être un entier de francs, sans centime.');
      return;
    }
    await geste(async () => {
      setResume(await api.rapprocher(jeton, periode, t));
    });
  }

  async function resoudre(evt: React.FormEvent) {
    evt.preventDefault();
    const ligne = aResoudre;
    if (ligne === null) return;
    await geste(async () => {
      await api.resoudreEcart(jeton, ligne.id, note);
      setAResoudre(null);
      setNote('');
    });
  }

  async function ajouterAuReleve(evt: React.FormEvent) {
    evt.preventDefault();
    const montant = Number(montantXof);
    if (!Number.isInteger(montant) || montant <= 0) {
      setErreur('Le montant doit être un entier de francs, sans centime.');
      return;
    }
    await geste(async () => {
      await api.ajouterAuReleve(jeton, {
        waveTxId: waveTxId.trim(),
        dateTx: new Date(dateTx).toISOString(),
        sens,
        montantXof: montant,
        contrepartie: contrepartie.trim() === '' ? null : contrepartie.trim(),
      });
      setWaveTxId('');
      setDateTx('');
      setMontantXof('');
      setContrepartie('');
    });
  }

  const aTraiter = lignes.filter((l) => l.statut !== 'MATCHED' && l.resoluPar === null);
  const reste = lignes.filter((l) => l.statut === 'MATCHED' || l.resoluPar !== null);
  const visibles = toutAfficher ? lignes : aTraiter;
  const saisieValide = waveTxId.trim() !== '' && dateTx !== '' && montantXof !== '';

  return (
    <section className="reglement">
      {erreur !== null && <p className="message erreur">{erreur}</p>}

      {cycleBloque && (
        <p className="message erreur">
          <strong>Le cycle suivant est bloqué.</strong> Un écart ou un orphelin n’est pas résolu :
          aucun nouveau règlement ne peut être préparé tant qu’il reste. Ordonnancer par-dessus un
          mouvement de fonds qu’on ne s’explique pas, c’est empiler une seconde inconnue sur la
          première.
        </p>
      )}

      <div className="bloc">
        <div className="entete-bloc">
          <h2 className="titre-bloc">Rapprochement</h2>
          <button
            type="button"
            className="bouton-compact"
            disabled={enCours}
            onClick={() => void rapprocher()}
          >
            Rapprocher la période
          </button>
        </div>

        <form className="ajout" onSubmit={(e) => e.preventDefault()}>
          <label className="champ-court">
            <span>Arrêté au</span>
            <input type="date" value={periode} onChange={(e) => setPeriode(e.target.value)} />
          </label>
          <label className="champ-court">
            <span>Tolérance (FCFA)</span>
            <input
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
            />
            <span className="aide">Zéro sans justification écrite.</span>
          </label>
        </form>

        {resume !== null && (
          <div className="mesures">
            <div className="mesure">
              <span className="valeur">{resume.resume.matched}</span>
              <span className="appoint">lettrés</span>
            </div>
            <div className="mesure">
              <span className="valeur">{resume.resume.variance}</span>
              <span className="appoint">écarts</span>
            </div>
            <div className="mesure">
              <span className="valeur">{resume.resume.orphan}</span>
              <span className="appoint">orphelins</span>
            </div>
            <div className="mesure">
              <span className="valeur">{resume.resume.enAttente}</span>
              <span className="appoint">encore en vol</span>
            </div>
          </div>
        )}

        {resume !== null && !resume.integrite.toutesTransactionsClassees && (
          <p className="message erreur">
            <strong>Rapprochement incomplet.</strong>{' '}
            {resume.integrite.transactionsNonClassees.length} mouvement(s) du relevé n’ont reçu
            aucune ligne. Aucun état silencieux n’est admis : ce rapprochement ne fait pas foi.
          </p>
        )}
      </div>

      <div className="bloc">
        <div className="entete-bloc">
          <h2 className="titre-bloc">
            {aTraiter.length > 0 ? `${aTraiter.length} ligne(s) à traiter` : 'Rien à traiter'}
          </h2>
          {reste.length > 0 && (
            <button
              type="button"
              className="bouton-compact"
              onClick={() => setToutAfficher(!toutAfficher)}
            >
              {toutAfficher ? 'Masquer les lignes réglées' : `Voir tout (${lignes.length})`}
            </button>
          )}
        </div>

        <div className="tableau-large">
          <table>
            <thead>
              <tr>
                <th>État</th>
                <th>Motif</th>
                <th className="num">Écart</th>
                <th>Résolution</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="vide-ligne">
                    {lignes.length === 0
                      ? 'Aucun rapprochement pour cette période. Saisissez le relevé, puis lancez le rapprochement.'
                      : 'Tout est lettré ou résolu pour cette période.'}
                  </td>
                </tr>
              )}
              {visibles.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className={`etat ${ETATS[l.statut].ton}`}>{ETATS[l.statut].libelle}</span>
                  </td>
                  <td>{l.motif}</td>
                  <td className="num">{ecartLisible(l) ?? '—'}</td>
                  <td>
                    {l.resoluPar === null ? (
                      '—'
                    ) : (
                      <small>
                        {l.note}
                        <br />
                        {l.resoluA === null ? '' : jourEtHeure(l.resoluA)}
                      </small>
                    )}
                  </td>
                  <td className="actions">
                    {l.statut !== 'MATCHED' && l.resoluPar === null && (
                      <button
                        type="button"
                        className="bouton-compact"
                        disabled={enCours}
                        onClick={() => {
                          setAResoudre(l);
                          setNote('');
                        }}
                      >
                        Résoudre
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bloc">
        <div className="entete-bloc">
          <h2 className="titre-bloc">Relevé du portefeuille</h2>
          <button
            type="button"
            className="bouton-compact"
            onClick={() => setOuvrirSaisie(!ouvrirSaisie)}
          >
            {ouvrirSaisie ? 'Fermer' : 'Saisir un mouvement'}
          </button>
        </div>

        <p className="chapo">
          Aucun accès automatique au relevé n’existe : Wave ne documente pas d’endpoint pour le
          lire, et en deviner un ferait rapprocher des chiffres inventés. Les lignes se
          reportent depuis le portail Wave Business.
        </p>

        {ouvrirSaisie && (
          <form className="ajout" onSubmit={ajouterAuReleve}>
            <label className="champ-court">
              <span>Identifiant Wave</span>
              <input value={waveTxId} onChange={(e) => setWaveTxId(e.target.value)} maxLength={128} />
            </label>
            <label className="champ-court">
              <span>Date</span>
              <input type="date" value={dateTx} onChange={(e) => setDateTx(e.target.value)} />
            </label>
            <label className="champ-court">
              <span>Sens</span>
              <select value={sens} onChange={(e) => setSens(e.target.value as 'IN' | 'OUT')}>
                <option value="OUT">Sortie</option>
                <option value="IN">Entrée</option>
              </select>
            </label>
            <label className="champ-court">
              <span>Montant (FCFA)</span>
              <input
                value={montantXof}
                onChange={(e) => setMontantXof(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
              />
            </label>
            <label className="champ-court">
              <span>Contrepartie</span>
              <input
                value={contrepartie}
                onChange={(e) => setContrepartie(e.target.value)}
                maxLength={200}
              />
            </label>
            <button type="submit" className="bouton-compact" disabled={!saisieValide || enCours}>
              Ajouter
            </button>
          </form>
        )}

        <div className="tableau-large">
          <table>
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Date</th>
                <th>Sens</th>
                <th className="num">Montant</th>
                <th>Contrepartie</th>
              </tr>
            </thead>
            <tbody>
              {releve.length === 0 && (
                <tr>
                  <td colSpan={5} className="vide-ligne">
                    Relevé vide pour cette période. Tant qu’il l’est, tout règlement envoyé
                    ressortira en écart — ce qui serait exact et trompeur à la fois.
                  </td>
                </tr>
              )}
              {releve.map((m) => (
                <tr key={m.id}>
                  <td>{m.waveTxId}</td>
                  <td>{m.dateTx.slice(0, 10)}</td>
                  <td>{m.sens === 'OUT' ? 'Sortie' : 'Entrée'}</td>
                  <td className="num">{francs(m.montant)}</td>
                  <td>{m.contrepartie ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aResoudre !== null && (
        <div className="confirmation" role="dialog" aria-label="Résoudre l’écart">
          <form onSubmit={resoudre}>
            <h2>Résoudre cette ligne</h2>
            <p className="chapo">{aResoudre.motif}</p>
            {ecartLisible(aResoudre) !== null && (
              <p className="somme-confirmation">{ecartLisible(aResoudre)}</p>
            )}

            <label className="champ">
              <span className="etiquette">Pourquoi est-ce acceptable ?</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                autoFocus
              />
              <span className="aide">
                Lu six mois plus tard par quelqu’un qui n’était pas là. Soyez précis.
              </span>
            </label>

            <div className="actions-confirmation">
              <button
                type="button"
                className="bouton secondaire"
                onClick={() => {
                  setAResoudre(null);
                  setNote('');
                }}
              >
                Renoncer
              </button>
              <button
                type="submit"
                className="bouton"
                disabled={note.trim() === '' || enCours}
              >
                Clore la ligne
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
