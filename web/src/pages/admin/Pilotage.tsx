/**
 * Écran de pilotage.
 *
 * Une seule question à l'ouverture : est-ce que quelque chose demande mon attention ?
 * Les incidents passent donc avant les chiffres, et les chiffres avant le référentiel.
 *
 * La jauge d'encours porte l'encours courant et les deux seuils sur **une seule échelle**.
 * C'est ce qui permet de lire d'un coup d'œil la distance qui reste avant que TotalEnergies
 * puisse suspendre les cartes — l'indicateur qui a une valeur opérationnelle, à la différence
 * du solde Wave qui ne dit rien d'utile.
 */

import { useCallback, useEffect, useState } from 'react';
import { ErreurApi, ErreurReseau, api, type EtatPilotage } from '../../lib/api.ts';
import { francs, jourEtHeure } from '../../lib/format.ts';
import { useSession } from '../../lib/session.tsx';

const AVERTISSEMENTS: Record<string, string> = {
  CONTRAT_TE_ABSENT:
    'Aucun contrat TotalEnergies enregistré. Le suivi d’encours reste vide tant qu’il manque.',
  REGLEMENT_EN_DRY_RUN:
    'Le règlement tourne à blanc : aucun mouvement d’argent réel ne part vers TotalEnergies.',
};

function Jauge({ encours }: { encours: NonNullable<EtatPilotage['encours']> }) {
  const echelle = Math.max(encours.encoursAutorise, encours.encoursCourant);
  const pourcent = (valeur: number) => `${Math.min(100, (valeur / echelle) * 100)}%`;

  return (
    <div className="jauge">
      <div className="piste">
        <div
          className={`remplissage ${encours.niveau.toLowerCase()}`}
          style={{ width: pourcent(encours.encoursCourant) }}
        />
        <div className="seuil alerte" style={{ left: pourcent(encours.seuilAlerteXof) }}>
          <span>alerte</span>
        </div>
        <div className="seuil blocage" style={{ left: pourcent(encours.seuilBlocageXof) }}>
          <span>blocage</span>
        </div>
      </div>
      <div className="bornes">
        <span>0</span>
        <span>{francs(echelle)} FCFA</span>
      </div>
    </div>
  );
}

function Projection({ etat }: { etat: EtatPilotage }) {
  const { projection, encours } = etat;
  if (projection === null || encours === null) return null;

  if (projection.raison === 'DEJA_ATTEINT') {
    return (
      <div className="projection blocage">
        <span className="etiquette">Seuil de blocage</span>
        <p className="verdict-texte">Atteint</p>
        <p className="detail">
          TotalEnergies peut suspendre les cartes. Réglez les factures échues avant tout.
        </p>
      </div>
    );
  }

  if (projection.raison === 'CONSOMMATION_NULLE') {
    return (
      <div className="projection calme">
        <span className="etiquette">Seuil de blocage</span>
        <p className="verdict-texte">Pas de projection</p>
        <p className="detail">Aucune consommation sur la période observée.</p>
      </div>
    );
  }

  const jours = projection.joursRestants ?? 0;

  // Au-dela de six mois, annoncer un nombre de jours n'est plus une information : c'est de
  // l'arithmetique. Le rythme observe aura change dix fois d'ici la.
  if (jours > 180) {
    return (
      <div className="projection calme">
        <span className="etiquette">Seuil de blocage</span>
        <p className="verdict-texte">Plus de 6 mois</p>
        <p className="detail">
          Au rythme observé, l’encours n’est pas une préoccupation à court terme.
        </p>
      </div>
    );
  }

  const ton = jours <= 7 ? 'blocage' : jours <= 21 ? 'alerte' : 'calme';

  return (
    <div className={`projection ${ton}`}>
      <span className="etiquette">Seuil de blocage atteint dans</span>
      <p className="verdict-texte">
        {jours} <span className="unite">jour{jours > 1 ? 's' : ''}</span>
      </p>
      <p className="detail">
        Soit le{' '}
        {new Date(`${projection.date}T00:00:00Z`).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        , au rythme de consommation observé.
      </p>
    </div>
  );
}

export function Pilotage() {
  const { session } = useSession();
  const jeton = session?.token ?? '';

  const [etat, setEtat] = useState<EtatPilotage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setEtat(await api.tableauDeBord(jeton));
      setErreur(null);
    } catch (cause) {
      if (cause instanceof ErreurReseau) setErreur('Pas de connexion au serveur.');
      else if (cause instanceof ErreurApi) setErreur(cause.message);
      else setErreur('Le tableau de bord n’a pas pu être chargé.');
    }
  }, [jeton]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (erreur !== null) return <p className="message erreur">{erreur}</p>;
  if (etat === null) return <p className="chargement">Chargement…</p>;

  return (
    <div className="pilotage">
      {etat.incidents.length > 0 && (
        <section className="bloc incidents">
          <h2 className="titre-bloc">À traiter</h2>
          <ul className="liste-incidents">
            {etat.incidents.map((i) => (
              <li key={i.type} className={i.gravite.toLowerCase()}>
                <span className="compte">{i.nombre}</span>
                <span className="quoi">{i.libelle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {etat.avertissements.map((a) => (
        <p key={a} className="message info">
          {AVERTISSEMENTS[a] ?? a}
        </p>
      ))}

      <section className="bloc">
        <div className="entete-bloc">
          <h2 className="titre-bloc">Encours TotalEnergies</h2>
          {etat.contrat !== null && <span className="compte-te">{etat.contrat.numeroCompte}</span>}
        </div>

        {etat.encours === null ? (
          <p className="vide">Aucun contrat enregistré.</p>
        ) : (
          <div className="encours">
            <Projection etat={etat} />
            <div className="mesures">
              <div className="mesure">
                <span className="etiquette">Encours courant</span>
                <span className="valeur">{francs(etat.encours.encoursCourant)}</span>
                <span className="appoint">{etat.encours.utilisationPct} % du plafond</span>
              </div>
              <div className="mesure">
                <span className="etiquette">Disponible</span>
                <span className="valeur">{francs(etat.encours.disponible)}</span>
                <span className="appoint">sur {francs(etat.encours.encoursAutorise)} autorisés</span>
              </div>
              <div className="mesure">
                <span className="etiquette">Bons en circulation</span>
                <span className="valeur">{francs(etat.bonsEnCirculation)}</span>
                <span className="appoint">payés, pas encore servis</span>
              </div>
            </div>
            <Jauge encours={etat.encours} />
          </div>
        )}
      </section>

      <section className="bloc">
        <h2 className="titre-bloc">Aujourd’hui</h2>
        <div className="mesures">
          <div className="mesure">
            <span className="etiquette">Bons émis</span>
            <span className="valeur">{etat.activite.bonsEmis}</span>
            <span className="appoint">{francs(etat.activite.montantEmis)} FCFA</span>
          </div>
          <div className="mesure">
            <span className="etiquette">Bons servis</span>
            <span className="valeur">{etat.activite.bonsConsommes}</span>
            <span className="appoint">{francs(etat.activite.montantConsomme)} FCFA</span>
          </div>
        </div>
      </section>

      <p className="arrete">
        Arrêté le {jourEtHeure(etat.arreteA)} ·{' '}
        <button type="button" className="lien" onClick={() => void charger()}>
          actualiser
        </button>
      </p>
    </div>
  );
}
