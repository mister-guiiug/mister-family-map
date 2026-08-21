import { describe, expect, it } from 'vitest';
import {
  ageRangeSchema,
  coordinatesSchema,
  placeDraftSchema,
  UNKNOWN_FEATURES,
} from './model';

describe('coordinatesSchema', () => {
  it('accepte des coordonnées valides', () => {
    expect(coordinatesSchema.safeParse({ lat: 45.76, lng: 4.83 }).success).toBe(
      true
    );
  });

  it('rejette latitude/longitude hors bornes', () => {
    expect(coordinatesSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(
      false
    );
    expect(coordinatesSchema.safeParse({ lat: 0, lng: -181 }).success).toBe(
      false
    );
  });
});

describe('ageRangeSchema', () => {
  it('refuse min > max', () => {
    expect(ageRangeSchema.safeParse({ min: 8, max: 3 }).success).toBe(false);
  });
});

describe('placeDraftSchema', () => {
  const validDraft = {
    name: 'Parc de la Tête d’Or',
    categoryId: 'cat-parc',
    shortDescription: 'Grand parc urbain avec lac et zoo gratuit.',
    description: '',
    coordinates: { lat: 45.7797, lng: 4.8527 },
    address: '',
    city: 'Lyon',
    ageRange: { min: 0, max: 18 },
    durationMinutes: 180,
    price: { kind: 'free' },
    openingHours: null,
    websiteUrl: null,
    phone: null,
    features: UNKNOWN_FEATURES,
    practicalTips: '',
  };

  it('accepte un brouillon complet', () => {
    expect(placeDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it('refuse un nom trop court', () => {
    expect(
      placeDraftSchema.safeParse({ ...validDraft, name: 'A' }).success
    ).toBe(false);
  });

  it('refuse une URL invalide', () => {
    expect(
      placeDraftSchema.safeParse({ ...validDraft, websiteUrl: 'javascript:x' })
        .success
    ).toBe(false);
  });
});
