import { create } from 'zustand';
import {
  EMPTY_FILTERS,
  type SearchFilters,
} from '../../shared/schemas/filters';
import type { Coordinates } from '@mister-guiiug/dev-wpa-config/geo';

/**
 * Filtres de recherche partagés entre Explorer, Carte et Agenda : ils sont
 * CONSERVÉS pendant la navigation (store mémoire, réinitialisation explicite).
 */
interface SearchState {
  filters: SearchFilters;
  /** Position de référence — uniquement après consentement explicite. */
  origin: Coordinates | null;
  setFilters: (filters: Partial<SearchFilters>) => void;
  setOrigin: (origin: Coordinates | null) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>(set => ({
  filters: EMPTY_FILTERS,
  origin: null,
  setFilters(partial) {
    set(state => ({ filters: { ...state.filters, ...partial } }));
  },
  setOrigin(origin) {
    set({ origin });
  },
  reset() {
    set({ filters: EMPTY_FILTERS });
  },
}));
