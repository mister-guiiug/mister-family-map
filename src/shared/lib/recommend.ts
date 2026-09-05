/**
 * Suggestions « idées de sorties » par RÈGLES TRANSPARENTES — pas d'IA opaque
 * dans le MVP. Chaque suggestion est accompagnée des raisons lisibles qui ont
 * produit son score, affichées telles quelles à l'utilisateur.
 */
import type { Place } from '../../entities/place/model';
import {
  distanceKm,
  formatDistance,
  type Coordinates,
} from '@mister-guiiug/dev-pwa-config/geo';

export interface RecommendationCriteria {
  origin?: Coordinates;
  childAge?: number;
  /** Temps disponible en minutes. */
  availableMinutes?: number;
  /** Météo du moment : `true` = temps couvert/pluvieux. */
  badWeather?: boolean;
  freeOnly?: boolean;
  favoriteCategoryIds?: readonly string[];
}

export interface Recommendation {
  place: Place;
  score: number;
  /** Raisons lisibles, dans l'ordre d'importance. */
  reasons: string[];
}

export interface RecommendContext {
  ratings?: ReadonlyMap<string, number>;
}

export function recommendPlaces(
  places: readonly Place[],
  criteria: RecommendationCriteria,
  context: RecommendContext = {},
  limit = 5
): Recommendation[] {
  const results: Recommendation[] = [];

  for (const place of places) {
    if (place.status !== 'published' || place.deletedAt !== null) continue;

    let score = 0;
    const reasons: string[] = [];

    if (criteria.origin) {
      const d = distanceKm(criteria.origin, place.coordinates);
      if (d <= 5) {
        score += 3;
        reasons.push(`À ${formatDistance(d)} de vous`);
      } else if (d <= 20) {
        score += 2;
        reasons.push(`À ${formatDistance(d)}`);
      } else if (d <= 50) {
        score += 1;
      } else {
        score -= 2;
      }
    }

    if (criteria.childAge !== undefined && place.ageRange) {
      if (
        criteria.childAge >= place.ageRange.min &&
        criteria.childAge <= place.ageRange.max
      ) {
        score += 2;
        reasons.push(`Adapté à ${criteria.childAge} ans`);
      } else {
        score -= 3;
      }
    }

    if (
      criteria.availableMinutes !== undefined &&
      place.durationMinutes !== null
    ) {
      if (place.durationMinutes <= criteria.availableMinutes) {
        score += 1;
        reasons.push('Tient dans votre créneau');
      } else {
        score -= 2;
      }
    }

    if (criteria.badWeather) {
      if (
        place.features.weatherProof === 'yes' ||
        place.features.setting === 'indoor'
      ) {
        score += 2;
        reasons.push('Compatible mauvais temps');
      } else if (place.features.setting === 'outdoor') {
        score -= 2;
      }
    }

    if (criteria.freeOnly) {
      if (place.price.kind === 'free') {
        score += 1;
        reasons.push('Gratuit');
      } else if (place.price.kind === 'paid') {
        score -= 3;
      }
    }

    if (criteria.favoriteCategoryIds?.includes(place.categoryId)) {
      score += 1;
      reasons.push('Catégorie que vous aimez');
    }

    const rating = context.ratings?.get(place.id);
    if (rating !== undefined && rating >= 4) {
      score += 1;
      reasons.push(`Bien noté par les familles (${rating.toFixed(1)}/5)`);
    }

    if (score > 0) results.push({ place, score, reasons });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
