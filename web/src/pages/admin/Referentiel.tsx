/**
 * Écran du référentiel.
 *
 * Ce qu'on y fait tient en trois gestes : voir qui existe, ajouter quelqu'un, suspendre
 * quelqu'un. Les trois listes ont donc la même forme, et le formulaire d'ajout vit au-dessus de
 * sa liste plutôt que derrière une fenêtre — on ajoute souvent plusieurs fiches d'affilée.
 *
 * Suspendre demande un motif. Ce n'est pas une formalité : c'est ce qui rend le journal d'audit
 * relisible six mois plus tard, quand personne ne se souvient pourquoi ce chauffeur est bloqué.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ErreurApi,
  ErreurReseau,
  api,
  type FicheChauffeur,
  type FicheOperateur,
  type FicheStation,
  type Role,
  type StatutFiche,
} from '../../lib/api.ts';
import { useSession } from '../../lib/session.tsx';

type Onglet = 'chauffeurs' | 'stations' | 'operateurs';

function message(cause: unknown): string {
  if (cause instanceof ErreurReseau) return 'Pas de connexion au serveur.';
  if (cause instanceof ErreurApi) return cause.message;
  return 'La demande n’a pas abouti.';
}

function Statut({ valeur }: { valeur: StatutFiche | 'ACTIVE' | 'INACTIVE' }) {
  const actif = valeur === 'ACTIF' || valeur === 'ACTIVE';
  return <span className={`pastille ${actif ? 'actif' : 'suspendu'}`}>{actif ? 'Actif' : 'Suspendu'}</span>;
}

export function Referentiel() {
  const { session } = useSession();
  const jeton = session?.token ?? '';

  const [onglet, setOnglet] = useState<Onglet>('chauffeurs');
  const [chauffeurs, setChauffeurs] = useState<FicheChauffeur[]>([]);
  const [stations, setStations] = useState<FicheStation[]>([]);
  const [operateurs, setOperateurs] = useState<FicheOperateur[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [ville, setVille] = useState('');
  const [role, setRole] = useState<Role>('STATION_OPERATOR');
  const [stationId, setStationId] = useState('');

  const charger = useCallback(async () => {
    try {
      const [c, s, o] = await Promise.all([
        api.chauffeurs(jeton),
        api.stations(jeton),
        api.operateurs(jeton),
      ]);
      setChauffeurs([...c]);
      setStations([...s]);
      setOperateurs([...o]);
      setErreur(null);
    } catch (cause) {
      setErreur(message(cause));
    }
  }, [jeton]);

  useEffect(() => {
    void charger();
  }, [charger]);

  function viderFormulaire() {
    setNom('');
    setTelephone('');
    setCode('');
    setVille('');
    setStationId('');
  }

  async function ajouter(event: React.FormEvent) {
    event.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      if (onglet === 'chauffeurs') await api.creerChauffeur(jeton, { nom, telephone });
      if (onglet === 'stations') await api.creerStation(jeton, { code, nom, ville: ville || undefined });
      if (onglet === 'operateurs') {
        await api.creerOperateur(jeton, {
          nom,
          telephone,
          role,
          stationId: role === 'STATION_OPERATOR' ? stationId || null : null,
        });
      }
      viderFormulaire();
      await charger();
    } catch (cause) {
      setErreur(message(cause));
    } finally {
      setEnCours(false);
    }
  }

  async function basculer(type: 'chauffeur' | 'operateur', id: string, statut: StatutFiche) {
    const vers: StatutFiche = statut === 'ACTIF' ? 'SUSPENDU' : 'ACTIF';
    const motif = window.prompt(
      vers === 'SUSPENDU'
        ? 'Motif de la suspension (il restera au journal) :'
        : 'Motif de la réactivation :',
    );
    if (motif === null || motif.trim() === '') return;

    setErreur(null);
    try {
      if (type === 'chauffeur') await api.changerStatutChauffeur(jeton, id, vers, motif);
      else await api.changerStatutOperateur(jeton, id, vers, motif);
      await charger();
    } catch (cause) {
      setErreur(message(cause));
    }
  }

  const nomStation = (id: string | null) =>
    id === null ? '—' : (stations.find((s) => s.id === id)?.code ?? id.slice(0, 8));

  return (
    <div className="referentiel">
      <nav className="onglets" aria-label="Sections du référentiel">
        {(
          [
            ['chauffeurs', `Chauffeurs (${chauffeurs.length})`],
            ['stations', `Stations (${stations.length})`],
            ['operateurs', `Opérateurs (${operateurs.length})`],
          ] as const
        ).map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            aria-current={onglet === cle}
            onClick={() => {
              setOnglet(cle);
              viderFormulaire();
              setErreur(null);
            }}
          >
            {libelle}
          </button>
        ))}
      </nav>

      <form className="ajout" onSubmit={ajouter}>
        {onglet === 'stations' ? (
          <>
            <label className="champ-court">
              <span className="etiquette">Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DKR-01" required />
            </label>
            <label className="champ-court">
              <span className="etiquette">Nom</span>
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Station Dakar 3" required />
            </label>
            <label className="champ-court">
              <span className="etiquette">Ville</span>
              <input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Dakar" />
            </label>
          </>
        ) : (
          <>
            <label className="champ-court">
              <span className="etiquette">Nom</span>
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Moussa Ndiaye" required />
            </label>
            <label className="champ-court">
              <span className="etiquette">Téléphone</span>
              <input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="77 000 00 01"
                inputMode="tel"
                required
              />
            </label>
            {onglet === 'operateurs' && (
              <>
                <label className="champ-court">
                  <span className="etiquette">Rôle</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <option value="STATION_OPERATOR">Pompiste</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </label>
                {role === 'STATION_OPERATOR' && (
                  <label className="champ-court">
                    <span className="etiquette">Station</span>
                    <select value={stationId} onChange={(e) => setStationId(e.target.value)} required>
                      <option value="">Choisir…</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </>
        )}

        <button className="bouton-compact" type="submit" disabled={enCours}>
          {enCours ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      {erreur !== null && <p className="message erreur">{erreur}</p>}

      <div className="tableau-large">
        {onglet === 'chauffeurs' && (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {chauffeurs.map((c) => (
                <tr key={c.id}>
                  <td>{c.nom}</td>
                  <td className="num">{c.msisdn}</td>
                  <td>
                    <Statut valeur={c.statut} />
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="lien"
                      onClick={() => void basculer('chauffeur', c.id, c.statut)}
                    >
                      {c.statut === 'ACTIF' ? 'Suspendre' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
              {chauffeurs.length === 0 && (
                <tr>
                  <td colSpan={4} className="vide-ligne">
                    Aucun chauffeur. Ajoutez le premier ci-dessus.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {onglet === 'stations' && (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Ville</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.id}>
                  <td className="num">{s.code}</td>
                  <td>{s.nom}</td>
                  <td>{s.ville ?? '—'}</td>
                  <td>
                    <Statut valeur={s.statut} />
                  </td>
                </tr>
              ))}
              {stations.length === 0 && (
                <tr>
                  <td colSpan={4} className="vide-ligne">
                    Aucune station. Il en faut une avant de créer un pompiste.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {onglet === 'operateurs' && (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                <th>Station</th>
                <th>Statut</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {operateurs.map((o) => (
                <tr key={o.id}>
                  <td>{o.nom}</td>
                  <td className="num">{o.msisdn}</td>
                  <td>{o.role === 'ADMIN' ? 'Administrateur' : 'Pompiste'}</td>
                  <td className="num">{nomStation(o.stationId)}</td>
                  <td>
                    <Statut valeur={o.statut} />
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="lien"
                      onClick={() => void basculer('operateur', o.id, o.statut)}
                    >
                      {o.statut === 'ACTIF' ? 'Suspendre' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
              {operateurs.length === 0 && (
                <tr>
                  <td colSpan={6} className="vide-ligne">
                    Aucun opérateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
