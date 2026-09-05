/**
 * Détection initiale de doublons lors d'une contribution : proximité
 * géographique + similarité du nom (coefficient de Sørensen–Dice sur bigrammes,
 * robuste aux inversions de mots et aux petites fautes).
 *
 * CE FICHIER EST LA SOURCE DE `@mister-guiiug/dev-pwa-config/similarity`, dont
 * l'en-tête le nomme : « PROMU, PAS INVENTÉ. Deux apps, deux domaines sans
 * rapport, le même problème. mister-family-map/src/shared/lib/dedupe.ts compare
 * des lieux […] ; miss-lookhouse fait de l'anti-doublons sur des annonces
 * immobilières. » L'algorithme est parti ; sa copie était restée.
 *
 * `normalizeName` et `nameSimilarity` étaient identiques au caractère près —
 * ils sont désormais réexportés. `findSimilar` généralise
 * `findPotentialDuplicates` : la distance devient injectable, et le rayon
 * « très proche » un réglage plutôt qu'un `0.1` en dur.
 *
 * CE QUI RESTE ICI EST LA FORME, PAS L'ALGORITHME. `findPotentialDuplicates`
 * garde son contrat — `{ place, distanceKm, similarity }` — pour que la page
 * de création et ses tests ne bougent pas. La version publiée rend en plus un
 * `reason` (`same-name`, `very-close`, `similar-name-nearby`) ; l'exposer à
 * l'écran est une décision de produit, à prendre à part.
 *
 * L'ENSEMBLE APPARIÉ EST LE MÊME, vérifié branche par branche : le `reason`
 * du socle vaut `gap <= closeEnough || similarity >= minSimilarity`, et sa
 * branche `same-name` est absorbée par la troisième puisque `1 >= 0.55`. Le
 * tri est identique — similarité décroissante, puis distance croissante.
 *
 * UNE SEULE DIVERGENCE, sur un cas limite : une distance NON FINIE. La copie
 * locale la laissait passer (`NaN > maxDistance` est faux) et pouvait alors
 * apparier sur le seul nom ; le socle écarte l'élément. `distanceKm` ne rend
 * jamais `NaN` sur des coordonnées valides, et le comportement du socle est
 * le plus prudent des deux.
 */
import {
  distanceKm,
  type Coordinates,
} from '@mister-guiiug/dev-pwa-config/geo';
import { findSimilar } from '@mister-guiiug/dev-pwa-config/similarity';

export {
  nameSimilarity,
  normalizeName,
} from '@mister-guiiug/dev-pwa-config/similarity';

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

  return findSimilar<T, Coordinates>(
    { name: candidate.name, at: candidate.coordinates },
    existing,
    {
      distance: distanceKm,
      maxDistance: maxDistanceKm,
      closeEnough: 0.1,
      minSimilarity,
      atOf: place => place.coordinates,
    }
  ).map(match => ({
    place: match.item,
    // `distance` n'est `null` que sans fonction de distance ; il y en a une.
    distanceKm: match.distance ?? 0,
    similarity: match.similarity,
  }));
}
