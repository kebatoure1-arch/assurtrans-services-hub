/**
 * Coque de l'espace d'administration.
 *
 * Deux sections seulement, et dans cet ordre : ce qui demande une décision, puis ce qu'on tient
 * à jour. Un menu de dix entrées ferait perdre plus de temps qu'il n'en ferait gagner à trois
 * personnes qui ouvrent l'outil pour une raison précise.
 */

import { useState } from 'react';
import { Pilotage } from './admin/Pilotage.tsx';
import { Referentiel } from './admin/Referentiel.tsx';
import { useSession } from '../lib/session.tsx';

type Section = 'pilotage' | 'referentiel';

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
        {section === 'pilotage' ? <Pilotage /> : <Referentiel />}
      </main>
    </div>
  );
}
