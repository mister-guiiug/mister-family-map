import type { EventQuery, PlaceQuery } from '../api/ports';

/**
 * Clés de cache TanStack Query — source unique pour invalidation.
 *
 * Les lectures ciblées (liste, détail, catégories actives, avis d'un lieu)
 * partagent ces préfixes ; un `invalidateQueries({ queryKey: places.all })`
 * rafraîchit toutes les variantes de liste et de détail.
 */
export const queryKeys = {
  places: {
    all: ['places'] as const,
    list: (query?: PlaceQuery) => ['places', 'list', query ?? {}] as const,
    detail: (id: string) => ['places', 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    listActive: () => ['categories', 'listActive'] as const,
  },
  events: {
    all: ['events'] as const,
    list: (query?: EventQuery) => ['events', 'list', query ?? {}] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    forPlace: (placeId: string) =>
      ['reviews', 'forPlace', placeId] as const,
    byAuthor: (authorId: string, options?: { includeDeleted?: boolean }) =>
      ['reviews', 'byAuthor', authorId, options ?? {}] as const,
    /** Moyennes par lieu — dérivé d'Explorer, pas un port du backend. */
    ratingsMap: () => ['reviews', 'ratingsMap'] as const,
  },
} as const;
