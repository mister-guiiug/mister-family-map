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
  ModerationDecision,
  ReportReason,
  ReportTarget,
} from '../../../entities/moderation/model';
import type { AuthSession, Role } from '../../../entities/user/model';
import { newId } from '../../lib/id';
import { isInBoundingBox } from '@mister-guiiug/dev-pwa-config/geo';
import { readSnapshot, writeSnapshot, type AppSnapshot } from './snapshot';
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
/**
 * L'ÉTAT LOCAL EST UN INSTANTANÉ VERSIONNÉ. Les neuf clés `mfm_*` écrites
 * jusqu'ici — un tableau nu chacune, sans version — vivent désormais sous
 * `mfm_data`, enveloppées de leur version par le magasin du socle. La
 * migration `0 → 1` les relit toutes, une fois, sans rien perdre :
 * `snapshot.ts` porte le POURQUOI, `snapshot.test.ts` la preuve.
 *
 * Pour ce fichier, la seule chose qui change est la façon de lire et
 * d'écrire : `readSnapshot().places` remplace `loadSeeded(KEYS.places, …)`,
 * et `writeSnapshot({ places })` remplace `store.set(KEYS.places, …)`. Les
 * données de démonstration ne sont plus posées collection par collection à la
 * première lecture — le magasin les rend comme état initial, et rien n'est
 * écrit tant que l'utilisateur n'a rien fait.
 */

function nowIso(): string {
  return new Date().toISOString();
}

/** Lecture d'une collection de l'instantané. */
function read<K extends keyof AppSnapshot>(key: K): AppSnapshot[K] {
  return readSnapshot()[key];
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
  return read('session');
}

function requireSession(): AuthSession {
  const session = currentSession();
  if (!session) throw new NotAuthenticatedError();
  return session;
}

/**
 * Pose — ou retire — `deletedAt` sur la contribution de l'AUTEUR.
 *
 * Rien ne sort du tableau : la suppression est LOGIQUE, donc réversible, et
 * c'est exactement ce qui rend « Annuler » possible sans dialogue de
 * confirmation préalable (docs/adr/0005-annuler-plutot-que-confirmer.md). La
 * règle d'autorisation est celle d'`updateOwn` — session exigée, auteur seul —
 * parce que supprimer est une modification comme une autre, et que le backend
 * Supabase l'applique par la même politique RLS `update own`.
 */
function markDeleted<
  T extends {
    id: string;
    authorId: string;
    deletedAt: string | null;
    updatedAt: string;
  },
>(items: T[], id: string, deleted: boolean): T[] {
  const session = requireSession();
  const existing = items.find(i => i.id === id);
  if (!existing) throw new Error('Contribution introuvable.');
  if (existing.authorId !== session.userId) throw new NotOwnerError();
  const now = nowIso();
  return items.map(i =>
    i.id === id ? { ...i, deletedAt: deleted ? now : null, updatedAt: now } : i
  );
}

/** Rôles de démonstration du backend local (documentés dans le README). */
function demoRoleForEmail(email: string): Role {
  if (email.startsWith('admin@')) return 'admin';
  if (email.startsWith('modo@')) return 'moderator';
  return 'member';
}

