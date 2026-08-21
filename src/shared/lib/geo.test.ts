import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  formatDistance,
  isInBoundingBox,
  isValidCoordinates,
  isValidLatitude,
  isValidLongitude,
} from './geo';

describe('validation des coordonnées', () => {
  it('accepte les bornes exactes', () => {
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
  });

  it('rejette hors bornes, NaN et Infinity', () => {
    expect(isValidLatitude(90.0001)).toBe(false);
    expect(isValidLongitude(-180.5)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('valide un couple complet', () => {
    expect(isValidCoordinates({ lat: 45.76, lng: 4.83 })).toBe(true);
    expect(isValidCoordinates({ lat: 95, lng: 4.83 })).toBe(false);
  });
});

describe('distanceKm (haversine)', () => {
  it('distance nulle pour le même point', () => {
    const p = { lat: 45.76, lng: 4.83 };
    expect(distanceKm(p, p)).toBe(0);
  });

  it('Lyon → Paris ≈ 392 km', () => {
    const lyon = { lat: 45.764, lng: 4.8357 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const d = distanceKm(lyon, paris);
    expect(d).toBeGreaterThan(380);
    expect(d).toBeLessThan(405);
  });

  it('est symétrique', () => {
    const a = { lat: 45.76, lng: 4.83 };
    const b = { lat: 45.9, lng: 5.1 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });
});

describe('isInBoundingBox', () => {
  const box = { north: 46, south: 45, east: 5, west: 4 };

  it('inclut un point intérieur et les bords', () => {
    expect(isInBoundingBox({ lat: 45.5, lng: 4.5 }, box)).toBe(true);
    expect(isInBoundingBox({ lat: 46, lng: 5 }, box)).toBe(true);
  });

  it('exclut un point extérieur', () => {
    expect(isInBoundingBox({ lat: 46.1, lng: 4.5 }, box)).toBe(false);
  });

  it("gère l'antiméridien (ouest > est)", () => {
    const fiji = { north: -15, south: -20, east: -178, west: 177 };
    expect(isInBoundingBox({ lat: -17, lng: 179 }, fiji)).toBe(true);
    expect(isInBoundingBox({ lat: -17, lng: -179 }, fiji)).toBe(true);
    expect(isInBoundingBox({ lat: -17, lng: 0 }, fiji)).toBe(false);
  });
});

describe('formatDistance', () => {
  it('mètres sous 1 km, décimale française entre 1 et 10, entier au-delà', () => {
    expect(formatDistance(0.35)).toBe('350 m');
    expect(formatDistance(2.44)).toBe('2,4 km');
    expect(formatDistance(12.3)).toBe('12 km');
  });
});
