import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_KEYS,
  SNAPSHOT_KEY,
  SNAPSHOT_VERSION,
  clearSnapshot,
  readSnapshot,
  snapshotStore,
  writeSnapshot,
} from './snapshot';
import { SEED_EVENTS, SEED_PLACES, SEED_REVIEWS } from './seed';
import { DEFAULT_CATEGORIES } from '../../constants/default-categories';

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * L'app écrit aujourd'hui NEUF clés indépendantes (`mfm_places`, `mfm_events`,
 * `mfm_reviews`, …), sans version ni migration. Le jour où le modèle bouge,
 * rien ne sait dire « cette donnée est d'avant » : au mieux l'app affiche du
 * vide, au pire une lecture partielle est réécrite par-dessus la bonne. C'est
 * une perte invisible tant que le modèle ne change pas — donc une perte qui
 * arrive une seule fois, chez tout le monde, sans que personne ne l'ait vue
 * venir.
 *
 * Le magasin versionné du socle apporte l'enveloppe `{ v, data }`, la chaîne
 * de migrations et la copie de côté AVANT toute perte possible. Reste ce que
 * lui seul ne peut pas savoir : où sont les données d'hier. C'est la migration
 * 0 → 1, et c'est exactement ce que ce fichier fige — une base de vrais
 * utilisateurs se relit en entier, ou le test est rouge.
 *
 * Écrits AVANT le magasin, et vus échouer : le module `./snapshot` n'existait
 * pas encore quand ces attentes ont été posées.
 */

/** Un lieu saisi par un utilisateur — la donnée qui n'est nulle part ailleurs. */
const USER_PLACE = {
  ...SEED_PLACES[0],
  id: 'user-kiosque',
  name: 'Kiosque à musique du parc',
  authorId: 'local-camille',
  status: 'pending' as const,
};

const USER_EVENT = {
  ...SEED_EVENTS[0],
  id: 'user-brocante',
  title: 'Brocante du quartier',
  authorId: 'local-camille',
};

const USER_REVIEW = {
  ...SEED_REVIEWS[0],
  id: 'user-avis',
  authorId: 'local-camille',
};

const USER_SESSION = {
  userId: 'local-camille',
  profile: {
    id: 'local-camille',
    displayName: 'camille',
    role: 'member' as const,
    createdAt: '2026-06-01T10:00:00+02:00',
  },
};

/** Exactement ce qu'une installation d'aujourd'hui contient. */
function seedYesterdaysKeys(): void {
  localStorage.setItem('mfm_places', JSON.stringify([USER_PLACE]));
  localStorage.setItem('mfm_events', JSON.stringify([USER_EVENT]));
  localStorage.setItem('mfm_reviews', JSON.stringify([USER_REVIEW]));
  localStorage.setItem('mfm_categories', JSON.stringify(DEFAULT_CATEGORIES));
  localStorage.setItem('mfm_favorites', JSON.stringify(['seed-tete-dor']));
  localStorage.setItem('mfm_session', JSON.stringify(USER_SESSION));
  localStorage.setItem(
    'mfm_reports',
    JSON.stringify([
      {
        id: 'rep-1',
        targetType: 'place',
        targetId: 'user-kiosque',
        reason: 'incorrect',
        details: '',
        reporterId: 'local-camille',
        status: 'open',
        createdAt: '2026-06-02T10:00:00+02:00',
      },
    ])
  );
  localStorage.setItem(
    'mfm_moderation_actions',
    JSON.stringify([
      {
        id: 'act-1',
        moderatorId: 'local-modo',
        targetType: 'place',
        targetId: 'user-kiosque',
        decision: 'approve',
        reason: '',
        relatedReportId: 'rep-1',
        createdAt: '2026-06-03T10:00:00+02:00',
      },
    ])
  );
  localStorage.setItem(
    'mfm_place_revisions',
    JSON.stringify([{ id: 'rev-1', placeId: 'seed-tete-dor' }])
  );
}

