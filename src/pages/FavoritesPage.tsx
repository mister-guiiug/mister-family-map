import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  EmptyState,
  ErrorBanner,
  SkeletonGroup,
} from '@mister-guiiug/dev-pwa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useFavoritesStore } from '../features/favorites/store';
import { PlaceCard } from '../features/places/components/PlaceCard';
import { OfflineEmptyState } from '../shared/components/OfflineEmptyState';
import { PageHeader } from '../shared/components/PageHeader';
import { usePlacesList } from '../shared/queries/places';

/**
 * Favoris — les identifiants vivent en stockage local. Avec le backend local,
 * les fiches aussi : tout reste disponible hors ligne. Avec Supabase, rien
 * n'est gardé sur l'appareil : une liste jamais chargée ne se charge pas hors
 * ligne, et l'écran le dit au lieu de rester en squelette.
 */
export default function FavoritesPage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const favorites = useFavoritesStore();

  const placesQuery = usePlacesList();

  const favoritePlaces = useMemo(
    () => (placesQuery.data ?? []).filter(p => favorites.ids.includes(p.id)),
    [placesQuery.data, favorites.ids]
  );

  return (
    <div>
      <PageHeader
        title="Favoris"
        subtitle="Vos idées de sorties mises de côté"
      />
      <div className="px-fluid-md pb-8">
        {placesQuery.isPending && placesQuery.isPaused ? (
          <OfflineEmptyState what="Vos favoris" />
        ) : placesQuery.isPending ? (
          <SkeletonGroup label="Chargement des favoris" lines={3} />
        ) : placesQuery.error ? (
          // Sans cette branche, une lecture échouée tombait dans l'état vide :
          // « Aucun favori pour l'instant », à quelqu'un qui en a.
          <ErrorBanner
            message={placesQuery.error.message}
            onRetry={() => void placesQuery.refetch()}
          />
        ) : favoritePlaces.length === 0 ? (
          <EmptyState
            title="Aucun favori pour l’instant"
            description="Touchez le cœur d’une fiche pour la retrouver ici, même hors ligne."
            action={
              <Button variant="secondary" onClick={() => navigate('/')}>
                Explorer les lieux
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {favoritePlaces.map(place => (
              <li key={place.id}>
                <PlaceCard
                  place={place}
                  isFavorite
                  onToggleFavorite={id =>
                    void favorites.toggle(backend.favorites, id)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
