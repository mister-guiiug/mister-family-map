import { create } from 'zustand';
import type { FavoriteRepository } from '../../shared/api/ports';

interface FavoritesState {
  ids: readonly string[];
  loaded: boolean;
  load: (repo: FavoriteRepository) => Promise<void>;
  /**
   * Pose la liste telle qu'un AUTRE onglet vient de l'écrire.
   *
   * Sans elle, la synchronisation entre onglets relisait le stockage — qui,
   * dans l'onglet receveur, peut ne pas encore avoir reçu l'écriture de
   * l'émetteur (en-tête de `shared/api/tab-sync.ts`).
   */
  setIds: (ids: readonly string[]) => void;
  toggle: (repo: FavoriteRepository, placeId: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: [],
  loaded: false,
  async load(repo) {
    set({ ids: await repo.listIds(), loaded: true });
  },
  setIds(ids) {
    set({ ids, loaded: true });
  },
  async toggle(repo, placeId) {
    const { ids } = get();
    if (ids.includes(placeId)) {
      await repo.remove(placeId);
      set({ ids: ids.filter(id => id !== placeId) });
    } else {
      await repo.add(placeId);
      set({ ids: [...ids, placeId] });
    }
  },
}));
