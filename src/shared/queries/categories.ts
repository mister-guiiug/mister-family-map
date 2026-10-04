import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../../app/providers/BackendProvider';
import { queryKeys } from './keys';

/** Catégories actives — listes déroulantes et filtres. */
export function useActiveCategories() {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.categories.listActive(),
    queryFn: () => backend.categories.listActive(),
  });
}
