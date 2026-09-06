import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  // Le front est autonome : aucune variable d'environnement sensible n'entre dans le bundle.
  // Seule l'adresse de l'API est configurable, et c'est une information publique.
  envPrefix: 'ASSURTRANS_',
});
