/**
 * Coque de l'espace d'administration.
 *
 * Cinq sections, dans cet ordre : ce qu'on regarde, ce qu'on décide, ce qu'on contrôle, ce
 * qu'on tient à jour, et ce qui s'est passé. Le journal vient en dernier parce qu'on l'ouvre
 * après coup — jamais pour agir, toujours pour comprendre.
 * Un menu de dix entrées ferait perdre plus de temps qu'il n'en ferait gagner à trois personnes
 * qui ouvrent l'outil pour une raison précise.
 */

import { useState } from 'react';
import { Pilotage } from './admin/Pilotage.tsx';
import { Journal } from './admin/Journal.tsx';
import { Rapprochement } from './admin/Rapprochement.tsx';
import { Reglement } from './admin/Reglement.tsx';
import { Referentiel } from './admin/Referentiel.tsx';
import { useSession } from '../lib/session.tsx';

type Section = 'pilotage' | 'reglement' | 'rapprochement' | 'referentiel' | 'journal';

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
              ['rapprochement', 'Rapprochement'],
              ['referentiel', 'Référentiel'],
              ['journal', 'Journal'],
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
        {section === 'rapprochement' && <Rapprochement />}
        {section === 'referentiel' && <Referentiel />}
        {section === 'journal' && <Journal />}
      </main>
    </div>
  );
}
