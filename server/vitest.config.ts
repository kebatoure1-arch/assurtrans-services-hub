import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le module serveur est isolé du front : on neutralise la config PostCSS du projet parent.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      // La logique monétaire doit rester couverte à 100 %.
      include: ['src/domain/**/*.ts'],
      thresholds: { statements: 100, branches: 90, functions: 100, lines: 100 },
    },
  },
});
