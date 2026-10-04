import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../../app/providers/BackendProvider';
import { averageRating } from '../../entities/review/model';
import { queryKeys } from './keys';

/** Avis publiés pour un lieu. */
export function useReviewsForPlace(placeId: string) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.reviews.forPlace(placeId),
    queryFn: () => backend.reviews.listForPlace(placeId),
    enabled: placeId.length > 0,
  });
}

/** Avis d'un auteur — « Mes contributions » (corbeille comprise). */
export function useReviewsByAuthor(
  authorId: string | undefined,
  options?: { includeDeleted?: boolean }
) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.reviews.byAuthor(authorId ?? '', options),
    queryFn: () =>
      authorId
        ? backend.reviews.listByAuthor(authorId, options)
        : Promise.resolve([]),
    enabled: Boolean(authorId),
  });
}

/**
 * Moyennes d'avis par lieu — une passe pour Explorer (suggestions + filtres).
 * Dépend de la liste des lieux déjà en cache.
 */
export function usePlaceRatingsMap(enabled: boolean) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.reviews.ratingsMap(),
    enabled,
    queryFn: async () => {
      const places = await backend.places.list();
      const ratings = new Map<string, number>();
      for (const place of places) {
        const rating = averageRating(
          await backend.reviews.listForPlace(place.id)
        );
        if (rating !== null) ratings.set(place.id, rating);
      }
      return ratings;
    },
  });
}
