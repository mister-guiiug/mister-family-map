/**
 * Détection initiale de doublons lors d'une contribution : proximité
 * géographique + similarité du nom (coefficient de Sørensen–Dice sur bigrammes,
 * robuste aux inversions de mots et aux petites fautes).
 */
import { distanceKm, type Coordinates } from './geo';

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const grams = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

/** Similarité entre 0 (rien de commun) et 1 (identiques après normalisation). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length < 2 || nb.length < 2) return na === nb && na.length > 0 ? 1 : 0;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let intersection = 0;
  for (const [gram, count] of ga) {
    intersection += Math.min(count, gb.get(gram) ?? 0);
  }
  return (2 * intersection) / (na.length - 1 + (nb.length - 1));
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface DuplicateMatch<T extends DuplicateCandidate> {
  place: T;
  distanceKm: number;
  similarity: number;
}

export interface DuplicateOptions {
  /** Rayon de recherche (défaut : 500 m). */
  maxDistanceKm?: number;
  /** Similarité de nom minimale pour matcher au-delà de ~100 m (défaut 0.55). */
  minSimilarity?: number;
}

/**
 * Doublons potentiels, du plus probable au moins probable. Un lieu à moins de
 * 100 m est signalé même si le nom diffère (le même toboggan est souvent
 * saisi « Aire de jeux » puis « Square des enfants »).
 */
export function findPotentialDuplicates<T extends DuplicateCandidate>(
  candidate: { name: string; coordinates: Coordinates },
  existing: readonly T[],
  options: DuplicateOptions = {}
): Array<DuplicateMatch<T>> {
  const { maxDistanceKm = 0.5, minSimilarity = 0.55 } = options;
  const matches: Array<DuplicateMatch<T>> = [];
  for (const place of existing) {
    const d = distanceKm(candidate.coordinates, place.coordinates);
    if (d > maxDistanceKm) continue;
    const similarity = nameSimilarity(candidate.name, place.name);
    if (d <= 0.1 || similarity >= minSimilarity) {
      matches.push({ place, distanceKm: d, similarity });
    }
  }
  return matches.sort(
    (a, b) => b.similarity - a.similarity || a.distanceKm - b.distanceKm
  );
}
