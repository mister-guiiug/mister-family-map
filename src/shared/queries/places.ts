import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../../app/providers/BackendProvider';
import type { PlaceQuery } from '../api/ports';
import { queryKeys } from './keys';

/**
 * Liste des lieux — filtres optionnels (auteur, statuts, corbeille…).
 *
 * `offlineFirst` : en `'online'` (le défaut), Query met une requête en PAUSE
 * hors ligne, sans appeler la `queryFn` — et les écrans restaient en
 * squelette sans fin. Le backend local sert alors la liste depuis l'appareil.
 * Supabase, lui, n'a rien gardé : la lecture échoue, les nouvelles tentatives
 * attendent le réseau (`isPaused`), et les écrans le disent
 * (`OfflineEmptyState`).
 */
export function usePlacesList(
  query?: PlaceQuery,
  options?: { enabled?: boolean }
) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.places.list(query),
    queryFn: () => backend.places.list(query),
    enabled: options?.enabled ?? true,
    networkMode: 'offlineFirst',
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
