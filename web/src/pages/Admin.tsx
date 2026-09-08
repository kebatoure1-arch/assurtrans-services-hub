/**
 * Coque de l'espace d'administration.
 *
 * Trois sections, dans cet ordre : ce qu'on regarde, ce qu'on décide, ce qu'on tient à jour.
 * Un menu de dix entrées ferait perdre plus de temps qu'il n'en ferait gagner à trois personnes
 * qui ouvrent l'outil pour une raison précise.
 */

import { useState } from 'react';
import { Pilotage } from './admin/Pilotage.tsx';
import { Reglement } from './admin/Reglement.tsx';
import { Referentiel } from './admin/Referentiel.tsx';
import { useSession } from '../lib/session.tsx';

type Section = 'pilotage' | 'reglement' | 'referentiel';

export function Admin() {
  const { session, fermer } = useSession();
  const [section, setSection] = useState<Section>('pilotage');

  return (
    <div className="bureau">
      <header className="barre-bureau">
        <span className="marque">Assur'Trans</span>

        <nav aria-label="Sections">
          {(
            [
              ['pilotage', 'Pilotage'],
              ['reglement', 'Règlement'],
              ['referentiel', 'Référentiel'],
            ] as const
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              aria-current={section === cle}
              onClick={() => setSection(cle)}
            >
              {libelle}
            </button>
          ))}
        </nav>

        <div className="identite">
          <span className="qui">{session?.subject ?? ''}</span>
          <button type="button" onClick={fermer}>
            Quitter
          </button>
        </div>
      </header>

      <main className="vue-bureau">
        {section === 'pilotage' && <Pilotage />}
        {section === 'reglement' && <Reglement />}
        {section === 'referentiel' && <Referentiel />}
      </main>
    </div>
  );
}
