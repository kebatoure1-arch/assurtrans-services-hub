import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    include: ['test/integration/**/*.spec.ts'],
    // Les tests d'intégration partagent une base : ils s'exécutent en série pour que les
    // scénarios de concurrence testent la concurrence qu'ils décrivent, pas celle du lanceur.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