describe('la migration des clés d’hier vers l’instantané versionné', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retrouve TOUT ce qu’une installation d’aujourd’hui contient', () => {
    seedYesterdaysKeys();

    const snapshot = readSnapshot();

    expect(snapshot.places).toEqual([USER_PLACE]);
    expect(snapshot.events).toEqual([USER_EVENT]);
    expect(snapshot.reviews).toEqual([USER_REVIEW]);
    expect(snapshot.categories).toEqual(DEFAULT_CATEGORIES);
    expect(snapshot.favorites).toEqual(['seed-tete-dor']);
    expect(snapshot.session).toEqual(USER_SESSION);
    expect(snapshot.reports).toHaveLength(1);
    expect(snapshot.moderationActions).toHaveLength(1);
    expect(snapshot.revisions).toEqual([
      { id: 'rev-1', placeId: 'seed-tete-dor' },
    ]);
  });

  it('écrit l’instantané sous `mfm_data`, enveloppé de sa version', () => {
    seedYesterdaysKeys();

    readSnapshot();

    const raw = localStorage.getItem(`mfm_${SNAPSHOT_KEY}`);
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw as string) as { v: number; data: unknown };
    expect(envelope.v).toBe(SNAPSHOT_VERSION);
    expect((envelope.data as { places: unknown[] }).places).toEqual([
      USER_PLACE,
    ]);
  });

  it('met la donnée d’avant DE CÔTÉ avant de la migrer', () => {
    seedYesterdaysKeys();

    readSnapshot();

    // Le filet du socle : `{clé}.backup-v0`, déterministe donc borné.
    const backup = localStorage.getItem(`mfm_${SNAPSHOT_KEY}.backup-v0`);
    expect(backup).not.toBeNull();
    const before = JSON.parse(backup as string) as { places: unknown[] };
    expect(before.places).toEqual([USER_PLACE]);
  });

  it('laisse les clés d’hier INTACTES — un retour arrière du déploiement ne perd rien', () => {
    seedYesterdaysKeys();

    readSnapshot();

    expect(localStorage.getItem('mfm_places')).toBe(
      JSON.stringify([USER_PLACE])
    );
    expect(localStorage.getItem('mfm_favorites')).toBe('["seed-tete-dor"]');
    expect(localStorage.getItem('mfm_session')).toBe(
      JSON.stringify(USER_SESSION)
    );
  });

  it('complète par les données de démonstration les clés qui n’existaient pas', () => {
    // Un utilisateur qui n'a jamais rien signalé n'a pas de `mfm_reports`, et
    // celui qui n'a jamais ouvert l'agenda n'a pas de `mfm_events` : le
    // comportement d'avant (`loadSeeded`) doit être reproduit à l'identique.
    localStorage.setItem('mfm_favorites', JSON.stringify(['seed-tete-dor']));

    const snapshot = readSnapshot();

    expect(snapshot.favorites).toEqual(['seed-tete-dor']);
    expect(snapshot.places).toEqual([...SEED_PLACES]);
    expect(snapshot.events).toEqual([...SEED_EVENTS]);
    expect(snapshot.reviews).toEqual([...SEED_REVIEWS]);
    expect(snapshot.categories).toEqual([...DEFAULT_CATEGORIES]);
    expect(snapshot.reports).toEqual([]);
    expect(snapshot.session).toBeNull();
  });

  it('ne migre QU’UNE fois : les clés d’hier ne sont plus relues ensuite', () => {
    seedYesterdaysKeys();
    readSnapshot();

    // Un onglet resté sur l'ANCIENNE version écrit encore à l'ancienne place.
    // L'instantané existe : il fait foi, sans quoi la migration se rejouerait
    // et écraserait ce que l'utilisateur a fait depuis.
    localStorage.setItem('mfm_places', JSON.stringify([]));

    expect(readSnapshot().places).toEqual([USER_PLACE]);
  });

  it('sur une installation neuve, amorce sans rien écrire', () => {
    const snapshot = readSnapshot();

    expect(snapshot.places).toEqual([...SEED_PLACES]);
    expect(snapshot.session).toBeNull();
    // Lire n'écrit pas : la démo ne « colle » qu'à la première contribution.
    expect(localStorage.getItem(`mfm_${SNAPSHOT_KEY}`)).toBeNull();
  });

  it('met de côté un instantané VENU DU FUTUR au lieu de l’écraser', () => {
    // Un retour arrière de déploiement, ou un onglet resté ouvert sur la
    // version suivante : la donnée est incompréhensible, elle n'est pas
    // perdue pour autant.
    localStorage.setItem(
      `mfm_${SNAPSHOT_KEY}`,
      JSON.stringify({ v: SNAPSHOT_VERSION + 1, data: { places: ['?'] } })
    );

    const snapshot = readSnapshot();

    expect(snapshot.places).toEqual([...SEED_PLACES]);
    expect(
      localStorage.getItem(
        `mfm_${SNAPSHOT_KEY}.backup-v${SNAPSHOT_VERSION + 1}`
      )
    ).not.toBeNull();
  });

  it('écrit une collection sans toucher aux autres', () => {
    seedYesterdaysKeys();
    readSnapshot();

    writeSnapshot({ favorites: ['seed-tete-dor', 'user-kiosque'] });

    const snapshot = readSnapshot();
    expect(snapshot.favorites).toEqual(['seed-tete-dor', 'user-kiosque']);
    expect(snapshot.places).toEqual([USER_PLACE]);
    expect(snapshot.session).toEqual(USER_SESSION);
  });

  it('ne touche pas au brouillon de l’assistant, qui vit hors de l’instantané', () => {
    // `mfm_place_wizard_draft` est un état d'IHM en cours de saisie, pas une
    // donnée de l'app : il garde sa clé propre, et la migration l'ignore.
    seedYesterdaysKeys();
    localStorage.setItem('mfm_place_wizard_draft', '{"step":"position"}');

    readSnapshot();
    writeSnapshot({ favorites: [] });

    expect(localStorage.getItem('mfm_place_wizard_draft')).toBe(
      '{"step":"position"}'
    );
  });

  it('efface l’instantané ET ses copies de côté, sans emporter le reste', () => {
    seedYesterdaysKeys();
    readSnapshot();
    localStorage.setItem('mfm_place_wizard_draft', '{"step":"position"}');

    clearSnapshot();

    expect(localStorage.getItem(`mfm_${SNAPSHOT_KEY}`)).toBeNull();
    expect(localStorage.getItem(`mfm_${SNAPSHOT_KEY}.backup-v0`)).toBeNull();
    expect(localStorage.getItem('mfm_place_wizard_draft')).toBe(
      '{"step":"position"}'
    );
  });

  it('expose l’état courant en JSON — l’enveloppe comprise', () => {
    seedYesterdaysKeys();
    readSnapshot();

    const json = snapshotStore.export();

    expect(json).not.toBeNull();
    const parsed = JSON.parse(json as string) as { v: number };
    expect(parsed.v).toBe(SNAPSHOT_VERSION);
  });

  it('nomme les clés d’hier, une par collection', () => {
    // Le tableau des clés est la seule chose que la migration ne peut pas
    // déduire : le figer, c'est empêcher qu'un renommage silencieux fasse
    // disparaître une collection entière.
    expect(LEGACY_KEYS).toEqual({
      places: 'places',
      events: 'events',
      reviews: 'reviews',
      categories: 'categories',
      favorites: 'favorites',
      session: 'session',
      reports: 'reports',
      moderationActions: 'moderation_actions',
      revisions: 'place_revisions',
    });
  });
});
