import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildContributionsExport,
  collectContributions,
  contributionsFilename,
} from './export';
import { createLocalBackend } from '../../shared/api/local/local-backend';
import { UNKNOWN_FEATURES, type PlaceDraft } from '../../entities/place/model';
import type { AuthSession } from '../../entities/user/model';
import type { Place } from '../../entities/place/model';

/**
 * CE QUE CE TEST TIENT. La page « Mentions » promet à l'utilisateur qu'il peut
 * « exporter ses contributions depuis le profil ». Ces tests éprouvent ce que
 * l'utilisateur reçoit vraiment quand il clique : SES lieux, SES événements,
 * SES retours, SES favoris — et rien de ceux des autres.
 *
 * Le parcours est joué à travers le VRAI backend local, pas un double : le
 * bogue qu'un double ne trouve jamais est le filtre par auteur oublié dans une
 * requête.
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

const session: AuthSession = {
  userId: 'local-camille',
  profile: {
    id: 'local-camille',
    displayName: 'camille',
    role: 'member',
    createdAt: '2026-06-01T10:00:00+02:00',
  },
};

describe('l’export des contributions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('emporte les lieux, retours et favoris de l’utilisateur', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('camille@exemple.fr');
    const place = await backend.places.create(draft);
    await backend.reviews.create({
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
    await backend.favorites.add('seed-tete-dor');

    const collected = await collectContributions(backend, session);
    const file = buildContributionsExport(collected);

    expect(file.app).toBe('mister-family-map');
    expect(file.account.displayName).toBe('camille');
    expect(file.places.map(p => p.id)).toEqual([place.id]);
    expect(file.reviews).toHaveLength(1);
    // Le favori porte le NOM du lieu, pas seulement son identifiant.
    expect(file.favorites).toEqual([
      { placeId: 'seed-tete-dor', name: expect.any(String) },
    ]);
    expect(file.favorites[0]?.name).not.toBe('');
  });

  it('n’emporte JAMAIS les contributions d’autrui', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('autre@exemple.fr');
    const leur = await backend.places.create(draft);
    await backend.auth.signInWithEmail('camille@exemple.fr');
    const mien = await backend.places.create({ ...draft, name: 'Mon square' });

    const file = buildContributionsExport(
      await collectContributions(backend, session)
    );

    expect(file.places.map(p => p.id)).toEqual([mien.id]);
    expect(file.places.some(p => p.id === leur.id)).toBe(false);
    // Les lieux du seed, publiés par « seed-author », ne sont pas les siens.
    expect(file.places.every(p => p.authorId === 'local-camille')).toBe(true);
  });

  it('filtre par auteur une SECONDE fois, après le dépôt', () => {
    // La garde qui compte : un adaptateur qui ignorerait `authorId` — requête
    // mal formée, politique RLS trop large — ferait autrement partir les
    // contributions d'autrui dans le fichier de l'utilisateur.
    const autrui = { id: 'x', authorId: 'quelqu-un-dautre' } as Place;
    const file = buildContributionsExport({
      session,
      places: [autrui],
      events: [],
      reviews: [],
      favorites: [],
    });

    expect(file.places).toEqual([]);
  });

  it('emporte aussi ce qui est supprimé — c’est encore stocké', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('camille@exemple.fr');
    const place = await backend.places.create(draft);
    await backend.places.deleteOwn(place.id);

    const file = buildContributionsExport(
      await collectContributions(backend, session)
    );

    const exported = file.places.find(p => p.id === place.id);
    expect(exported).toBeDefined();
    // Et il dit qu'elle l'est : un export de portabilité ne cache pas ce que
    // l'app conserve encore.
    expect(exported?.deletedAt).not.toBeNull();
  });

  it('rend un favori dont le lieu n’est plus lisible, sans le taire', async () => {
    const backend = createLocalBackend();
    await backend.auth.signInWithEmail('camille@exemple.fr');
    await backend.favorites.add('lieu-disparu');

    const file = buildContributionsExport(
      await collectContributions(backend, session)
    );

    expect(file.favorites).toEqual([{ placeId: 'lieu-disparu', name: null }]);
  });

  it('nomme le fichier par la date que l’utilisateur a sous les yeux', () => {
    // Construite par composantes LOCALES, donc indépendante du fuseau du
    // runner. À 23 h 30 le 6, `toISOString().slice(0, 10)` rendrait « 09-07 »
    // partout à l'est de Greenwich : le fichier porterait la date du
    // lendemain, et celui qui trie ses exports par date ne saurait plus lequel
    // est lequel.
    const tardLeSoir = new Date(2026, 8, 6, 23, 30);
    expect(contributionsFilename(tardLeSoir)).toBe(
      'mister-family-map-contributions-2026-09-06.json'
    );
  });

  it('se relit : ce qui sort est du JSON', () => {
    const file = buildContributionsExport({
      session,
      places: [],
      events: [],
      reviews: [],
      favorites: [],
      exportedAt: new Date('2026-09-06T12:00:00Z'),
    });

    const relu = JSON.parse(JSON.stringify(file)) as typeof file;
    expect(relu.exportedAt).toBe('2026-09-06T12:00:00.000Z');
    expect(relu.format).toBe(1);
  });
});
