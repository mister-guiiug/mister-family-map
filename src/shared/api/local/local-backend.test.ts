import { beforeEach, describe, expect, it } from 'vitest';
import {
  UNKNOWN_FEATURES,
  type PlaceDraft,
} from '../../../entities/place/model';
import { createLocalBackend } from './local-backend';

/**
 * Tests d'intégration du backend local-first : les mêmes parcours que l'UI
 * (création, favoris, signalement, modération), à travers les ports.
 */

const draft: PlaceDraft = {
  name: 'Square des Lilas',
  categoryId: 'cat-aire-de-jeux',
  shortDescription: 'Petite aire de jeux ombragée.',
  description: '',
  coordinates: { lat: 45.75, lng: 4.85 },
  address: '',
  city: 'Villeurbanne',
  ageRange: { min: 1, max: 8 },
  durationMinutes: 45,
  price: { kind: 'free' },
  openingHours: null,
  websiteUrl: null,
  phone: null,
  features: { ...UNKNOWN_FEATURES },
  practicalTips: '',
};

describe('backend local-first', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sert les lieux publiés du seed, jamais les lieux en attente', async () => {
    const backend = createLocalBackend();
    const places = await backend.places.list();
    expect(places.length).toBeGreaterThan(0);
    expect(places.every(p => p.status === 'published')).toBe(true);
  });

  it('refuse la création sans session', async () => {
    const backend = createLocalBackend();
    await expect(backend.places.create(draft)).rejects.toThrow(/Connexion/);
  });

  it('création d’un lieu par un membre → statut pending, auteur imposé', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('famille@exemple.fr');
    const place = await backend.places.create(draft);
    expect(place.status).toBe('pending');
    expect(place.authorId).toBe('local-famille');
    // Invisible du public tant que non validé.
    const publicPlaces = await backend.places.list();
    expect(publicPlaces.some(p => p.id === place.id)).toBe(false);
  });

  it('un membre ne modifie pas la contribution d’autrui', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('famille@exemple.fr');
    const place = await backend.places.create(draft);
    await backend.auth.signInWithEmail('autre@exemple.fr');
    await expect(backend.places.updateOwn(place.id, draft)).rejects.toThrow(
      /auteur/
    );
  });

  it('ajout et retrait d’un favori', async () => {
    const backend = createLocalBackend();
    await backend.favorites.add('seed-tete-dor');
    expect(await backend.favorites.listIds()).toContain('seed-tete-dor');
    await backend.favorites.remove('seed-tete-dor');
    expect(await backend.favorites.listIds()).toHaveLength(0);
  });

  it('signalement puis traitement par un modérateur (journalisé)', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('famille@exemple.fr');
    await backend.moderation.report(
      'place',
      'seed-tete-dor',
      'incorrect',
      'Les horaires ont changé.'
    );
    const open = await backend.moderation.listOpenReports();
    expect(open).toHaveLength(1);

    // Un membre ne peut pas décider.
    const reportId = open[0]?.id ?? '';
    await expect(
      backend.moderation.decide(reportId, 'place', 'seed-tete-dor', 'hide', 'x')
    ).rejects.toThrow(/modération/);

    // Un modérateur, oui — et l'action est historisée.
    await backend.auth.signInWithEmail('modo@demo.famille');
    await backend.moderation.decide(
      reportId,
      'place',
      'seed-tete-dor',
      'hide',
      'Fermé pour travaux.'
    );
    expect(await backend.moderation.listOpenReports()).toHaveLength(0);
    const history = await backend.moderation.history();
    expect(history).toHaveLength(1);
    expect(history[0]?.decision).toBe('hide');

    // La décision est appliquée : le lieu masqué disparaît du public.
    const publicPlaces = await backend.places.list();
    expect(publicPlaces.some(p => p.id === 'seed-tete-dor')).toBe(false);
  });

  it('publication d’un retour d’expérience lié à une visite', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('famille@exemple.fr');
    const review = await backend.reviews.create({
      placeId: 'seed-tete-dor',
      visitedOn: '2026-08-10',
      ageBrackets: ['3-5'],
      rating: 5,
      positives: 'Super pataugeoire.',
      watchouts: '',
      accessibilityNotes: '',
      crowdLevel: 'moderate',
      valueForMoney: 'good',
      practicalTips: '',
      photoIds: [],
    });
    expect(review.status).toBe('published');
    const forPlace = await backend.reviews.listForPlace('seed-tete-dor');
    expect(forPlace.some(r => r.id === review.id)).toBe(true);
  });
});
