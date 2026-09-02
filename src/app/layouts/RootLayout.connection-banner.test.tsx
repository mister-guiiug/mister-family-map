import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

/**
 * CE QUE CE TEST TIENT. Le bandeau hors-ligne précédent lisait `useOnline`
 * sans temporisation : il s'allumait à la milliseconde où `navigator.onLine`
 * basculait. Sur mobile — un tunnel, un ascenseur, un passage d'antenne —
 * cela produisait un clignotement, et un signal qui clignote finit ignoré.
 *
 * Le comportement éprouvé ici est donc un comportement d'USAGE, pas la
 * mécanique du composant (le paquet la couvre chez lui) : ce qui est vérifié,
 * c'est qu'une micro-coupure ne fait RIEN apparaître, qu'une vraie coupure
 * finit par parler, et que le texte affiché est celui de cette app — « hors
 * ligne » seul ne dit pas ce qui marche encore, et c'est la seule chose que
 * la famille veut savoir devant l'écran.
 *
 * Le shell RÉEL est monté, pas le composant du paquet : ce qu'on éprouve est
 * le câblage.
 */

// Aucun worker en attente : le bandeau de mise à jour reste muet, seul celui
// de connexion est en jeu.
vi.mock('virtual:pwa-register', () => ({
  registerSW: () => () => {},
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

/** Le shell se monte comme l'app le monte (`ScrollRestoration` exige un routeur de données). */
function mountShell() {
  const router = createMemoryRouter([{ path: '/', element: <RootLayout /> }]);
  render(<RouterProvider router={router} />);
}

const banner = () => document.querySelector('[data-dwc="connection-banner"]');

/** La coupure telle que le navigateur l'annonce. */
function goOffline() {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}
function goOnline() {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('le shell dit qu’on est hors connexion — après un délai, pas avant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ne dit rien tant que la coupure n’a pas duré', () => {
    mountShell();
    expect(banner()).toBeNull();

    goOffline();
    // À l'instant de la coupure : rien. C'est ce que l'ancien bandeau ratait.
    expect(banner()).toBeNull();

    wait(1499);
    expect(banner()).toBeNull();
  });

  it('ignore une micro-coupure : réseau revenu avant la fin du délai', () => {
    mountShell();
    goOffline();
    wait(900);
    expect(banner()).toBeNull();
    goOnline();
    // Le compteur est remis à zéro : même en laissant filer le temps, rien ne
    // doit apparaître — la coupure est finie.
    wait(5000);
    expect(banner()).toBeNull();
  });

  it('parle après la temporisation, et dit ce qui reste utilisable', () => {
    mountShell();
    goOffline();
    wait(1500);

    const shown = banner();
    expect(shown).not.toBeNull();
    expect(shown).toHaveAttribute('role', 'status');
    expect(shown).toHaveTextContent(
      /vos favoris et les fiches déjà consultées restent disponibles/
    );
  });

  it('se tait dès le retour du réseau', () => {
    mountShell();
    goOffline();
    wait(1500);
    expect(banner()).not.toBeNull();

    goOnline();
    expect(banner()).toBeNull();
  });
});
