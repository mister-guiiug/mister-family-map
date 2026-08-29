/**
 * Backend LOCAL-FIRST : première implémentation fonctionnelle des ports,
 * persistée en localStorage et amorcée par les données de démonstration.
 *
 * Rôle : rendre l'app utilisable immédiatement (démo, tests, hors ligne) et
 * matérialiser les contrats. La sécurité réelle (RLS, fonctions serveur)
 * appartient au backend Supabase — cf. docs/adr/0002-backend.md.
 */
import type { Category } from '../../../entities/category/model';
import type { Place, PlaceDraft } from '../../../entities/place/model';
import type { EventDraft, FamilyEvent } from '../../../entities/event/model';
import type { Review, ReviewDraft } from '../../../entities/review/model';
import type {
  ModerationAction,
  ModerationDecision,
  Report,
  ReportReason,
  ReportTarget,
} from '../../../entities/moderation/model';
import type { AuthSession, Role } from '../../../entities/user/model';
import { DEFAULT_CATEGORIES } from '../../constants/default-categories';
import { newId } from '../../lib/id';
import { isInBoundingBox } from '@mister-guiiug/dev-wpa-config/geo';
import { store } from '../storage';
import { announceTabChange } from '../tab-sync';
import type {
  AnalyticsService,
  AuthService,
  Backend,
  CategoryRepository,
  EventQuery,
  EventRepository,
  FavoriteRepository,
  FileStorageService,
  GeocodingService,
  ModerationService,
  PlaceQuery,
  PlaceRepository,
  ReviewRepository,
} from '../ports';
import { SEED_EVENTS, SEED_PLACES, SEED_REVIEWS } from './seed';

/**
 * Les clés, SANS leur préfixe : `store` porte `mfm_`, si bien que
 * `store.get('places')` lit toujours `mfm_places`. Les données déjà écrites
 * chez les utilisateurs restent lisibles — c'était la condition de la
 * bascule vers le stockage du socle.
 */
