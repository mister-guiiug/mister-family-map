/** Outils géographiques purs — aucune dépendance au fournisseur de carte. */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function isValidCoordinates(c: Coordinates): boolean {
  return isValidLatitude(c.lat) && isValidLongitude(c.lng);
}

const EARTH_RADIUS_KM = 6371;

/** Distance orthodromique (haversine), en kilomètres. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Un point est-il dans la zone visible ? (gère l'antiméridien) */
export function isInBoundingBox(c: Coordinates, box: BoundingBox): boolean {
  const inLat = c.lat >= box.south && c.lat <= box.north;
  const inLng =
    box.west <= box.east
      ? c.lng >= box.west && c.lng <= box.east
      : c.lng >= box.west || c.lng <= box.east;
  return inLat && inLng;
}

/** « 350 m » sous le kilomètre, « 2,4 km » au-dessus, « 12 km » au-delà de 10. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
