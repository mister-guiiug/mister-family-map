import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../../app/providers/BackendProvider';
import type { PlaceQuery } from '../api/ports';
import { queryKeys } from './keys';

/** Liste des lieux — filtres optionnels (auteur, statuts, corbeille…). */
export function usePlacesList(
  query?: PlaceQuery,
  options?: { enabled?: boolean }
) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.places.list(query),
    queryFn: () => backend.places.list(query),
    enabled: options?.enabled ?? true,
  });
}

/** Fiche lieu par identifiant. */
export function usePlace(id: string) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.places.detail(id),
    queryFn: () => backend.places.getById(id),
    enabled: id.length > 0,
  });
}