function createLocalPlaceRepository(): PlaceRepository {
  return {
    // Stockage du navigateur : écrire ne demande jamais le réseau.
    requiresNetwork: false,
    async list(query: PlaceQuery = {}) {
      const places = read('places');
      const statuses = query.statuses ?? ['published'];
      return places.filter(p => {
        if (p.deletedAt !== null && !query.includeDeleted) return false;
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
      const places = read('places');
      return places.find(p => p.id === id && p.deletedAt === null) ?? null;
    },
    async create(draft: PlaceDraft) {
      const session = requireSession();
      const places = read('places');
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
      writeSnapshot({ places: [...places, place] });
      announceTabChange({ topic: 'places' });
      return place;
    },
    async updateOwn(id, draft) {
      const session = requireSession();
      const places = read('places');
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
      writeSnapshot({ places: places.map(p => (p.id === id ? updated : p)) });
      announceTabChange({ topic: 'places' });
      return updated;
    },
    async suggestRevision(placeId, draft, note) {
      const session = requireSession();
      const revisions = read('revisions');
      writeSnapshot({
        revisions: [
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
        ],
      });
    },
    async deleteOwn(id) {
      writeSnapshot({ places: markDeleted(read('places'), id, true) });
      announceTabChange({ topic: 'places' });
    },
    async restoreOwn(id) {
      writeSnapshot({ places: markDeleted(read('places'), id, false) });
      announceTabChange({ topic: 'places' });
    },
  };
}

function createLocalEventRepository(): EventRepository {
  return {
    async list(query: EventQuery = {}) {
      const events = read('events');
      const statuses = query.statuses ?? ['published', 'cancelled'];
      return events.filter(e => {
        if (e.deletedAt !== null && !query.includeDeleted) return false;
        if (!statuses.includes(e.status)) return false;
        if (query.placeId && e.placeId !== query.placeId) return false;
        if (query.authorId && e.authorId !== query.authorId) return false;
        if (query.from && new Date(e.endsAt) < query.from) return false;
        if (query.to && new Date(e.startsAt) > query.to) return false;
        return true;
      });
    },
    async getById(id) {
      const events = read('events');
      return events.find(e => e.id === id && e.deletedAt === null) ?? null;
    },
    async create(draft: EventDraft) {
      const session = requireSession();
      const events = read('events');
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
      writeSnapshot({ events: [...events, event] });
      announceTabChange({ topic: 'events' });
      return event;
    },
    async updateOwn(id, draft) {
      const session = requireSession();
      const events = read('events');
      const existing = events.find(e => e.id === id);
      if (!existing) throw new Error('Événement introuvable.');
      if (existing.authorId !== session.userId) throw new NotOwnerError();
      const updated: FamilyEvent = {
        ...existing,
        ...draft,
        status: 'proposed',
        updatedAt: nowIso(),
      };
      writeSnapshot({ events: events.map(e => (e.id === id ? updated : e)) });
      announceTabChange({ topic: 'events' });
      return updated;
    },
    async deleteOwn(id) {
      writeSnapshot({ events: markDeleted(read('events'), id, true) });
      announceTabChange({ topic: 'events' });
    },
    async restoreOwn(id) {
      writeSnapshot({ events: markDeleted(read('events'), id, false) });
      announceTabChange({ topic: 'events' });
    },
  };
}

function createLocalReviewRepository(): ReviewRepository {
  return {
    async listForPlace(placeId) {
      const reviews = read('reviews');
      return reviews.filter(
        r =>
          r.placeId === placeId &&
          r.deletedAt === null &&
          r.status === 'published'
      );
    },
    async listByAuthor(authorId, options = {}) {
      const reviews = read('reviews');
      return reviews.filter(
        r =>
          r.authorId === authorId &&
          (r.deletedAt === null || Boolean(options.includeDeleted))
      );
    },
    async create(draft: ReviewDraft) {
      const session = requireSession();
      const reviews = read('reviews');
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
      writeSnapshot({ reviews: [...reviews, review] });
      announceTabChange({ topic: 'reviews' });
      return review;
    },
    async updateOwn(id, draft) {
      const session = requireSession();
      const reviews = read('reviews');
      const existing = reviews.find(r => r.id === id);
      if (!existing) throw new Error('Retour introuvable.');
      if (existing.authorId !== session.userId) throw new NotOwnerError();
      const updated: Review = { ...existing, ...draft, updatedAt: nowIso() };
      writeSnapshot({ reviews: reviews.map(r => (r.id === id ? updated : r)) });
      announceTabChange({ topic: 'reviews' });
      return updated;
    },
    async deleteOwn(id) {
      writeSnapshot({ reviews: markDeleted(read('reviews'), id, true) });
      announceTabChange({ topic: 'reviews' });
    },
    async restoreOwn(id) {
      writeSnapshot({ reviews: markDeleted(read('reviews'), id, false) });
      announceTabChange({ topic: 'reviews' });
    },
  };
}

function createLocalCategoryRepository(): CategoryRepository {
  return {
    async listActive() {
      const categories = read('categories');
      return categories
        .filter(c => c.active)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async save(category: Category) {
      const categories = read('categories');
      const exists = categories.some(c => c.id === category.id);
      writeSnapshot({
        categories: exists
          ? categories.map(c => (c.id === category.id ? category : c))
          : [...categories, category],
      });
      return category;
    },
  };
}

function createLocalFavoriteRepository(): FavoriteRepository {
  return {
    async listIds() {
      return read('favorites');
    },
    // L'annonce porte la LISTE, pas l'ordre d'aller la relire : l'onglet qui
    // reçoit peut voir un `localStorage` qui n'a pas encore reçu l'écriture
    // ci-dessus (cf. l'en-tête de `tab-sync.ts`).
    async add(placeId) {
      const ids = read('favorites');
      if (!ids.includes(placeId)) {
        const next = [...ids, placeId];
        writeSnapshot({ favorites: next });
        announceTabChange({ topic: 'favorites', ids: next });
      }
    },
    async remove(placeId) {
      const next = read('favorites').filter(id => id !== placeId);
      writeSnapshot({ favorites: next });
      announceTabChange({ topic: 'favorites', ids: next });
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
      writeSnapshot({ session });
      announceTabChange({ topic: 'session', session });
      notify(session);
      return { sent: true };
    },
    async signOut() {
      writeSnapshot({ session: null });
      announceTabChange({ topic: 'session', session: null });
      notify(null);
    },
    onSessionChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async requestAccountDeletion() {
      // Localement : purge session + favoris. Côté Supabase : fonction serveur
      // dédiée (suppression compte + anonymisation contributions).
      writeSnapshot({ session: null, favorites: [] });
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
      return read('reports').filter(r => r.status === 'open');
    },
    async report(
      targetType: ReportTarget,
      targetId: string,
      reason: ReportReason,
      details: string
    ) {
      const session = requireSession();
      const reports = read('reports');
      writeSnapshot({
        reports: [
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
        ],
      });
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
      const actions = read('moderationActions');
      writeSnapshot({
        moderationActions: [
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
        ],
      });
      if (reportId) {
        const reports = read('reports');
        writeSnapshot({
          reports: reports.map(r =>
            r.id === reportId
              ? {
                  ...r,
                  status:
                    decision === 'dismiss-report' ? 'dismissed' : 'resolved',
                }
              : r
          ),
        });
      }
      // Application de la décision sur le contenu ciblé.
      if (targetType === 'place') {
        const places = read('places');
        writeSnapshot({
          places: places.map(p => {
            if (p.id !== targetId) return p;
            if (decision === 'approve')
              return { ...p, status: 'published' as const };
            if (decision === 'hide') return { ...p, status: 'hidden' as const };
            if (decision === 'reject')
              return { ...p, status: 'rejected' as const };
            return p;
          }),
        });
      }
    },
    async history() {
      return read('moderationActions');
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
