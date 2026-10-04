import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../../app/providers/BackendProvider';
import type { EventQuery } from '../api/ports';
import { queryKeys } from './keys';

/** Liste des événements — filtres optionnels (lieu, auteur, corbeille…). */
export function useEventsList(
  query?: EventQuery,
  options?: { enabled?: boolean }
) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.events.list(query),
    queryFn: () => backend.events.list(query),
    enabled: options?.enabled ?? true,
  });
}

/** Fiche événement par identifiant. */
export function useEvent(id: string) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => backend.events.getById(id),
    enabled: id.length > 0,
  });
}