const KEYS = {
  places: 'places',
  events: 'events',
  reviews: 'reviews',
  categories: 'categories',
  favorites: 'favorites',
  session: 'session',
  reports: 'reports',
  moderationActions: 'moderation_actions',
  revisions: 'place_revisions',
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

function loadSeeded<T>(key: string, seed: readonly T[]): T[] {
  const stored = store.get<T[] | null>(key, null);
  if (stored !== null) return stored;
  const copy = [...seed];
  store.set(key, copy);
  return copy;
}

class NotAuthenticatedError extends Error {
  constructor() {
    super('Connexion requise pour cette action.');
  }
}

class NotOwnerError extends Error {
  constructor() {
    super('Seul l’auteur peut modifier cette contribution.');
  }
}

function currentSession(): AuthSession | null {
  return store.get<AuthSession | null>(KEYS.session, null);
}

function requireSession(): AuthSession {
  const session = currentSession();
  if (!session) throw new NotAuthenticatedError();
  return session;
}

/** Rôles de démonstration du backend local (documentés dans le README). */
function demoRoleForEmail(email: string): Role {
  if (email.startsWith('admin@')) return 'admin';
  if (email.startsWith('modo@')) return 'moderator';
  return 'member';
}

function createLocalPlaceRepository(): PlaceRepository {
  return {
    async list(query: PlaceQuery = {}) {
      const places = loadSeeded(KEYS.places, SEED_PLACES);
      const statuses = query.statuses ?? ['published'];
      return places.filter(p => {
        if (p.deletedAt !== null) return false;
        if (!statuses.includes(p.status)) return false;
        if (query.authorId && p.authorId !== query.authorId) return false;
        if (
          query.boundingBox &&
          !isInBoundingBox(p.coordinates, query.boundingBox)
        )
          return false;
        return true;
      });
    },
    async getById(id) {
      const places = loadSeeded(KEYS.places, SEED_PLACES);
      return places.find(p => p.id === id && p.deletedAt === null) ?? null;
    },
    async create(draft: PlaceDraft) {
      const session = requireSession();
      const places = loadSeeded(KEYS.places, SEED_PLACES);
      const place: Place = {
        ...draft,
        id: newId(),
        status: 'pending',
        authorId: session.userId,
        lastVerifiedAt: null,
        photos: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };
      store.set(KEYS.places, [...places, place]);
      announceTabChange('places');
      return place;
    },
    async updateOwn(id, draft) {
      const session = requireSession();
      const places = loadSeeded(KEYS.places, SEED_PLACES);
      const existing = places.find(p => p.id === id);
      if (!existing) throw new Error('Lieu introuvable.');
      if (existing.authorId !== session.userId) throw new NotOwnerError();
      const updated: Place = {
        ...existing,
        ...draft,
        // Toute modification repasse en validation.
        status: 'pending',
        updatedAt: nowIso(),
      };
      store.set(
        KEYS.places,
        places.map(p => (p.id === id ? updated : p))
      );
      announceTabChange('places');
      return updated;
    },
    async suggestRevision(placeId, draft, note) {
      const session = requireSession();
      const revisions = store.get<unknown[]>(KEYS.revisions, []);
      store.set(KEYS.revisions, [
        ...revisions,
        {
          id: newId(),
          placeId,
          draft,
          note,
          authorId: session.userId,
          status: 'pending',
          createdAt: nowIso(),
        },
      ]);
    },
  };
}

function createLocalEventRepository(): EventRepository {
  return {
    async list(query: EventQuery = {}) {
      const events = loadSeeded(KEYS.events, SEED_EVENTS);
      const statuses = query.statuses ?? ['published', 'cancelled'];
      return events.filter(e => {
        if (e.deletedAt !== null) return false;
        if (!statuses.includes(e.status)) return false;
        if (query.placeId && e.placeId !== query.placeId) return false;
        if (query.authorId && e.authorId !== query.authorId) return false;
        if (query.from && new Date(e.endsAt) < query.from) return false;
        if (query.to && new Date(e.startsAt) > query.to) return false;
        return true;
      });
    },
    async getById(id) {
      const events = loadSeeded(KEYS.events, SEED_EVENTS);
      return events.find(e => e.id === id && e.deletedAt === null) ?? null;
    },
    async create(draft: EventDraft) {
      const session = requireSession();
      const events = loadSeeded(KEYS.events, SEED_EVENTS);
      const event: FamilyEvent = {
        ...draft,
        id: newId(),
        status: 'proposed',
        authorId: session.userId,
        lastVerifiedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };
      store.set(KEYS.events, [...events, event]);
      announceTabChange('events');
      return event;
    },
    async updateOwn(id, draft) {
      const session = requireSession();
      const events = loadSeeded(KEYS.events, SEED_EVENTS);
      const existing = events.find(e => e.id === id);
      if (!existing) throw new Error('Événement introuvable.');
      if (existing.authorId !== session.userId) throw new NotOwnerError();
      const updated: FamilyEvent = {
        ...existing,
        ...draft,
        status: 'proposed',
        updatedAt: nowIso(),
      };
      store.set(
        KEYS.events,
        events.map(e => (e.id === id ? updated : e))
      );
      announceTabChange('events');
      return updated;
    },
  };
}

function createLocalReviewRepository(): ReviewRepository {
  return {
    async listForPlace(placeId) {
      const reviews = loadSeeded(KEYS.reviews, SEED_REVIEWS);
      return reviews.filter(
        r =>
          r.placeId === placeId &&
          r.deletedAt === null &&
          r.status === 'published'
      );
    },
    async listByAuthor(authorId) {
      const reviews = loadSeeded(KEYS.reviews, SEED_REVIEWS);
      return reviews.filter(
        r => r.authorId === authorId && r.deletedAt === null
      );
    },
    async create(draft: ReviewDraft) {
      const session = requireSession();
      const reviews = loadSeeded(KEYS.reviews, SEED_REVIEWS);
      const review: Review = {
        ...draft,
        id: newId(),
        authorId: session.userId,
        // Publication immédiate, modération a posteriori (signalements).
        status: 'published',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };
      store.set(KEYS.reviews, [...reviews, review]);
      announceTabChange('reviews');
      return review;
    },
    async updateOwn(id, draft) {
      const session = requireSession();
      const reviews = loadSeeded(KEYS.reviews, SEED_REVIEWS);
      const existing = reviews.find(r => r.id === id);
      if (!existing) throw new Error('Retour introuvable.');
      if (existing.authorId !== session.userId) throw new NotOwnerError();
      const updated: Review = { ...existing, ...draft, updatedAt: nowIso() };
      store.set(
        KEYS.reviews,
        reviews.map(r => (r.id === id ? updated : r))
      );
      announceTabChange('reviews');
      return updated;
    },
  };
}

function createLocalCategoryRepository(): CategoryRepository {
  return {
    async listActive() {
      const categories = loadSeeded(KEYS.categories, DEFAULT_CATEGORIES);
      return categories
        .filter(c => c.active)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async save(category: Category) {
      const categories = loadSeeded(KEYS.categories, DEFAULT_CATEGORIES);
      const exists = categories.some(c => c.id === category.id);
      store.set(
        KEYS.categories,
        exists
          ? categories.map(c => (c.id === category.id ? category : c))
          : [...categories, category]
      );
      return category;
    },
  };
}

function createLocalFavoriteRepository(): FavoriteRepository {
  return {
    async listIds() {
      return store.get<string[]>(KEYS.favorites, []);
    },
    async add(placeId) {
      const ids = store.get<string[]>(KEYS.favorites, []);
      if (!ids.includes(placeId)) {
        store.set(KEYS.favorites, [...ids, placeId]);
        announceTabChange('favorites');
      }
    },
    async remove(placeId) {
      const ids = store.get<string[]>(KEYS.favorites, []);
      store.set(
        KEYS.favorites,
        ids.filter(id => id !== placeId)
      );
      announceTabChange('favorites');
    },
  };
}

function createLocalAuthService(): AuthService {
  const listeners = new Set<(s: AuthSession | null) => void>();
  const notify = (s: AuthSession | null) => {
    for (const cb of listeners) cb(s);
  };

  return {
    async getSession() {
      return currentSession();
    },
    async signInWithEmail(email) {
      // Backend local : session immédiate de démonstration (pas de mot de
      // passe — l'authentification réelle est portée par Supabase Auth).
      const displayName = email.split('@')[0] ?? 'famille';
      const session: AuthSession = {
        userId: `local-${displayName}`,
        profile: {
          id: `local-${displayName}`,
          displayName,
          role: demoRoleForEmail(email),
          createdAt: nowIso(),
        },
      };
      store.set(KEYS.session, session);
      announceTabChange('session');
      notify(session);
      return { sent: true };
    },
    async signOut() {
      store.remove(KEYS.session);
      announceTabChange('session');
      notify(null);
    },
    onSessionChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async requestAccountDeletion() {
      // Localement : purge session + favoris. Côté Supabase : fonction serveur
      // dédiée (suppression compte + anonymisation contributions).
      store.remove(KEYS.session);
      store.remove(KEYS.favorites);
      notify(null);
    },
  };
}

function createLocalFileStorage(): FileStorageService {
  return {
    async uploadPhoto(blob, kind) {
      // Démo : data-URL en mémoire de page (pas de persistance d'images en
      // localStorage — quota). Supabase Storage prend le relais en réel.
      const url = URL.createObjectURL(blob);
      return `${kind}/${url}`;
    },
    getPublicUrl(storagePath) {
      const slash = storagePath.indexOf('/');
      return slash === -1 ? storagePath : storagePath.slice(slash + 1);
    },
  };
}

function createNominatimGeocoding(): GeocodingService {
  return {
    attribution: 'Recherche d’adresse : © OpenStreetMap / Nominatim',
    async search(query) {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '5');
      url.searchParams.set('countrycodes', 'fr');
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
      }>;
      return data.map(d => ({
        label: d.display_name,
        coordinates: { lat: Number(d.lat), lng: Number(d.lon) },
      }));
    },
  };
}

