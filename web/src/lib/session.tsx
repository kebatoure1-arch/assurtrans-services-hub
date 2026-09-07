/**
 * Session locale.
 *
 * Le jeton vit dans `localStorage` : sur un telephone partage ou perdu, il n'a de valeur que
 * jusqu'a son expiration, que le serveur fait respecter. On verifie aussi l'echeance ici pour
 * eviter d'afficher une session morte et de laisser l'utilisateur decouvrir le probleme au
 * moment ou il en a besoin.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Session } from './api.ts';
import { oublierBons } from './dernier-bon.ts';

const CLE = 'assurtrans.session';

function lire(): Session | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut === null) return null;
    const session = JSON.parse(brut) as Session;
    if (Date.parse(session.expireA) <= Date.now()) {
      localStorage.removeItem(CLE);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

interface ContexteSession {
  readonly session: Session | null;
  ouvrir(session: Session): void;
  fermer(): void;
}

const Contexte = createContext<ContexteSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(lire);

  const ouvrir = useCallback((s: Session) => {
    try {
      localStorage.setItem(CLE, JSON.stringify(s));
    } catch {
      // Navigation privee ou stockage refuse : la session tient le temps de l'onglet.
    }
    setSession(s);
  }, []);

  const fermer = useCallback(() => {
    try {
      localStorage.removeItem(CLE);
    } catch {
      /* rien a faire */
    }
    // Un bon est un titre de carburant : il ne reste pas sur un appareil que son proprietaire
    // vient de quitter. Les telephones se pretent.
    oublierBons();
    setSession(null);
  }, []);

  const valeur = useMemo(() => ({ session, ouvrir, fermer }), [session, ouvrir, fermer]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): ContexteSession {
  const c = useContext(Contexte);
  if (c === null) throw new Error('useSession hors du fournisseur');
  return c;
}
