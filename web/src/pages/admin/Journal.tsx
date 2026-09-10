/**
 * Consultation du journal d'audit.
 *
 * Le journal répond à « qui a fait quoi, quand, sur quoi ». Il ne répond pas à « quelles
 * données ont transité » — et l'écran doit le dire, sans quoi on cliquerait indéfiniment pour
 * ouvrir un événement qui ne s'ouvre pas.
 *
 * Trois choix.
 *
 *  1. **L'empreinte est présentée comme une preuve, pas comme un détail masqué.** La table ne
 *     conserve que le SHA-256 du payload : un journal qui accumulerait des numéros de téléphone
 *     deviendrait lui-même un fichier à protéger, et se conserve pourtant plus longtemps que le
 *     reste. L'empreinte sert à vérifier qu'un contenu qu'on représente est bien celui de
 *     l'époque — pas à le retrouver.
 *  2. **Filtrer par cible d'abord.** La question qu'on se pose vraiment est « qu'est-il arrivé à
 *     ce bon, à ce règlement ». Un clic sur une cible rassemble toute sa vie.
 *  3. **Pas de pagination numérotée.** Le journal grossit pendant qu'on le lit ; une page 3 ne
 *     désigne rien de stable. On charge la suite, et ce qui a été lu reste lu.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ErreurApi,
  ErreurReseau,
  api,
  type EvenementJournal,
} from '../../lib/api.ts';
import { jourEtHeure } from '../../lib/format.ts';
import { useSession } from '../../lib/session.tsx';

function message(cause: unknown): string {
  if (cause instanceof ErreurReseau) return 'Pas de connexion au serveur.';
  if (cause instanceof ErreurApi) return cause.message;
  return 'La demande n’a pas abouti.';
}

/**
 * Ce que chaque action veut dire, en français.
 *
 * Les actions non listées s'affichent telles quelles : mieux vaut `REGLEMENT_XYZ` qu'une
 * traduction inventée, et une action nouvelle ne doit pas disparaître de l'écran parce que
 * personne n'a pensé à l'ajouter ici.
 */
const LIBELLES: Record<string, string> = {
  ENTITE_CREEE: 'Entité créée',
  CONTRAT_TE_CREE: 'Contrat TotalEnergies créé',
  CHAUFFEUR_CREE: 'Chauffeur créé',
  STATION_CREEE: 'Station créée',
  OPERATEUR_CREE: 'Opérateur créé',
  CHAUFFEUR_SUSPENDU: 'Chauffeur suspendu',
  OPERATEUR_SUSPENDU: 'Opérateur suspendu',
  PAYMENT_SESSION_CREATED: 'Paiement ouvert',
  VOUCHER_ISSUED: 'Bon émis',
  VOUCHER_REDEEMED: 'Bon servi',
  VOUCHER_REDEEM_REPLAYED: 'Scan rejoué, bon déjà servi',
  BON_ENVOYE: 'Bon envoyé au chauffeur',
  FACTURE_ENREGISTREE: 'Facture enregistrée',
  REGLEMENT_PREPARE: 'Règlement préparé',
  REGLEMENT_SOUMIS: 'Règlement soumis',
  REGLEMENT_APPROUVE: 'Règlement approuvé',
  REGLEMENT_EXECUTE: 'Règlement exécuté',
  REGLEMENT_REFUSE: 'Règlement refusé par le fournisseur',
  REGLEMENT_REPRIS: 'Règlement retrouvé après interruption',
  REGLEMENT_EN_REVUE: 'Règlement mis en revue',
  REGLEMENT_ANNULE: 'Règlement annulé',
  REGLEMENT_RAPPROCHE: 'Règlement rapproché',
  RAPPROCHEMENT_EXECUTE: 'Rapprochement exécuté',
  ECART_RESOLU: 'Écart résolu',
  JEU_DEMO_CHARGE: 'Jeu de démonstration chargé',
};

/** Les gestes qui touchent à l'argent se repèrent d'un coup d'œil. */
const MONETAIRES = new Set([
  'REGLEMENT_EXECUTE',
  'REGLEMENT_REPRIS',
  'REGLEMENT_EN_REVUE',
  'REGLEMENT_REFUSE',
  'VOUCHER_REDEEMED',
  'ECART_RESOLU',
]);

/**
 * Qui a agi.
 *
 * Un identifiant brut n'apprend rien. Quand le compte existe, on montre son nom ; quand il
 * s'agit d'un mécanisme, on le nomme ; sinon on rend un identifiant tronqué, qui reste
 * cherchable.
 */
const MECANISMES: Record<string, string> = {
  systeme: 'le système',
  reprise: 'la reprise automatique',
  envoi: 'le worker d’envoi',
  amorcage: 'l’amorçage',
  demo: 'le jeu de démonstration',
  fournisseur: 'le fournisseur',
};

