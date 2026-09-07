/**
 * Écran chauffeur.
 *
 * Une seule question à l'ouverture : ai-je un bon à présenter ? Si oui, il occupe l'écran, QR
 * en grand, prêt à être montré. Sinon, on en demande un.
 *
 * Le bon est dessiné comme le ticket papier qu'il remplace. Ce n'est pas une décoration : le
 * chauffeur reconnaît l'objet avant de lire quoi que ce soit.
 */

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ErreurApi, ErreurReseau, api, type Bon } from '../lib/api.ts';
import { francs, jourEtHeure, restant } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { enregistrerDernierBon, lireDernierBon } from '../lib/dernier-bon.ts';

const MONTANTS_COURANTS = [5000, 10000, 20000];

function Ticket({ bon }: { bon: Bon }) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    if (bon.jeton === null) {
      setImage(null);
      return;
    }
    // Correction d'erreur au niveau moyen : un QR affiché sur un écran rayé ou sali doit
    // rester lisible sans obliger le chauffeur à nettoyer son téléphone.
    void QRCode.toDataURL(bon.jeton, { margin: 0, width: 544, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (vivant) setImage(url);
      },
    );
    return () => {
      vivant = false;
    };
  }, [bon.jeton]);

  const expire = Date.parse(bon.expireA) <= Date.now();
  const classe = bon.statut === 'CONSOMME' ? 'consomme' : expire ? 'perime' : '';

  return (
    <article className={`ticket ${classe}`}>
      <div className="talon">
        <span className="etiquette">Bon carburant</span>
        <p style={{ margin: '8px 0 0' }}>
          <span className="montant">{francs(bon.montantXof)}</span>
          <span className="devise">FCFA</span>
        </p>
      </div>

      <div className="perforation" aria-hidden="true">
        <div className="pointille" />
      </div>

      <div className="corps">
        {bon.statut === 'EMIS' && !expire && image !== null && (
          <>
            <img src={image} alt={`Code à présenter au pompiste, ${francs(bon.montantXof)} francs`} />
            <p className="peremption">Valable encore {restant(bon.expireA)}</p>
          </>
        )}

        {bon.statut === 'CONSOMME' && (
          <p style={{ margin: '18px 0 0' }}>
            <span className="bandeau-statut consomme">Servi</span>
            <br />
            <span className="peremption">
              {bon.consommeA === null ? '' : jourEtHeure(bon.consommeA)}
            </span>
          </p>
        )}

        {bon.statut === 'ANNULE' && (
          <p style={{ margin: '18px 0 0' }}>
            <span className="bandeau-statut annule">Annulé</span>
          </p>
        )}

        {bon.statut === 'EMIS' && expire && (
          <p style={{ margin: '18px 0 0' }}>
            <span className="bandeau-statut annule">Expiré</span>
            <br />
            <span className="peremption">Ce bon n’est plus utilisable. Demandez-en un autre.</span>
          </p>
        )}
      </div>
    </article>
  );
}

