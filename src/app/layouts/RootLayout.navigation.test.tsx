import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazy, Suspense, type ComponentType } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

/**
 * CE QUE CE TEST TIENT : un onglet touché RÉPOND, même quand la page n'est pas
 * encore là.
 *
 * Le shell précharge déjà les pages à l'intention — `pointerenter`, `focus`,
 * `touchstart`. Mais un doigt qui se pose et relâche aussitôt, ou un morceau de
 * 280 ko compressés (MapLibre GL), ne laissent pas ce répit ; et là, le clic
 * était MUET. Relevé le 20/09/2026 sur l'application réelle : à 8 ms l'adresse
 * disait déjà `/agenda` pendant que l'écran affichait encore « Explorer », et
 * le `SkeletonGroup` « Chargement de la page » du routeur n'est jamais apparu.
 *
 * Il ne pouvait pas : react-router enveloppe tout changement d'URL dans
 * `startTransition`, et React 19 garde délibérément l'écran déjà affiché
 * plutôt que de le remplacer par un repli. La frontière `Suspense` que pose
 * `page()` est réutilisée d'une route à l'autre, jamais remontée.
 *
 * On éprouve donc le CONTRAT du shell — l'onglet se déclare occupé, le
 * chargement est annoncé, et le navigateur garde ses gestes — face à une page
 * dont le test décide lui-même de l'arrivée.
 */

vi.mock('virtual:pwa-register', () => ({
  registerSW: () => () => {},
}));

vi.mock('../providers/BackendProvider', () => ({
  useBackend: () => ({ auth: {}, favorites: {} }),
}));
vi.mock('../../features/auth/store', () => ({
  useAuthStore: Object.assign(
    (select: (s: unknown) => unknown) =>
      select({ init: async () => {}, setSession: () => {} }),
    { getState: () => ({ setSession: () => {} }) }
  ),
}));
vi.mock('../../features/favorites/store', () => ({
  useFavoritesStore: (select: (s: unknown) => unknown) =>
    select({ load: async () => {}, setIds: () => {} }),
}));

const { RootLayout } = await import('./RootLayout');

/** Le shell réel, face à un « Agenda » dont on décide de l'arrivée. */
function monterFaceAUnePageLente() {
  let livre: (() => void) | undefined;
  const PageLente = lazy(
    () =>
      new Promise<{ default: ComponentType }>(resolve => {
        livre = () => resolve({ default: () => <h1>Agenda</h1> });
      })
  );

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <h1>Explorer</h1> },
          {
            path: 'agenda',
            // La même forme que `page()` du routeur : un repli par route, que
            // React ne montrera pourtant pas sur un clic.
            element: (
              <Suspense fallback={<p>Chargement de la page</p>}>
                <PageLente />
              </Suspense>
            ),
          },
        ],
      },
    ],
    { initialEntries: ['/'] }
  );

  render(<RouterProvider router={router} />);

  return {
    onglet: screen.getByRole('link', { name: 'Agenda' }),
    livreLaPage: async () => {
      // LA TRANSITION EST RENDUE DE FAÇON CONCURRENTE : au retour du clic,
      // React a bien posé `aria-busy`, mais il n'a pas encore rendu l'arbre de
      // la nouvelle route — or c'est CE rendu qui déclenche la fabrique de
      // `lazy`. On attend donc qu'elle ait tourné avant de livrer la page.
      await act(async () => {
        for (let i = 0; i < 50 && !livre; i += 1) {
          await new Promise(r => setTimeout(r, 1));
        }
      });
      expect(livre, "la page paresseuse n'a jamais été demandée").toBeTypeOf(
        'function'
      );
      await act(async () => {
        livre?.();
      });
    },
  };
}

afterEach(() => {
  cleanup();
});

describe('la barre basse répond au doigt', () => {
  it("déclare l'onglet occupé et annonce le chargement, puis s'efface", async () => {
    const { onglet, livreLaPage } = monterFaceAUnePageLente();

    fireEvent.click(onglet);

    // LE CŒUR DU DÉFAUT : ici, avant, il ne se passait rigoureusement rien.
    expect(onglet).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement de la page…'
    );
    // L'écran précédent est toujours là — c'est React 19 qui le veut ainsi,
    // et c'est précisément pourquoi l'onglet doit parler.
    expect(screen.getByRole('heading', { name: 'Explorer' })).toBeTruthy();

    await livreLaPage();

    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeTruthy();
    expect(onglet).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it("n'occupe que l'onglet touché, pas les quatre autres", async () => {
    const { onglet, livreLaPage } = monterFaceAUnePageLente();

    fireEvent.click(onglet);

    const occupes = screen
      .getAllByRole('link')
      .filter(a => a.getAttribute('aria-busy') === 'true');
    expect(occupes).toHaveLength(1);
    expect(occupes[0]).toBe(onglet);

    await livreLaPage();
  });

  it('laisse le navigateur ouvrir un nouvel onglet sur Ctrl+clic', () => {
    const { onglet } = monterFaceAUnePageLente();

    // On intercepte le clic pour piloter la transition ; il ne faut pas pour
    // autant confisquer les gestes du navigateur. On lit le verdict en fin de
    // propagation, puis on coupe la navigation : jsdom ne sait pas changer de
    // document et l'annoncerait par un « Not implemented ».
    let defautConfisque: boolean | undefined;
    const garde = (e: Event) => {
      defautConfisque = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', garde);
    fireEvent.click(onglet, { ctrlKey: true });
    document.removeEventListener('click', garde);

    expect(defautConfisque).toBe(false);
    expect(onglet).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('heading', { name: 'Explorer' })).toBeTruthy();
  });
});
