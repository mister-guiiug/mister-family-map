import { z } from 'zod';
import { matchesTriStateFilter } from '../types/tri-state';
import { distanceKm, type Coordinates } from '../lib/geo';
import type { Place } from '../../entities/place/model';

/**
 * Filtres de recherche. Tous FACULTATIFS : un filtre absent ne restreint rien,
 * et un attribut `unknown` n'est jamais traité comme négatif
 * (cf. matchesTriStateFilter).
 */
export const searchFiltersSchema = z.object({
  categoryIds: z.array(z.string()).default([]),
  /** Distance max en km — nécessite une position de référence. */
  maxDistanceKm: z.number().min(0.5).max(200).optional(),
  free: z.boolean().optional(),
  /** Âge d'un enfant à couvrir (années). */
  childAge: z.number().int().min(0).max(18).optional(),
  /** Durée disponible en minutes. */
  maxDurationMinutes: z.number().int().min(10).optional(),
  accessibility: z.enum(['yes', 'no', 'unknown']).optional(),
  stroller: z.enum(['yes', 'no', 'unknown']).optional(),
  petsAllowed: z.enum(['yes', 'no', 'unknown']).optional(),
  waterPoint: z.enum(['yes', 'no', 'unknown']).optional(),
  toilets: z.enum(['yes', 'no', 'unknown']).optional(),
  picnicArea: z.enum(['yes', 'no', 'unknown']).optional(),
  foodNearby: z.enum(['yes', 'no', 'unknown']).optional(),
  /** « Compatible mauvais temps » (intérieur ou abrité). */
  weatherProof: z.enum(['yes', 'no', 'unknown']).optional(),
  setting: z.enum(['indoor', 'outdoor', 'mixed']).optional(),
  difficulty: z.enum(['easy', 'moderate', 'hard']).optional(),
  /** Note moyenne minimale issue des retours d'expérience. */
  minRating: z.number().min(1).max(5).optional(),
  /** Recherche texte (nom, commune). */
  query: z.string().max(100).optional(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const EMPTY_FILTERS: SearchFilters = searchFiltersSchema.parse({});

export function countActiveFilters(f: SearchFilters): number {
  let count = f.categoryIds.length > 0 ? 1 : 0;
  const optionals: Array<unknown> = [
    f.maxDistanceKm,
    f.free,
    f.childAge,
    f.maxDurationMinutes,
    f.accessibility,
    f.stroller,
    f.petsAllowed,
    f.waterPoint,
    f.toilets,
    f.picnicArea,
    f.foodNearby,
    f.weatherProof,
    f.setting,
    f.difficulty,
    f.minRating,
  ];
  count += optionals.filter(v => v !== undefined).length;
  return count;
}

export interface FilterContext {
  /** Position de référence pour le filtre distance (consentement obtenu). */
  origin?: Coordinates;
  /** Note moyenne publiée par lieu (id → note). */
  ratings?: ReadonlyMap<string, number>;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Application pure des filtres — utilisée par la liste, la carte et les tests. */
export function applyFilters(
  places: readonly Place[],
  filters: SearchFilters,
  context: FilterContext = {}
): Place[] {
  return places.filter(place => {
    if (
      filters.categoryIds.length > 0 &&
      !filters.categoryIds.includes(place.categoryId)
    ) {
      return false;
    }

    if (filters.query) {
      const q = normalize(filters.query);
      const haystack = normalize(`${place.name} ${place.city}`);
      if (!haystack.includes(q)) return false;
    }

    if (filters.maxDistanceKm !== undefined && context.origin) {
      if (distanceKm(context.origin, place.coordinates) > filters.maxDistanceKm)
        return false;
    }

    // Gratuit/payant : un prix inconnu n'est pas exclu (donnée absente ≠ payant).
    if (filters.free === true && place.price.kind === 'paid') return false;
    if (filters.free === false && place.price.kind === 'free') return false;

    // Tranche d'âge : inconnue → non éliminatoire.
    if (filters.childAge !== undefined && place.ageRange) {
      if (
        filters.childAge < place.ageRange.min ||
        filters.childAge > place.ageRange.max
      )
        return false;
    }

    // Durée : inconnue → non éliminatoire.
    if (
      filters.maxDurationMinutes !== undefined &&
      place.durationMinutes !== null &&
      place.durationMinutes > filters.maxDurationMinutes
    ) {
      return false;
    }

    const f = place.features;
    if (!matchesTriStateFilter(f.accessibility, filters.accessibility))
      return false;
    if (!matchesTriStateFilter(f.stroller, filters.stroller)) return false;
    if (!matchesTriStateFilter(f.petsAllowed, filters.petsAllowed))
      return false;
    if (!matchesTriStateFilter(f.waterPoint, filters.waterPoint)) return false;
    if (!matchesTriStateFilter(f.toilets, filters.toilets)) return false;
    if (!matchesTriStateFilter(f.picnicArea, filters.picnicArea)) return false;
    if (!matchesTriStateFilter(f.foodNearby, filters.foodNearby)) return false;
    if (!matchesTriStateFilter(f.weatherProof, filters.weatherProof))
      return false;

    if (
      filters.setting &&
      f.setting !== 'unknown' &&
      f.setting !== filters.setting
    )
      return false;
    if (
      filters.difficulty &&
      f.difficulty !== 'unknown' &&
      f.difficulty !== filters.difficulty
    )
      return false;

    if (filters.minRating !== undefined) {
      const rating = context.ratings?.get(place.id);
      // Pas encore de retours → non éliminatoire (donnée inconnue).
      if (rating !== undefined && rating < filters.minRating) return false;
    }

    return true;
  });
}