function acteurLisible(e: EvenementJournal): string {
  if (e.acteurNom !== null) return e.acteurNom;
  return MECANISMES[e.acteur] ?? e.acteur.slice(0, 8);
}

export function Journal() {
  const { session } = useSession();
  const jeton = session?.token ?? '';

  const [evenements, setEvenements] = useState<EvenementJournal[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [action, setAction] = useState('');
  const [cible, setCible] = useState('');
  const [depuis, setDepuis] = useState('');
  const [jusqua, setJusqua] = useState('');

  const charger = useCallback(async () => {
    setEnCours(true);
    try {
      const [page, a] = await Promise.all([
        api.journal(jeton, { action, cible, depuis, jusqua }),
        api.actionsDuJournal(jeton),
      ]);
      setEvenements([...page.evenements]);
      setCurseur(page.curseurSuivant);
      setActions([...a]);
      setErreur(null);
    } catch (cause) {
      setErreur(message(cause));
    }
    setEnCours(false);
  }, [jeton, action, cible, depuis, jusqua]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Charge la suite sans rien perdre : ce qui a été lu reste lu. */
  async function chargerLaSuite() {
    if (curseur === null || enCours) return;
    setEnCours(true);
    try {
      const page = await api.journal(jeton, {
        action,
        cible,
        depuis,
        jusqua,
        curseur,
      });
      setEvenements((avant) => [...avant, ...page.evenements]);
      setCurseur(page.curseurSuivant);
      setErreur(null);
    } catch (cause) {
      setErreur(message(cause));
    }
    setEnCours(false);
  }

  const filtre = action !== '' || cible !== '' || depuis !== '' || jusqua !== '';

  return (
    <section className="reglement">
      {erreur !== null && <p className="message erreur">{erreur}</p>}

      <div className="bloc">
        <div className="entete-bloc">
          <h2 className="titre-bloc">Journal d’audit</h2>
          {filtre && (
            <button
              type="button"
              className="bouton-compact"
              onClick={() => {
                setAction('');
                setCible('');
                setDepuis('');
                setJusqua('');
              }}
            >
              Tout afficher
            </button>
          )}
        </div>

        <p className="chapo">
          Qui a fait quoi, quand, sur quoi. Le contenu des actions n’est pas conservé : seule son
          empreinte l’est. Un journal qui accumulerait des numéros de téléphone deviendrait
          lui-même un fichier à protéger, et se garde pourtant plus longtemps que le reste.
        </p>

        <form className="ajout" onSubmit={(e) => e.preventDefault()}>
          <label className="champ-court">
            <span>Action</span>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Toutes</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {LIBELLES[a] ?? a}
                </option>
              ))}
            </select>
          </label>
          <label className="champ-court">
            <span>Cible</span>
            <input
              value={cible}
              onChange={(e) => setCible(e.target.value)}
              placeholder="identifiant"
            />
          </label>
          <label className="champ-court">
            <span>Du</span>
            <input type="date" value={depuis} onChange={(e) => setDepuis(e.target.value)} />
          </label>
          <label className="champ-court">
            <span>Au</span>
            <input type="date" value={jusqua} onChange={(e) => setJusqua(e.target.value)} />
          </label>
        </form>

        <div className="tableau-large">
          <table>
            <thead>
              <tr>
                <th>Quand</th>
                <th>Qui</th>
                <th>Quoi</th>
                <th>Sur quoi</th>
                <th>Empreinte</th>
              </tr>
            </thead>
            <tbody>
              {evenements.length === 0 && (
                <tr>
                  <td colSpan={5} className="vide-ligne">
                    {filtre
                      ? 'Aucun événement ne correspond à ces critères.'
                      : 'Le journal est vide.'}
                  </td>
                </tr>
              )}
              {evenements.map((e) => (
                <tr key={e.id}>
                  <td>{jourEtHeure(e.ts)}</td>
                  <td>{acteurLisible(e)}</td>
                  <td>
                    {MONETAIRES.has(e.action) ? (
                      <span className="etat grave">{LIBELLES[e.action] ?? e.action}</span>
                    ) : (
                      (LIBELLES[e.action] ?? e.action)
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="lien"
                      onClick={() => setCible(e.cibleId)}
                      title="Voir tout ce qui est arrivé à cette cible"
                    >
                      {e.cibleType} {e.cibleId.slice(0, 8)}
                    </button>
                  </td>
                  <td>
                    <small title={e.empreinte}>{e.empreinte.slice(0, 12)}…</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {curseur !== null && (
          <button
            type="button"
            className="bouton-compact"
            disabled={enCours}
            onClick={() => void chargerLaSuite()}
          >
            {enCours ? 'Chargement…' : 'Charger la suite'}
          </button>
        )}
      </div>
    </section>
  );
}
