import { create } from 'zustand';
import type { FavoriteRepository } from '../../shared/api/ports';

interface FavoritesState {
  ids: readonly string[];
  loaded: boolean;
  load: (repo: FavoriteRepository) => Promise<void>;
  toggle: (repo: FavoriteRepository, placeId: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: [],
  loaded: false,
  async load(repo) {
    set({ ids: await repo.listIds(), loaded: true });
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
