/**
 * Écran du règlement TotalEnergies.
 *
 * C'est le seul écran de l'application d'où de l'argent peut sortir. Trois choix en découlent :
 *
 *  1. **La règle des quatre yeux se voit.** Le bouton « Approuver » est désactivé pour la
 *     personne qui a préparé, avec la raison écrite à côté. Un bouton qui échoue au clic
 *     apprend la règle par l'échec ; un bouton grisé et expliqué l'apprend avant.
 *  2. **Exécuter demande deux gestes.** Un code arrive sur le téléphone de l'opérateur, il le
 *     saisit, puis il confirme. Le geste le plus dangereux de l'application ne se fait pas d'un
 *     clic distrait.
 *  3. **Un écart se lit en français.** La convention `attendu − constaté` fait qu'un écart
 *     positif signifie « on a réglé moins que dû » — l'inverse de l'intuition. On écrit donc la
 *     phrase, pas le nombre signé.
 *
 * Ce que l'écran ne fait pas : décider. Il ne calcule aucun montant, ne devine aucun statut, ne
 * réessaie rien. Tout vient du serveur, y compris les refus.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ErreurApi,
  ErreurReseau,
  api,
  type Facture,
  type Reglement as Intention,
  type StatutReglement,
} from '../../lib/api.ts';
import { francs, jourEtHeure } from '../../lib/format.ts';
import { useSession } from '../../lib/session.tsx';

function message(cause: unknown): string {
  if (cause instanceof ErreurReseau) return 'Pas de connexion au serveur.';
  if (cause instanceof ErreurApi) return motifLisible(cause);
  return 'La demande n’a pas abouti.';
}

/**
 * Traduit les codes de refus du serveur.
 *
 * Le serveur rend un code stable, jamais une phrase : c'est ici qu'on décide de ce que
 * l'administrateur lit, et chaque code appelle une conduite différente.
 */
function motifLisible(erreur: ErreurApi): string {
  switch (erreur.code) {
    case 'SEPARATION_DES_ROLES':
      return 'Vous avez préparé ce règlement. Une autre personne doit l’approuver.';
    case 'ETAT_MODIFIE':
      return 'Quelqu’un est intervenu entre-temps. La liste vient d’être rechargée.';
    case 'CONFIRMATION_REQUISE':
      return 'Un code de confirmation est nécessaire avant d’exécuter.';
    case 'CODE_REFUSE':
      return 'Code incorrect ou expiré. Demandez-en un nouveau.';
    case 'PLAFOND_DEPASSE':
      return 'Plafond serveur dépassé. Ce montant ne peut pas partir aujourd’hui.';
    case 'NUMERO_DEJA_UTILISE':
      return 'Une facture porte déjà ce numéro. Corrigez le numéro.';
    case 'TRANSITION_INTERDITE':
      return 'Ce geste n’est plus possible dans l’état actuel.';
    case 'INTROUVABLE':
      return 'Introuvable. La liste vient d’être rechargée.';
    default:
      return erreur.message;
  }
}

/** Ce que chaque état veut dire pour la personne qui regarde, et à quel point c'est grave. */
const ETATS: Record<StatutReglement, { libelle: string; ton: 'attente' | 'parti' | 'fini' | 'grave' }> = {
  DRAFT: { libelle: 'Brouillon', ton: 'attente' },
  PENDING_APPROVAL: { libelle: 'À approuver', ton: 'attente' },
  APPROVED: { libelle: 'Approuvé', ton: 'attente' },
  DISPATCHING: { libelle: 'Envoi en cours', ton: 'parti' },
  SENT: { libelle: 'Envoyé', ton: 'parti' },
  SETTLED: { libelle: 'Réglé', ton: 'fini' },
  RECONCILED: { libelle: 'Rapproché', ton: 'fini' },
  NEEDS_REVIEW: { libelle: 'À examiner', ton: 'grave' },
  FAILED: { libelle: 'Échoué', ton: 'grave' },
  VARIANCE: { libelle: 'Écart', ton: 'grave' },
  CANCELLED: { libelle: 'Annulé', ton: 'fini' },
};

