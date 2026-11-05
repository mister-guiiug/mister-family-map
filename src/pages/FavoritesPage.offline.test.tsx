import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { onlineManager } from '@tanstack/react-query';
import { BackendProvider } from '../app/providers/BackendProvider';
import { createLocalBackend } from '../shared/api/local/local-backend';
import type { Backend } from '../shared/api/ports';
import { useFavoritesStore } from '../features/favorites/store';
import {
  clearQueryClient,
  wrapWithQueryClient,
} from '../shared/queries/testing';
import ExplorePage from './ExplorePage';
import FavoritesPage from './FavoritesPage';

/**
 * HORS LIGNE, LES FAVORIS ET EXPLORER NE CHARGENT PLUS SANS FIN (audit hors
 * ligne du 05/11/2026).
 *
 * Query met en PAUSE une requête hors ligne (`networkMode: 'online'`, son
 * défaut) : la `queryFn` ne part jamais, et l'écran attend dans son
 * squelette. Deux cas, deux réponses :
 *  - backend LOCAL : la liste vit sur l'appareil, elle doit s'afficher ;
 *  - backend Supabase : rien n'est gardé sur l'appareil, l'écran doit le
 *    DIRE au lieu de promettre un chargement qui n'arrivera pas.
 */

/** Supabase hors ligne : la lecture échoue, comme `fetch` sans réseau. */
function supabaseHorsLigne(local: Backend): Backend {
  return {
    ...local,
    places: {
      ...local.places,
      requiresNetwork: true,
      list: () => Promise.reject(new Error('TypeError: Failed to fetch')),
    },
  };
}

function monter(backend: Backend, page: 'favoris' | 'explorer') {
  render(
    wrapWithQueryClient(
      <MemoryRouter>
        <BackendProvider backend={backend}>
          {page === 'favoris' ? <FavoritesPage /> : <ExplorePage />}
        </BackendProvider>
      </MemoryRouter>
    )
  );
}

describe('hors ligne, la liste des lieux', () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoritesStore.setState({ ids: [], loaded: false });
    onlineManager.setOnline(false);
  });
  afterEach(() => {
    onlineManager.setOnline(true);
    clearQueryClient();
  });

  it('backend local : les favoris s’affichent depuis l’appareil', async () => {
    const backend = createLocalBackend();
    const [lieu] = await backend.places.list();
    if (!lieu) throw new Error('données de démonstration absentes');
    useFavoritesStore.setState({ ids: [lieu.id], loaded: true });

    monter(backend, 'favoris');

    expect(
      await screen.findByRole('link', { name: lieu.name })
    ).toBeInTheDocument();
  });

  it('Supabase : les favoris disent qu’on est hors ligne, sans squelette', async () => {
    monter(supabaseHorsLigne(createLocalBackend()), 'favoris');

    expect(
      await screen.findByText(/se chargeront au retour du réseau/, undefined, {
        timeout: 3000,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement des favoris')).toBeNull();
  });

  it('Supabase : Explorer dit qu’on est hors ligne, sans squelette', async () => {
    monter(supabaseHorsLigne(createLocalBackend()), 'explorer');

    expect(
      await screen.findByText(/se chargeront au retour du réseau/, undefined, {
        timeout: 3000,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement des lieux')).toBeNull();
  });
});
