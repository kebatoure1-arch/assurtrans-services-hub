/**
 * Écran pompiste.
 *
 * Une seule question : est-ce que je sers, et combien ? La réponse prend tout l'écran, en
 * couleur pleine, lisible à un mètre. Elle ne s'efface pas toute seule : c'est le pompiste qui
 * la referme quand il a servi.
 *
 * Le scan a besoin du réseau : seul le serveur sait si un bon a déjà servi. Quand la connexion
 * manque, on le dit franchement plutôt que d'afficher un feu vert qui ne veut rien dire.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { ErreurApi, ErreurReseau, api } from '../lib/api.ts';
import { francs, heure } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';

type Verdict =
  | { readonly type: 'servir'; readonly montant: number }
  | { readonly type: 'deja'; readonly montant: number }
  | { readonly type: 'refus'; readonly motif: string };

function identifiantDeScan(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Traduction des refus.
 *
 * Le serveur renvoie un code stable ; c'est ici qu'on decide ce que le pompiste lit. Il n'a que
 * faire d'un identifiant de bon : il veut savoir s'il sert, et sinon pourquoi, en une phrase.
 */
function motifLisible(erreur: ErreurApi): string {
  const consommeA = typeof erreur.details.consommeA === 'string' ? erreur.details.consommeA : null;
  const memeStation = erreur.details.memeStation === true;

  switch (erreur.code) {
    case 'DEJA_SERVI':
      return consommeA === null
        ? 'Ce bon a déjà été utilisé.'
        : memeStation
          ? `Déjà servi ici à ${heure(consommeA)}.`
          : `Déjà servi à ${heure(consommeA)} dans une autre station.`;
    case 'BON_EXPIRE':
      return 'Ce bon a expiré. Le chauffeur doit en demander un nouveau.';
    case 'BON_ANNULE':
      return 'Ce bon a été annulé.';
    case 'BON_INCONNU':
      return 'Ce code ne correspond à aucun bon.';
    case 'QR_ILLISIBLE':
      return 'Ce code n’a pas été émis par Assur’Trans.';
    case 'BON_NON_CONFORME':
      return 'Ce bon est incohérent. Signalez-le à Assur’Trans.';
    default:
      return 'Vérification impossible.';
  }
}

export function Pompiste() {
  const { session, fermer } = useSession();
  const jeton = session?.token ?? '';

  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const enVol = useRef(false);

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [cameraKo, setCameraKo] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [manuel, setManuel] = useState(false);

  const consommer = useCallback(
    async (contenuQr: string) => {
      if (enVol.current) return;
      enVol.current = true;
      try {
        const r = await api.consommer(jeton, contenuQr, identifiantDeScan());
        setVerdict(
          r.dejaServi
            ? { type: 'deja', montant: r.montantXof }
            : { type: 'servir', montant: r.montantXof },
        );
      } catch (cause) {
        if (cause instanceof ErreurReseau) {
          setVerdict({
            type: 'refus',
            motif: 'Pas de réseau. Impossible de vérifier ce bon — ne servez pas.',
          });
        } else if (cause instanceof ErreurApi) {
          setVerdict({ type: 'refus', motif: motifLisible(cause) });
        } else {
          setVerdict({ type: 'refus', motif: 'Vérification impossible.' });
        }
      } finally {
        enVol.current = false;
      }
    },
    [jeton],
  );

  // Boucle de scan : une image toutes les ~200 ms suffit et menage la batterie.
  useEffect(() => {
    if (verdict !== null || manuel) return;

    let flux: MediaStream | null = null;
    let minuteur: number | undefined;
    let annule = false;

    async function demarrer() {
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (annule) {
          flux.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current !== null) {
          video.current.srcObject = flux;
          await video.current.play();
        }
        minuteur = window.setInterval(lireImage, 200);
      } catch {
        setCameraKo('Caméra indisponible. Saisissez le code du bon à la main.');
        setManuel(true);
      }
    }

    function lireImage() {
      const v = video.current;
      const c = canvas.current;
      if (v === null || c === null || v.readyState !== v.HAVE_ENOUGH_DATA) return;

      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx === null) return;

      ctx.drawImage(v, 0, 0, c.width, c.height);
      const image = ctx.getImageData(0, 0, c.width, c.height);
      const trouve = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert',
      });
      if (trouve !== null && trouve.data.length > 0) {
        void consommer(trouve.data);
      }
    }

    void demarrer();

    return () => {
      annule = true;
      if (minuteur !== undefined) window.clearInterval(minuteur);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [verdict, manuel, consommer]);

  if (verdict !== null) {
    const classe =
      verdict.type === 'servir' ? 'servir' : verdict.type === 'deja' ? 'deja' : 'refus';

    return (
      <div className={`verdict ${classe}`} role="alert">
        {verdict.type === 'servir' && (
          <>
            <p className="mot">Servir</p>
            <p className="ligne-somme">
              <span className="montant somme">{francs(verdict.montant)}</span>
              <span className="unite">FCFA</span>
            </p>
          </>
        )}

        {verdict.type === 'deja' && (
          <>
            <p className="mot">Déjà servi</p>
            <p className="motif">
              Ce même scan a déjà été validé. Ne servez pas une seconde fois.
            </p>
          </>
        )}

        {verdict.type === 'refus' && (
          <>
            <p className="mot">Ne pas servir</p>
            <p className="motif">{verdict.motif}</p>
          </>
        )}

        <button
          className="bouton sortie"
          type="button"
          autoFocus
          onClick={() => {
            setVerdict(null);
            setSaisie('');
          }}
        >
          Scanner le bon suivant
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="barre">
        <span className="marque">Assur'Trans</span>
        <span className="qui">Station {session?.stationId ?? '—'}</span>
        <button type="button" onClick={fermer}>
          Quitter
        </button>
      </header>

      <main className="vue">
        <div>
          <h1 className="titre">Scannez le code du chauffeur.</h1>
          <p className="chapo">Le montant à servir s’affiche aussitôt.</p>
        </div>

        {!manuel && (
          <div className="viseur">
            <video ref={video} playsInline muted />
            <div className="cadre" aria-hidden="true" />
            <p className="indication">Cadrez le code</p>
          </div>
        )}

        <canvas ref={canvas} hidden />

        {cameraKo !== null && <p className="message info">{cameraKo}</p>}

        {manuel ? (
          <form
            className="pile"
            onSubmit={(e) => {
              e.preventDefault();
              void consommer(saisie.trim());
            }}
          >
            <label className="champ">
              <span className="etiquette">Code du bon</span>
              <input
                autoFocus
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="AT1…"
              />
            </label>
            <button className="bouton" type="submit" disabled={saisie.trim().length === 0}>
              Vérifier
            </button>
            <button className="bouton discret" type="button" onClick={() => setManuel(false)}>
              Revenir au scan
            </button>
          </form>
        ) : (
          <button className="bouton secondaire" type="button" onClick={() => setManuel(true)}>
            Saisir le code à la main
          </button>
        )}
      </main>
    </div>
  );
}