function Etat({ valeur }: { valeur: StatutReglement }) {
  const e = ETATS[valeur];
  return <span className={`etat ${e.ton}`}>{e.libelle}</span>;
}

/**
 * L'écart, en toutes lettres.
 *
 * `ecartXof = attendu − constaté`. Un nombre positif signifie donc qu'on a versé MOINS que dû,
 * ce que personne ne lit correctement du premier coup. La phrase le dit.
 */
function ecartLisible(intention: Intention): string | null {
  if (intention.ecartXof === null || intention.ecartXof === 0) return null;
  const manque = intention.ecartXof > 0;
  const somme = francs(Math.abs(intention.ecartXof));
  return manque ? `${somme} versés en moins que dû` : `${somme} versés en trop`;
}

export function Reglement() {
  const { session } = useSession();
  const jeton = session?.token ?? '';
  const moi = session?.subject ?? '';

  const [factures, setFactures] = useState<Facture[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [ouvrirAjout, setOuvrirAjout] = useState(false);

  /** Intention dont on est en train de confirmer l'exécution, et le code saisi. */
  const [aExecuter, setAExecuter] = useState<Intention | null>(null);
  const [code, setCode] = useState('');
  const [codeAffiche, setCodeAffiche] = useState<string | null>(null);

  const [numero, setNumero] = useState('');
  const [montantXof, setMontantXof] = useState('');
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [periodeFin, setPeriodeFin] = useState('');
  const [dateEmission, setDateEmission] = useState('');
  const [dateEcheance, setDateEcheance] = useState('');

  const charger = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([api.factures(jeton), api.reglements(jeton)]);
      setFactures([...f]);
      setIntentions([...r]);
      setErreur(null);
    } catch (cause) {
      setErreur(message(cause));
    }
  }, [jeton]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /**
   * Enveloppe commune à tous les gestes.
   *
   * Après chaque geste, réussi ou non, on recharge. Un écran qui garde un état périmé après un
   * refus de concurrence invite à recliquer sur un bouton qui échouera encore.
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

    // On recharge dans tous les cas — surtout après un refus de concurrence, où garder un écran
    // périmé invite à recliquer sur un bouton qui échouera encore.
    await charger();

    // ... mais le message du refus est posé APRÈS le rechargement. `charger` remet l'erreur à
    // null quand il réussit : le poser avant l'effacerait, et le refus passerait inaperçu.
    setErreur(refus);
    setEnCours(false);
  }

  async function enregistrerFacture(evt: React.FormEvent) {
    evt.preventDefault();
    const montant = Number(montantXof);
    if (!Number.isInteger(montant) || montant <= 0) {
      setErreur('Le montant doit être un entier de francs, sans centime.');
      return;
    }
    await geste(async () => {
      await api.enregistrerFacture(jeton, {
        numero: numero.trim(),
        periodeDebut,
        periodeFin,
        montantXof: montant,
        dateEmission,
        dateEcheance,
      });
      setNumero('');
      setMontantXof('');
      setPeriodeDebut('');
      setPeriodeFin('');
      setDateEmission('');
      setDateEcheance('');
      setOuvrirAjout(false);
    });
  }

  async function demanderCode(intention: Intention) {
    setAExecuter(intention);
    setCode('');
    setCodeAffiche(null);
    setErreur(null);
    try {
      const r = await api.demanderConfirmation(jeton, intention.id);
      // Le code n'arrive dans la réponse que sur un serveur sans passerelle SMS. En production
      // il part par SMS et ce champ est absent.
      if (r.code !== undefined) setCodeAffiche(r.code);
    } catch (cause) {
      setErreur(message(cause));
      setAExecuter(null);
    }
  }

  async function executer(evt: React.FormEvent) {
    evt.preventDefault();
    const intention = aExecuter;
    if (intention === null) return;
    await geste(async () => {
      await api.executerReglement(jeton, intention.id, code);
      setAExecuter(null);
      setCode('');
      setCodeAffiche(null);
    });
  }

  const parFacture = new Map(intentions.map((i) => [i.invoiceId, i]));
  const vivante = (i: Intention | undefined) =>
    i !== undefined && !['FAILED', 'CANCELLED'].includes(i.statut);
  const enRevue = intentions.filter((i) => i.statut === 'NEEDS_REVIEW' || i.statut === 'VARIANCE');
  const formulaireValide =
    numero.trim() !== '' &&
    montantXof !== '' &&
    periodeDebut !== '' &&
    periodeFin !== '' &&
    dateEmission !== '' &&
    dateEcheance !== '';

  return (
    <section className="reglement">
      {erreur !== null && <p className="message erreur">{erreur}</p>}

      {enRevue.length > 0 && (
        <div className="bloc incidents">
          <h2 className="titre-bloc">Sort des fonds indéterminé</h2>
          <ul className="liste-incidents">
            {enRevue.map((i) => (
              <li key={i.id} className="critique">
                <span className="compte">{francs(i.montant)}</span>
                <span>
                  {i.statut === 'VARIANCE'
                    ? (ecartLisible(i) ?? 'Écart constaté')
                    : (i.motifReview ?? 'Réponse ambiguë du fournisseur')}
                  . Un versement est peut-être parti : vérifiez chez l’opérateur avant tout
                  nouveau geste.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bloc">
        <div className="entete-bloc">
          <h2 className="titre-bloc">Factures TotalEnergies</h2>
          <button
            type="button"
            className="bouton-compact"
            onClick={() => setOuvrirAjout(!ouvrirAjout)}
          >
            {ouvrirAjout ? 'Fermer' : 'Enregistrer une facture'}
          </button>
        </div>

        {ouvrirAjout && (
          <form className="ajout" onSubmit={enregistrerFacture}>
            <label className="champ-court">
              <span>Numéro</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={64} />
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
              <span>Période du</span>
              <input
                type="date"
                value={periodeDebut}
                onChange={(e) => setPeriodeDebut(e.target.value)}
              />
            </label>
            <label className="champ-court">
              <span>au</span>
              <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} />
            </label>
            <label className="champ-court">
              <span>Émise le</span>
              <input
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
              />
            </label>
            <label className="champ-court">
              <span>Échéance</span>
              <input
                type="date"
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
              />
            </label>
            <button type="submit" className="bouton-compact" disabled={!formulaireValide || enCours}>
              Enregistrer
            </button>
          </form>
        )}

        <div className="tableau-large">
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Période</th>
                <th>Échéance</th>
                <th className="num">Montant</th>
                <th>Règlement</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {factures.length === 0 && (
                <tr>
                  <td colSpan={6} className="vide-ligne">
                    Aucune facture enregistrée. Le règlement part toujours d’une facture reçue du
                    fournisseur — jamais d’un montant saisi ici.
                  </td>
                </tr>
              )}
              {factures.map((f) => {
                const intention = parFacture.get(f.id);
                return (
                  <tr key={f.id}>
                    <td>{f.numero}</td>
                    <td>
                      {f.periodeDebut} → {f.periodeFin}
                    </td>
                    <td>{f.dateEcheance}</td>
                    <td className="num">{francs(f.montant)}</td>
                    <td>{intention === undefined ? '—' : <Etat valeur={intention.statut} />}</td>
                    <td className="actions">
                      {!vivante(intention) && (
                        <button
                          type="button"
                          className="bouton-compact"
                          disabled={enCours}
                          onClick={() =>
                            void geste(() => api.preparerReglement(jeton, f.id))
                          }
                        >
                          Préparer le règlement
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bloc">
        <h2 className="titre-bloc">Règlements</h2>

        <div className="tableau-large">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th className="num">Montant</th>
                <th>État</th>
                <th>Préparé par</th>
                <th>Approuvé par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {intentions.length === 0 && (
                <tr>
                  <td colSpan={6} className="vide-ligne">
                    Aucun règlement en cours.
                  </td>
                </tr>
              )}
              {intentions.map((i) => {
                const jePrepare = i.preparePar === moi;
                return (
                  <tr key={i.id}>
                    <td>{i.referenceImputation}</td>
                    <td className="num">{francs(i.montant)}</td>
                    <td>
                      <Etat valeur={i.statut} />
                      {ecartLisible(i) !== null && (
                        <>
                          <br />
                          <small>{ecartLisible(i)}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <small>{jePrepare ? 'vous' : i.preparePar.slice(0, 8)}</small>
                    </td>
                    <td>
                      <small>{i.approuvePar === null ? '—' : i.approuvePar.slice(0, 8)}</small>
                    </td>
                    <td className="actions">
                      {i.statut === 'DRAFT' && (
                        <>
                          <button
                            type="button"
                            className="bouton-compact"
                            disabled={enCours}
                            onClick={() => void geste(() => api.gesteReglement(jeton, i.id, 'soumettre'))}
                          >
                            Soumettre
                          </button>
                          <button
                            type="button"
                            className="bouton-compact"
                            disabled={enCours}
                            onClick={() => void geste(() => api.gesteReglement(jeton, i.id, 'annuler'))}
                          >
                            Annuler
                          </button>
                        </>
                      )}

                      {i.statut === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            type="button"
                            className="bouton-compact"
                            disabled={enCours || jePrepare}
                            title={
                              jePrepare
                                ? 'Vous avez préparé ce règlement : une autre personne doit l’approuver.'
                                : undefined
                            }
                            onClick={() => void geste(() => api.gesteReglement(jeton, i.id, 'approuver'))}
                          >
                            Approuver
                          </button>
                          {jePrepare && (
                            <small className="raison">
                              Vous l’avez préparé — l’approbation revient à quelqu’un d’autre.
                            </small>
                          )}
                        </>
                      )}

                      {i.statut === 'APPROVED' && (
                        <button
                          type="button"
                          className="bouton-compact danger"
                          disabled={enCours}
                          onClick={() => void demanderCode(i)}
                        >
                          Exécuter le versement
                        </button>
                      )}

                      {i.statut === 'SETTLED' && (
                        <button
                          type="button"
                          className="bouton-compact"
                          disabled={enCours}
                          onClick={() => void geste(() => api.gesteReglement(jeton, i.id, 'rapprocher'))}
                        >
                          Rapprocher
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {aExecuter !== null && (
        <div className="confirmation" role="dialog" aria-label="Confirmer le versement">
          <form onSubmit={executer}>
            <h2>Confirmer le versement</h2>
            <p className="somme-confirmation">{francs(aExecuter.montant)}</p>
            <p className="chapo">
              Vers TotalEnergies, référence {aExecuter.referenceImputation}.
              {aExecuter.canal === 'DRY_RUN' && (
                <>
                  {' '}
                  <strong>
                    Canal à blanc : l’ordre sera enregistré mais aucun argent ne partira
                    réellement.
                  </strong>
                </>
              )}
            </p>

            {codeAffiche !== null && (
              <p className="message info">
                Passerelle SMS non branchée : votre code est <strong>{codeAffiche}</strong>.
              </p>
            )}

            <label className="champ">
              <span className="etiquette">Code à six chiffres</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                autoFocus
              />
              <span className="aide">Envoyé au numéro enregistré pour votre compte.</span>
            </label>

            <div className="actions-confirmation">
              <button
                type="button"
                className="bouton secondaire"
                onClick={() => {
                  setAExecuter(null);
                  setCode('');
                  setCodeAffiche(null);
                }}
              >
                Renoncer
              </button>
              <button type="submit" className="bouton" disabled={code.length !== 6 || enCours}>
                {enCours ? 'Envoi…' : 'Verser'}
              </button>
            </div>
          </form>
        </div>
      )}

      <p className="arrete">
        Dernière lecture {jourEtHeure(new Date().toISOString())} ·{' '}
        <button type="button" className="lien" onClick={() => void charger()}>
          actualiser
        </button>
      </p>
    </section>
  );
}