function createLocalModerationService(): ModerationService {
  return {
    async listOpenReports() {
      return store
        .get<Report[]>(KEYS.reports, [])
        .filter(r => r.status === 'open');
    },
    async report(
      targetType: ReportTarget,
      targetId: string,
      reason: ReportReason,
      details: string
    ) {
      const session = requireSession();
      const reports = store.get<Report[]>(KEYS.reports, []);
      store.set(KEYS.reports, [
        ...reports,
        {
          id: newId(),
          targetType,
          targetId,
          reason,
          details,
          reporterId: session.userId,
          status: 'open',
          createdAt: nowIso(),
        },
      ]);
    },
    async decide(
      reportId: string | null,
      targetType: ReportTarget,
      targetId: string,
      decision: ModerationDecision,
      reason: string
    ) {
      const session = requireSession();
      if (
        session.profile.role !== 'moderator' &&
        session.profile.role !== 'admin'
      ) {
        throw new Error('Action réservée à la modération.');
      }
      const actions = store.get<ModerationAction[]>(KEYS.moderationActions, []);
      store.set(KEYS.moderationActions, [
        ...actions,
        {
          id: newId(),
          moderatorId: session.userId,
          targetType,
          targetId,
          decision,
          reason,
          relatedReportId: reportId,
          createdAt: nowIso(),
        },
      ]);
      if (reportId) {
        const reports = store.get<Report[]>(KEYS.reports, []);
        store.set(
          KEYS.reports,
          reports.map(r =>
            r.id === reportId
              ? {
                  ...r,
                  status:
                    decision === 'dismiss-report' ? 'dismissed' : 'resolved',
                }
              : r
          )
        );
      }
      // Application de la décision sur le contenu ciblé.
      if (targetType === 'place') {
        const places = store.get<Place[]>(KEYS.places, []);
        store.set(
          KEYS.places,
          places.map(p => {
            if (p.id !== targetId) return p;
            if (decision === 'approve')
              return { ...p, status: 'published' as const };
            if (decision === 'hide') return { ...p, status: 'hidden' as const };
            if (decision === 'reject')
              return { ...p, status: 'rejected' as const };
            return p;
          })
        );
      }
    },
    async history() {
      return store.get<ModerationAction[]>(KEYS.moderationActions, []);
    },
  };
}

const noopAnalytics: AnalyticsService = {
  track() {
    // Local : aucun envoi. Adaptateur GA4/GTM branchable via vite-pwa-base.
  },
};

export function createLocalBackend(): Backend {
  return {
    places: createLocalPlaceRepository(),
    events: createLocalEventRepository(),
    reviews: createLocalReviewRepository(),
    categories: createLocalCategoryRepository(),
    favorites: createLocalFavoriteRepository(),
    auth: createLocalAuthService(),
    files: createLocalFileStorage(),
    geocoding: createNominatimGeocoding(),
    moderation: createLocalModerationService(),
    analytics: noopAnalytics,
  };
}
