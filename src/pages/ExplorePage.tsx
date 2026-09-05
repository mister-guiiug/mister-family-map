import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ListFilter, Plus } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorBanner,
  SkeletonGroup,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { applyFilters, countActiveFilters } from '../shared/schemas/filters';
import { averageRating } from '../entities/review/model';
import { distanceKm } from '@mister-guiiug/dev-pwa-config/geo';
import { recommendPlaces } from '../shared/lib/recommend';
import { useSearchStore } from '../features/search/store';
import { useFavoritesStore } from '../features/favorites/store';
import { FilterSheet } from '../features/search/components/FilterSheet';
import { PlaceCard } from '../features/places/components/PlaceCard';
import { PageHeader } from '../shared/components/PageHeader';

/** Accueil « Explorer » : recherche, filtres, liste, suggestions transparentes. */
export default function ExplorePage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { filters, setFilters, origin } = useSearchStore();
  const favorites = useFavoritesStore();

  const placesState = useAsync(() => backend.places.list(), 'static');
  const categoriesState = useAsync(
    () => backend.categories.listActive(),
    'static'
  );
  const reviewsByPlace = useAsync(async () => {
    const places = await backend.places.list();
    const ratings = new Map<string, number>();
    for (const place of places) {
      const rating = averageRating(
        await backend.reviews.listForPlace(place.id)
      );
      if (rating !== null) ratings.set(place.id, rating);
    }
    return ratings;
  }, 'static');

  const categories = categoriesState.data ?? [];
  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    if (!placesState.data) return [];
    return applyFilters(placesState.data, filters, {
      ...(origin ? { origin } : {}),
      ...(reviewsByPlace.data ? { ratings: reviewsByPlace.data } : {}),
    });
  }, [placesState.data, filters, origin, reviewsByPlace.data]);

  const suggestions = useMemo(() => {
    if (!placesState.data) return [];
    return recommendPlaces(
      placesState.data,
      {
        ...(origin ? { origin } : {}),
        favoriteCategoryIds: [],
      },
      reviewsByPlace.data ? { ratings: reviewsByPlace.data } : {},
      3
    );
  }, [placesState.data, origin, reviewsByPlace.data]);

  const activeFilters = countActiveFilters(filters);

  return (
    <div>
      <PageHeader
        title="Explorer"
        subtitle="Des idées de sorties testées par des familles"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/lieux/nouveau')}
          >
            <Plus size={18} aria-hidden="true" />
            Ajouter un lieu
          </Button>
        }
      />

      <div className="flex items-end gap-2 px-fluid-md">
        <div className="flex-1">
          <TextField
            label="Rechercher"
            type="search"
            placeholder="Nom, commune…"
            value={filters.query ?? ''}
            onChange={e =>
              setFilters({
                query: e.target.value === '' ? undefined : e.target.value,
              })
            }
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen(true)}
          aria-label={`Filtres${activeFilters > 0 ? ` (${activeFilters} actifs)` : ''}`}
        >
          <ListFilter size={18} aria-hidden="true" />
          Filtres{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </Button>
      </div>

      <section aria-label="Résultats" className="mt-4 px-fluid-md">
        {placesState.loading ? (
          <SkeletonGroup label="Chargement des lieux" lines={4} />
        ) : placesState.error ? (
          <ErrorBanner
            message={placesState.error}
            onRetry={placesState.reload}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Aucune activité ne correspond"
            description="Essayez d’élargir la zone ou de retirer des filtres — ou ajoutez le lieu qui manque !"
            action={
              <Button
                variant="secondary"
                onClick={() => navigate('/lieux/nouveau')}
              >
                Proposer un lieu
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map(place => (
              <li key={place.id}>
                <PlaceCard
                  place={place}
                  category={categoryById.get(place.categoryId)}
                  distanceKm={
                    origin ? distanceKm(origin, place.coordinates) : undefined
                  }
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

      {suggestions.length > 0 ? (
        <section aria-label="Suggestions" className="mt-6 px-fluid-md">
          <h2 className="mb-2 text-fluid-xl font-semibold">Idées pour vous</h2>
          <ul className="flex flex-col gap-2">
            {suggestions.map(s => (
              <li
                key={s.place.id}
                className="rounded-(--radius-card) bg-primary-soft p-fluid-sm text-fluid-sm"
              >
                <Link
                  to={`/lieux/${s.place.id}`}
                  className="font-semibold hover:underline"
                >
                  {s.place.name}
                </Link>{' '}
                — {s.reasons.join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
      />
    </div>
  );
}
