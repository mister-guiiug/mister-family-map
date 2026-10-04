import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from './keys';

/**
 * Invalide les lectures « mes contributions » (lieux, événements, avis).
 * Remplace l'ancien `reloadAll` qui rappelait trois `useAsync.reload`.
 */
export function useInvalidateContributions() {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ queryKey: queryKeys.places.all });
    void client.invalidateQueries({ queryKey: queryKeys.events.all });
    void client.invalidateQueries({ queryKey: queryKeys.reviews.all });
  }, [client]);
}