export function Chauffeur() {
  const { session, fermer } = useSession();
  const jeton = session?.token ?? '';
  const chauffeurId = session?.subject ?? '';

  // Le bon conserve s'affiche AVANT tout appel reseau : a la pompe, on ne fait pas attendre
  // quelqu'un qui a deja paye.
  const [bons, setBons] = useState<Bon[] | null>(() => {
    const memoire = lireDernierBon(chauffeurId);
    return memoire === null ? null : [memoire];
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [montant, setMontant] = useState<number | null>(null);
  const [montantLibre, setMontantLibre] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [horsLigne, setHorsLigne] = useState(false);

  const message = (cause: unknown): string => {
    if (cause instanceof ErreurReseau) return 'Pas de connexion. Vos bons s’afficheront au retour du réseau.';
    if (cause instanceof ErreurApi) return cause.message;
    return 'La demande n’a pas abouti.';
  };

  const charger = useCallback(async () => {
    try {
      const recents = await api.mesBons(jeton);
      const utilisable = recents.find(
        (b) => b.statut === 'EMIS' && b.jeton !== null && Date.parse(b.expireA) > Date.now(),
      );
      // On garde le bon utilisable, et on efface des qu'il n'y en a plus : un bon consomme ne
      // doit pas survivre en memoire locale.
      enregistrerDernierBon(chauffeurId, utilisable ?? null);
      setBons(recents);
      setHorsLigne(false);
      setErreur(null);
    } catch (cause) {
      const memoire = lireDernierBon(chauffeurId);
      setBons((precedents) => precedents ?? (memoire === null ? [] : [memoire]));
      setHorsLigne(true);
      // Hors ligne avec un bon en memoire, il n'y a rien a signaler comme erreur : le chauffeur
      // a ce qu'il lui faut. Sans bon, en revanche, il faut le dire.
      setErreur(memoire === null ? message(cause) : null);
    }
  }, [jeton, chauffeurId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Le reseau revient : on rattrape sans que le chauffeur ait a y penser.
  useEffect(() => {
    const auRetour = () => void charger();
    window.addEventListener('online', auRetour);
    return () => window.removeEventListener('online', auRetour);
  }, [charger]);

  async function demanderBon() {
    const valeur = montant ?? Number(montantLibre);
    if (!Number.isInteger(valeur) || valeur <= 0) return;

    setEnCours(true);
    setErreur(null);
    try {
      const r = await api.ouvrirPaiement(jeton, valeur);
      // Le paiement se fait chez l'operateur : on quitte l'application pour y aller.
      window.location.href = r.urlPaiement;
    } catch (cause) {
      setErreur(message(cause));
      setEnCours(false);
    }
  }

  const actif = bons?.find((b) => b.statut === 'EMIS' && Date.parse(b.expireA) > Date.now());
  const passes = (bons ?? []).filter((b) => b !== actif);
  const valeurChoisie = montant ?? Number(montantLibre);
  const choixValide = Number.isInteger(valeurChoisie) && valeurChoisie > 0;

  return (
    <div className="app">
      <header className="barre">
        <span className="marque">Assur'Trans</span>
        <button type="button" onClick={fermer}>
          Quitter
        </button>
      </header>

      <main className="vue">
        {horsLigne && actif !== undefined && (
          <p className="message info">
            Sans connexion. Votre bon reste valable — c’est le pompiste qui le vérifie.
          </p>
        )}
        {horsLigne && actif === undefined && (
          <p className="message info">
            Sans connexion. Reconnectez-vous au réseau pour demander un bon.
          </p>
        )}
        {bons === null ? (
          <p className="chargement">Chargement…</p>
        ) : actif !== undefined ? (
          <>
            <div>
              <h1 className="titre">Montrez ce code au pompiste.</h1>
              <p className="chapo">Il ne sert qu’une fois.</p>
            </div>
            <Ticket bon={actif} />
            <button className="bouton secondaire" type="button" onClick={() => void charger()}>
              Actualiser
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 className="titre">Combien de carburant ?</h1>
              <p className="chapo">
                Vous payez maintenant, vous recevez un code à présenter en station.
              </p>
            </div>

            <div className="montants-rapides">
              {MONTANTS_COURANTS.map((valeur) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={montant === valeur}
                  onClick={() => {
                    setMontant(valeur);
                    setMontantLibre('');
                  }}
                >
                  {francs(valeur)}
                </button>
              ))}
            </div>

            <label className="champ">
              <span className="etiquette">Ou un autre montant</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="15 000"
                value={montantLibre}
                onChange={(e) => {
                  setMontantLibre(e.target.value.replace(/\D/g, ''));
                  setMontant(null);
                }}
              />
              <p className="aide">Entre 1 000 et 200 000 FCFA.</p>
            </label>

            {erreur !== null && <p className="message erreur">{erreur}</p>}

            <button
              className="bouton"
              type="button"
              disabled={enCours || !choixValide || horsLigne}
              onClick={() => void demanderBon()}
            >
              {enCours ? 'Ouverture du paiement…' : horsLigne ? 'Réseau requis pour payer' : 'Payer'}
            </button>
          </>
        )}

        {passes.length > 0 && (
          <section>
            <h2 className="etiquette" style={{ marginBottom: 10 }}>
              Bons précédents
            </h2>
            <ul className="liste-bons">
              {passes.map((b) => (
                <li key={b.id}>
                  <span className="somme">{francs(b.montantXof)} FCFA</span>
                  <span className="quand">
                    {b.statut === 'CONSOMME'
                      ? `servi le ${jourEtHeure(b.consommeA ?? b.emisA)}`
                      : b.statut === 'ANNULE'
                        ? 'annulé'
                        : 'expiré'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {bons !== null && bons.length === 0 && erreur === null && (
          <p className="vide">Aucun bon pour l’instant.</p>
        )}
      </main>
    </div>
  );
}
