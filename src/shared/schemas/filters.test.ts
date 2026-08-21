import { describe, expect, it } from 'vitest';
import type { Place } from '../../entities/place/model';
import { UNKNOWN_FEATURES } from '../../entities/place/model';
import { applyFilters, countActiveFilters, EMPTY_FILTERS } from './filters';

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    name: 'Aire de jeux des Canuts',
    categoryId: 'cat-aire-de-jeux',
    shortDescription: '',
    description: '',
    coordinates: { lat: 45.77, lng: 4.83 },
    address: '',
    city: 'Lyon',
    ageRange: { min: 2, max: 10 },
    durationMinutes: 60,
    price: { kind: 'free' },
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

describe('applyFilters', () => {
  it('sans filtre, tout passe', () => {
    expect(applyFilters([makePlace({})], EMPTY_FILTERS)).toHaveLength(1);
  });

  it('filtre par catégorie', () => {
    const places = [
      makePlace({}),
      makePlace({ id: 'p2', categoryId: 'cat-musee' }),
    ];
    const out = applyFilters(places, {
      ...EMPTY_FILTERS,
      categoryIds: ['cat-musee'],
    });
    expect(out.map(p => p.id)).toEqual(['p2']);
  });

  it('un attribut « unknown » n’est PAS éliminé par un filtre « oui »', () => {
    const unknownToilets = makePlace({});
    const noToilets = makePlace({
      id: 'p2',
      features: { ...UNKNOWN_FEATURES, toilets: 'no' },
    });
    const out = applyFilters([unknownToilets, noToilets], {
      ...EMPTY_FILTERS,
      toilets: 'yes',
    });
    expect(out.map(p => p.id)).toEqual(['p1']);
  });

  it('gratuit : le prix inconnu n’est pas exclu', () => {
    const paid = makePlace({
      id: 'paid',
      price: { kind: 'paid', minEuros: 5 },
    });
    const unknown = makePlace({ id: 'unknown', price: { kind: 'unknown' } });
    const out = applyFilters([paid, unknown], { ...EMPTY_FILTERS, free: true });
    expect(out.map(p => p.id)).toEqual(['unknown']);
  });

  it('distance : nécessite une origine, sinon ignoré', () => {
    const far = makePlace({
      id: 'far',
      coordinates: { lat: 48.85, lng: 2.35 },
    });
    const near = makePlace({ id: 'near' });
    const filters = { ...EMPTY_FILTERS, maxDistanceKm: 10 };
    expect(applyFilters([far, near], filters)).toHaveLength(2);
    const out = applyFilters([far, near], filters, {
      origin: { lat: 45.76, lng: 4.84 },
    });
    expect(out.map(p => p.id)).toEqual(['near']);
  });

  it('âge de l’enfant dans la tranche du lieu', () => {
    const out = applyFilters([makePlace({})], {
      ...EMPTY_FILTERS,
      childAge: 12,
    });
    expect(out).toHaveLength(0);
  });

  it('note minimale : lieu sans retour non exclu, lieu mal noté exclu', () => {
    const rated = makePlace({ id: 'rated' });
    const unrated = makePlace({ id: 'unrated' });
    const out = applyFilters(
      [rated, unrated],
      { ...EMPTY_FILTERS, minRating: 4 },
      {
        ratings: new Map([['rated', 2.5]]),
      }
    );
    expect(out.map(p => p.id)).toEqual(['unrated']);
  });

  it('recherche texte insensible aux accents', () => {
    const out = applyFilters([makePlace({ name: 'Parc de la Tête d’Or' })], {
      ...EMPTY_FILTERS,
      query: 'tete',
    });
    expect(out).toHaveLength(1);
  });
});

describe('countActiveFilters', () => {
  it('compte les filtres réellement actifs', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        categoryIds: ['a'],
        free: true,
        toilets: 'yes',
      })
    ).toBe(3);
  });
});
