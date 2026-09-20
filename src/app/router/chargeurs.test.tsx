import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

/**
 * CE QUE CE TEST TIENT : la barre basse précharge EXACTEMENT ce que le routeur
 * charge — le même objet fonction, pas un second `() => import(…)` qui redit
 * le même chemin.
 *
 * POURQUOI ÇA COMPTE. `prefetch()` du socle retient dans un `WeakSet` les
 * chargeurs déjà lancés : deux fonctions distinctes pour la même page sont deux
 * entrées, et rien ne relie ce que la barre a préchauffé à ce que `lazy()` va
 * demander. Vite produit certes un seul morceau tant que les deux chemins sont
 * identiques — mais une page renommée d'un seul côté préchargerait une autre
 * page, sans qu'aucun test ne le voie. L'identité (`===`) est la seule preuve
 * qui ne dépende pas d'une lecture du code.
 *
 * DEUX ESPIONS, AUCUN DES DEUX N'ÉPROUVE LE SOCLE. `lazy` est enveloppé pour
 * noter ce que le routeur lui passe, et fait son travail normalement.
 * `prefetch` est REMPLACÉ : il note ce que la barre lui tend, sans lancer le
 * téléchargement — importer `MapPage` tirerait MapLibre GL dans jsdom.
 *
 * Le relevé de `lazy` vit dans un tableau, pas dans `mock.calls` : le routeur
 * appelle `lazy()` à l'IMPORT, avant le premier test, et Vitest efface
 * l'historique des mocks avant chaque test (`clearMocks`, vrai par défaut).
 */

const { passesALazy } = vi.hoisted(() => ({
  passesALazy: [] as Array<() => Promise<unknown>>,
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const lazy: typeof actual.lazy = charge => {
    passesALazy.push(charge);
    return actual.lazy(charge);
  };
  return { ...actual, lazy };
});

vi.mock('@mister-guiiug/dev-pwa-config/prefetch', () => ({
  prefetch: vi.fn(() => true),
}));

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

const { prefetch } = await import('@mister-guiiug/dev-pwa-config/prefetch');
const { chargeurs } = await import('./chargeurs');
// Le routeur déclare ses pages à l'import : c'est là que `lazy()` est appelé.
await import('./index');
const { RootLayout } = await import('../layouts/RootLayout');

/** Le shell réel, ses cinq onglets, et ce qu'ils tendent à `prefetch()`. */
function prechargerDepuisLaBarre() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        children: [{ index: true, element: <h1>Explorer</h1> }],
      },
    ],
    { initialEntries: ['/'] }
  );
  render(<RouterProvider router={router} />);

  const barre = screen.getByRole('navigation', {
    name: 'Navigation principale',
  });
  const onglets = within(barre).getAllByRole('link');
  // Le focus, pas le survol : c'est l'intention que le clavier exprime, et
  // React l'écoute sans qu'il faille simuler la paire `pointerover/enter`.
  for (const onglet of onglets) fireEvent.focus(onglet);

  return {
    onglets,
    tendus: vi.mocked(prefetch).mock.calls.map(([charge]) => charge),
  };
}

afterEach(() => {
  cleanup();
});

describe('un seul chargeur par page', () => {
  it('le routeur passe à lazy() les chargeurs nommés — tous, et rien d’autre', () => {
    const nommes = Object.values(chargeurs);

    expect(passesALazy).toHaveLength(nommes.length);
    for (const charge of nommes) expect(passesALazy).toContain(charge);
  });

  it('chaque onglet précharge LE chargeur que lazy() a reçu : le même objet', () => {
    const { onglets, tendus } = prechargerDepuisLaBarre();

    expect(onglets).toHaveLength(5);
    expect(tendus).toHaveLength(5);
    // Cinq onglets, cinq pages : aucun chargeur tendu deux fois.
    expect(new Set(tendus).size).toBe(5);
    // `toContain` compare par référence : une copie du même `import(…)`
    // échouerait ici, et c'est le but.
    for (const charge of tendus) expect(passesALazy).toContain(charge);
  });
});
