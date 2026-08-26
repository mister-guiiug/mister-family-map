import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

/**
 * LE DÉFAUT QUE CE TEST TIENT. `<UpdatePromptBanner />` était monté dans
 * `RootLayout` SANS `registerSW`. Le socle n'avait alors personne pour lui
 * annoncer qu'un worker attendait : `needRefresh` restait faux et le bandeau
 * ne pouvait structurellement jamais s'afficher. Monté, mais muet — le même
 * défaut que la version, livrée dans le bundle et invisible à l'écran, et que
 * les trois composants du socle laissés au vestiaire.
 *
 * Rien ne le signalait : pas d'erreur, pas d'avertissement, un composant bien
 * présent dans l'arbre React. Seul un utilisateur pouvait s'en apercevoir — en
 * ne voyant jamais la mise à jour arriver. C'est donc le SHELL RÉEL qui est
 * monté ici, pas le composant du paquet : ce qu'on éprouve est le câblage.
 */

// `virtual:pwa-register` n'existe que dans un build Vite. Le double annonce un
// worker en attente dès l'enregistrement, comme le fait vite-plugin-pwa.
const registerSW = vi.fn((options?: { onNeedRefresh?: () => void }) => {
  options?.onNeedRefresh?.();
  return vi.fn();
});
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options?: { onNeedRefresh?: () => void }) => registerSW(options),
}));

vi.mock('../providers/BackendProvider', () => ({
  useBackend: () => ({ auth: {}, favorites: {} }),
}));
vi.mock('../../features/auth/store', () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ init: async () => {} }),
}));
vi.mock('../../features/favorites/store', () => ({
  useFavoritesStore: (select: (s: unknown) => unknown) =>
    select({ load: async () => {} }),
}));

const { RootLayout } = await import('./RootLayout');

describe('le shell annonce les mises à jour', () => {
  it('affiche le bandeau quand un service worker attend', () => {
    // `ScrollRestoration` exige un routeur de données : le shell se monte
    // comme l'application le monte, pas dans un décor allégé.
    const router = createMemoryRouter([{ path: '/', element: <RootLayout /> }]);
    render(<RouterProvider router={router} />);

    expect(registerSW).toHaveBeenCalled();
    const banner = document.querySelector('[data-dwc="update-banner"]');
    expect(banner).not.toBeNull();
    // Et il offre une sortie : un bandeau sans échappatoire est un piège.
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });
});
