import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  EmptyState,
  SkeletonGroup,
} from '@mister-guiiug/dev-pwa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { useFavoritesStore } from '../features/favorites/store';
import { PlaceCard } from '../features/places/components/PlaceCard';
import { PageHeader } from '../shared/components/PageHeader';

/**
 * Favoris — disponibles hors ligne : les identifiants vivent en stockage
 * local et les fiches du backend local aussi ; avec Supabase, les fiches déjà
 * consultées restent servies par le cache applicatif.
 */
export default function FavoritesPage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const favorites = useFavoritesStore();

  const placesState = useAsync(() => backend.places.list(), 'static');

  const favoritePlaces = useMemo(
    () => (placesState.data ?? []).filter(p => favorites.ids.includes(p.id)),
    [placesState.data, favorites.ids]
  );

  return (
    <div>
      <PageHeader
        title="Favoris"
        subtitle="Vos idées de sorties mises de côté"
      />
      <div className="px-fluid-md pb-8">
        {placesState.loading ? (
          <SkeletonGroup label="Chargement des favoris" lines={3} />
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
