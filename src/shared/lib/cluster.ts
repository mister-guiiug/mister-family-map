/**
 * Regroupement de marqueurs par grille, indépendant du fournisseur de carte.
 * Suffisant pour le MVP (quelques milliers de points) ; remplaçable par une
 * lib dédiée derrière la même signature si la volumétrie l'exige.
 */
import type { Coordinates } from './geo';

export interface ClusterInput<T> {
  id: string;
  coordinates: Coordinates;
  item: T;
}

export interface Cluster<T> {
  /** Centre (moyenne des points du groupe). */
  coordinates: Coordinates;
  items: Array<ClusterInput<T>>;
}

/**
 * Taille de cellule (en degrés) selon le zoom « web mercator » usuel :
 * plus on zoome, plus la grille est fine, jusqu'à désactiver le regroupement.
 */
export function cellSizeForZoom(zoom: number): number {
  if (zoom >= 15) return 0;
  return 360 / 2 ** zoom / 4;
}

export function clusterByGrid<T>(
  points: Array<ClusterInput<T>>,
  zoom: number
): Array<Cluster<T>> {
  const cell = cellSizeForZoom(zoom);
  if (cell === 0) {
    return points.map(p => ({ coordinates: p.coordinates, items: [p] }));
  }

  const buckets = new Map<string, Array<ClusterInput<T>>>();
  for (const p of points) {
    const key = `${Math.floor(p.coordinates.lat / cell)}:${Math.floor(p.coordinates.lng / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(p);
    else buckets.set(key, [p]);
  }

  return [...buckets.values()].map(items => {
    const lat = items.reduce((s, p) => s + p.coordinates.lat, 0) / items.length;
    const lng = items.reduce((s, p) => s + p.coordinates.lng, 0) / items.length;
    return { coordinates: { lat, lng }, items };
  });
}
