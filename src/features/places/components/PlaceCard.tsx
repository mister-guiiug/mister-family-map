import { Link } from 'react-router';
import { Heart, MapPin } from 'lucide-react';
import { Badge, Button } from '@mister-guiiug/dev-pwa-config/react';
import type { Place } from '../../../entities/place/model';
import type { Category } from '../../../entities/category/model';
import { formatDistance } from '@mister-guiiug/dev-pwa-config/geo';

export interface PlaceCardProps {
  place: Place;
  category?: Category | undefined;
  /** Distance depuis la position consentie, en km. */
  distanceKm?: number | undefined;
  isFavorite: boolean;
  onToggleFavorite: (placeId: string) => void;
}

/** Carte lieu (liste et fiche synthétique carte). Présentation pure. */
export function PlaceCard({
  place,
  category,
  distanceKm,
  isFavorite,
  onToggleFavorite,
}: PlaceCardProps) {
  return (
    <article className="rounded-(--radius-card) border border-line bg-surface-2 p-fluid-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-fluid-lg font-semibold">
          <Link
            to={`/lieux/${place.id}`}
            className="hover:underline focus-visible:underline"
          >
            {place.name}
          </Link>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={
            isFavorite
              ? `Retirer ${place.name} des favoris`
              : `Ajouter ${place.name} aux favoris`
          }
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(place.id)}
        >
          <Heart
            size={18}
            aria-hidden="true"
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </Button>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-2 text-fluid-sm text-ink-soft">
        {category ? <Badge tone="brand">{category.label}</Badge> : null}
        {place.city ? (
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} aria-hidden="true" />
            {place.city}
          </span>
        ) : null}
        {distanceKm !== undefined ? (
          <span>{formatDistance(distanceKm)}</span>
        ) : null}
        {place.price.kind === 'free' ? (
          <Badge tone="success" variant="outline">
            Gratuit
          </Badge>
        ) : null}
        {place.lastVerifiedAt === null ? (
          <Badge tone="warning" variant="outline">
            Non vérifié
          </Badge>
        ) : null}
      </p>

      {place.shortDescription ? (
        <p className="mt-2 text-fluid-sm">{place.shortDescription}</p>
      ) : null}
    </article>
  );
}
