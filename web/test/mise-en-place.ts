/**
 * Mise en place des tests d'interface.
 *
 * Trois capacites du navigateur n'existent pas sous jsdom et doivent etre fournies :
 * la camera, le rendu de QR sur canvas, et la boite de dialogue native. Chacune est
 * remplacee par une doublure explicite plutot que par un contournement silencieux.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// `qrcode` dessine sur un canvas, que jsdom n'implemente pas. Le contenu du QR est verifie
// par ailleurs cote serveur ; ici seule sa presence a l'ecran nous interesse.
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,QR'),
  },
}));

// `jsqr` n'est appele que sur des images de camera, absentes en test.
vi.mock('jsqr', () => ({ default: vi.fn(() => null) }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
