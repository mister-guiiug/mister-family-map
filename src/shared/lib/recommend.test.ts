import { describe, expect, it } from 'vitest';
import type { Place } from '../../entities/place/model';
import { UNKNOWN_FEATURES } from '../../entities/place/model';
import { recommendPlaces } from './recommend';

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    name: 'Lieu test',
    categoryId: 'cat-parc',
    shortDescription: '',
    description: '',
    coordinates: { lat: 45.76, lng: 4.83 },
    address: '',
    city: 'Lyon',
    ageRange: null,
    durationMinutes: null,
    price: { kind: 'unknown' },
    openingHours: null,
    websiteUrl: null,
    phone: null,
    features: { ...UNKNOWN_FEATURES },
    practicalTips: '',
    status: 'published',
    authorId: 'u1',
    lastVerifiedAt: null,
    photos: [],
    createdAt: '2026-08-01T10:00:00+02:00',
    updatedAt: '2026-08-01T10:00:00+02:00',
    deletedAt: null,
    ...overrides,
  };
}

describe('recommendPlaces (règles transparentes)', () => {
  it('privilégie la proximité et explique pourquoi', () => {
    const near = makePlace({ id: 'near' });
    const far = makePlace({
      id: 'far',
      coordinates: { lat: 48.85, lng: 2.35 },
    });
    const recos = recommendPlaces([near, far], {
      origin: { lat: 45.76, lng: 4.84 },
    });
    expect(recos[0]?.place.id).toBe('near');
    expect(recos[0]?.reasons.some(r => r.includes('de vous'))).toBe(true);
  });

  it('par mauvais temps, préfère l’intérieur et pénalise le plein air', () => {
    const musee = makePlace({
      id: 'musee',
      features: { ...UNKNOWN_FEATURES, setting: 'indoor' },
    });
    const plaine = makePlace({
      id: 'plaine',
      features: { ...UNKNOWN_FEATURES, setting: 'outdoor' },
    });
    const recos = recommendPlaces([musee, plaine], { badWeather: true });
    expect(recos.map(r => r.place.id)).toEqual(['musee']);
  });

  it('écarte les tranches d’âge incompatibles', () => {
    const ados = makePlace({ id: 'ados', ageRange: { min: 12, max: 18 } });
    const recos = recommendPlaces([ados], {
      childAge: 3,
      origin: { lat: 45.76, lng: 4.83 },
    });
    expect(recos).toHaveLength(0);
  });

  it('n’inclut jamais les lieux non publiés', () => {
    const pending = makePlace({ id: 'pending', status: 'pending' });
    expect(recommendPlaces([pending], { freeOnly: true })).toHaveLength(0);
  });

  it('valorise les lieux bien notés avec la note en raison', () => {
    const rated = makePlace({ id: 'rated', price: { kind: 'free' } });
    const recos = recommendPlaces(
      [rated],
      { freeOnly: true },
      { ratings: new Map([['rated', 4.5]]) }
    );
    expect(recos[0]?.reasons).toContain('Bien noté par les familles (4.5/5)');
  });
});
