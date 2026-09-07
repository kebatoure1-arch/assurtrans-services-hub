/**
 * Aiguillage.
 *
 * Pas de menu, pas d'onglets : le role decide de l'ecran. Un chauffeur ne voit jamais l'ecran
 * du pompiste, et reciproquement. C'est plus sur, et c'est surtout plus simple pour ceux qui
 * n'ouvrent l'application que pour une seule chose.
 */

import { Connexion } from './pages/Connexion.tsx';
import { Chauffeur } from './pages/Chauffeur.tsx';
import { Pompiste } from './pages/Pompiste.tsx';
import { Admin } from './pages/Admin.tsx';
import { FournisseurSession, useSession } from './lib/session.tsx';

function Aiguillage() {
  const { session } = useSession();

  if (session === null) return <Connexion />;
  if (session.role === 'DRIVER') return <Chauffeur />;
  if (session.role === 'STATION_OPERATOR') return <Pompiste />;

  return <Admin />;
}

export function App() {
  return (
    <FournisseurSession>
      <Aiguillage />
    </FournisseurSession>
  );
}
