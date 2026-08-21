import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  EmptyState,
  ErrorBanner,
  SkeletonGroup,
} from '@mister-guiiug/dev-wpa-config/react';
import { ListFilter } from 'lucide-react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { applyFilters } from '../shared/schemas/filters';
import { isInBoundingBox, type BoundingBox } from '../shared/lib/geo';
import { useSearchStore } from '../features/search/store';
import { useFavoritesStore } from '../features/favorites/store';
import { MapView } from '../features/map/components/MapView';
import { FilterSheet } from '../features/search/components/FilterSheet';
import { PlaceCard } from '../features/places/components/PlaceCard';
import { PageHeader } from '../shared/components/PageHeader';

/**
 * Carte et liste SYNCHRONISÉES : mêmes filtres (store partagé), la liste se
 * restreint à la zone visible quand « Rechercher dans cette zone » est actif.
 */
export default function MapPage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleArea, setVisibleArea] = useState<BoundingBox | null>(null);
  const [restrictToArea, setRestrictToArea] = useState(false);
  const { filters, origin, setOrigin } = useSearchStore();
  const favorites = useFavoritesStore();

  const placesState = useAsync(() => backend.places.list(), 'static');
  const categoriesState = useAsync(
    () => backend.categories.listActive(),
    'static'
  );
  const categories = categoriesState.data ?? [];
  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    if (!placesState.data) return [];
    const base = applyFilters(placesState.data, filters, {
      ...(origin ? { origin } : {}),
    });
    if (restrictToArea && visibleArea) {
      return base.filter(p => isInBoundingBox(p.coordinates, visibleArea));
    }
    return base;
  }, [placesState.data, filters, origin, restrictToArea, visibleArea]);

  return (
    <div>
      <PageHeader
        title="Carte"
        subtitle="Les résultats de la liste suivent la carte"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFiltersOpen(true)}
          >
            <ListFilter size={18} aria-hidden="true" />
            Filtres
          </Button>
        }
      />

      <div className="px-fluid-md">
        {placesState.error ? (
          <ErrorBanner
            message={placesState.error}
            onRetry={placesState.reload}
          />
        ) : (
          <MapView
            places={filtered}
            onOpenPlace={id => {
              if (!id.startsWith('cluster-')) navigate(`/lieux/${id}`);
            }}
            onViewportChange={viewport => setVisibleArea(viewport.bounds)}
            onUserLocated={setOrigin}
          />
        )}

        <div className="mt-2 flex items-center gap-2">
          <Button
            variant={restrictToArea ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={restrictToArea}
            onClick={() => setRestrictToArea(v => !v)}
          >
            Rechercher dans cette zone
          </Button>
          <p className="text-fluid-xs text-ink-soft" role="status">
            {filtered.length} lieu{filtered.length > 1 ? 'x' : ''} affiché
            {filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <section
        aria-label="Liste des lieux visibles"
        className="mt-4 px-fluid-md"
      >
        {placesState.loading ? (
          <SkeletonGroup label="Chargement des lieux" lines={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Aucun lieu dans cette zone"
            description="Déplacez la carte ou élargissez les filtres."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map(place => (
              <li key={place.id}>
                <PlaceCard
                  place={place}
                  category={categoryById.get(place.categoryId)}
                  isFavorite={favorites.ids.includes(place.id)}
                  onToggleFavorite={id =>
                    void favorites.toggle(backend.favorites, id)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
      />
    </div>
  );
}
