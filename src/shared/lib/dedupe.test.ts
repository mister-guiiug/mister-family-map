import { describe, expect, it } from 'vitest';
import {
  findPotentialDuplicates,
  nameSimilarity,
  normalizeName,
} from './dedupe';

describe('normalizeName', () => {
  it('minuscule, sans accents ni ponctuation', () => {
    expect(normalizeName("Parc de la Tête d'Or !")).toBe(
      'parc de la tete d or'
    );
  });
});

describe('nameSimilarity', () => {
  it('identiques après normalisation → 1', () => {
    expect(nameSimilarity('Tête d’Or', 'tete d or')).toBe(1);
  });

  it('noms proches → score élevé', () => {
    expect(
      nameSimilarity('Parc de la Tête d’Or', 'Parc Tête d’Or Lyon')
    ).toBeGreaterThan(0.6);
  });

  it('noms sans rapport → score faible', () => {
    expect(
      nameSimilarity('Piscine municipale', 'Musée gallo-romain')
    ).toBeLessThan(0.3);
  });
});

describe('findPotentialDuplicates', () => {
  const parc = {
    id: 'p1',
    name: 'Parc de la Tête d’Or',
    coordinates: { lat: 45.7797, lng: 4.8527 },
  };
  const museeLoin = {
    id: 'p2',
    name: 'Musée des Confluences',
    coordinates: { lat: 45.7326, lng: 4.8184 },
  };

  it('détecte un nom proche dans le rayon', () => {
    const matches = findPotentialDuplicates(
      {
        name: 'Parc Tête d’Or',
        coordinates: { lat: 45.7799, lng: 4.853 },
      },
      [parc, museeLoin]
    );
    expect(matches.map(m => m.place.id)).toEqual(['p1']);
  });

  it('signale un lieu à moins de 100 m même avec un nom différent', () => {
    const matches = findPotentialDuplicates(
      {
        name: 'Square des enfants',
        coordinates: { lat: 45.7797, lng: 4.8528 },
      },
      [parc]
    );
    expect(matches).toHaveLength(1);
  });

  it('ignore les lieux hors rayon', () => {
    const matches = findPotentialDuplicates(
      {
        name: 'Musée des Confluences',
        coordinates: { lat: 45.7797, lng: 4.8527 },
      },
      [museeLoin]
    );
    expect(matches).toHaveLength(0);
  });
});
