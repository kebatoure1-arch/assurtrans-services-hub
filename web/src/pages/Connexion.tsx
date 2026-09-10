/**
 * Connexion par numéro de téléphone.
 *
 * Deux étapes, une seule chose à faire par écran. Le clavier s'ouvre directement sur les
 * chiffres, le champ du code accepte le collage et la saisie automatique du SMS.
 */

import { useEffect, useRef, useState } from 'react';
import { ErreurApi, ErreurReseau, api } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';

type Etape = 'numero' | 'code';

export function Connexion() {
  const { ouvrir } = useSession();
  const [etape, setEtape] = useState<Etape>('numero');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [codeEcho, setCodeEcho] = useState<string | null>(null);

  const champCode = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (etape === 'code') champCode.current?.focus();
  }, [etape]);

  function message(cause: unknown): string {
    if (cause instanceof ErreurReseau) {
      return 'Pas de connexion. Vérifiez le réseau et réessayez.';
    }
    if (cause instanceof ErreurApi) return cause.message;
    return 'La demande n’a pas abouti.';
  }

  async function envoyerCode(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const r = await api.demanderCode(telephone);
      setCodeEcho(r.code ?? null);
      setEtape('code');
    } catch (cause) {
      setErreur(message(cause));
    } finally {
      setEnCours(false);
    }
  }

  async function verifierCode(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      ouvrir(await api.ouvrirSession(telephone, code));
    } catch (cause) {
      setErreur(message(cause));
      setCode('');
      champCode.current?.focus();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="app">
      <header className="barre">
        <span className="marque">Assur'Trans</span>
      </header>

      <main className="vue">
        {etape === 'numero' ? (
          <form className="pile" onSubmit={envoyerCode}>
            <div>
              <h1 className="titre">Votre carburant, payé d’avance.</h1>
              <p className="chapo">
                Entrez votre numéro. Nous vous envoyons un code à six chiffres.
              </p>
            </div>

            <label className="champ">
              <span className="etiquette">Numéro de téléphone</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                placeholder="77 000 00 01"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                required
              />
              <p className="aide">
                Sénégal ou Côte d’Ivoire. Sans indicatif, ou avec : les deux fonctionnent.
              </p>
            </label>

            {erreur !== null && <p className="message erreur">{erreur}</p>}

            <button className="bouton" type="submit" disabled={enCours || telephone.length < 6}>
              {enCours ? 'Envoi…' : 'Recevoir mon code'}
            </button>
          </form>
        ) : (
          <form className="pile" onSubmit={verifierCode}>
            <div>
              <h1 className="titre">Entrez le code</h1>
              <p className="chapo">Envoyé au {telephone}. Il vaut cinq minutes.</p>
            </div>

            <label className="champ">
              <span className="etiquette">Code à six chiffres</span>
              <input
                ref={champCode}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </label>

            {codeEcho !== null && (
              <p className="message info">
                Passerelle SMS non branchée : votre code est <strong>{codeEcho}</strong>.
              </p>
            )}

            {erreur !== null && <p className="message erreur">{erreur}</p>}

            <button className="bouton" type="submit" disabled={enCours || code.length !== 6}>
              {enCours ? 'Vérification…' : 'Se connecter'}
            </button>

            <button
              className="bouton discret"
              type="button"
              onClick={() => {
                setEtape('numero');
                setCode('');
                setErreur(null);
                setCodeEcho(null);
              }}
            >
              Corriger le numéro
            </button>
          </form>
        )}
      </main>

      <p className="pied">Assur'Trans · carburant et couverture santé</p>
    </div>
  );
}
