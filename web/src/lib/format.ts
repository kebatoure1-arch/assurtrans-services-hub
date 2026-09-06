/** Mise en forme. Le franc CFA est entier : aucune decimale n'apparait jamais. */

const espaceFine = '\u202f';

export function francs(montant: number): string {
  return Math.trunc(montant)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, espaceFine);
}

export function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function jourEtHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** « expire dans 3 h 20 » plutot qu'un horodatage que personne ne convertit de tete. */
export function restant(iso: string, maintenant = Date.now()): string {
  const ms = Date.parse(iso) - maintenant;
  if (ms <= 0) return 'expire';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}
