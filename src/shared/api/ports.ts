/**
 * Ports (interfaces) entre le domaine et les adaptateurs techniques.
 *
 * Règle d'architecture : les features et pages ne dépendent QUE de ces
 * interfaces ; les implémentations (local-first, Supabase) vivent dans
 * shared/api/local et shared/api/supabase et sont sélectionnées par
 * app/config/backend.ts. Aucune importation d'un SDK backend en dehors
 * des adaptateurs.
 */
import type { Category } from '../../entities/category/model';
import type {
  Place,
  PlaceDraft,
  PublicationStatus,
} from '../../entities/place/model';
import type { EventDraft, FamilyEvent } from '../../entities/event/model';
import type { Review, ReviewDraft } from '../../entities/review/model';
import type {
  ModerationAction,
  ModerationDecision,
  Report,
  ReportReason,
  ReportTarget,
} from '../../entities/moderation/model';
import type { AuthSession, Role } from '../../entities/user/model';
import type {
  BoundingBox,
  Coordinates,
} from '@mister-guiiug/dev-wpa-config/geo';

export interface PlaceQuery {
  /** Zone visible de la carte (« rechercher dans cette zone »). */
  boundingBox?: BoundingBox;
  /** Statuts demandés — par défaut, seuls les lieux publiés sont servis. */
  statuses?: readonly PublicationStatus[];
  authorId?: string;
}

export interface PlaceRepository {
  list(query?: PlaceQuery): Promise<Place[]>;
  getById(id: string): Promise<Place | null>;
  /** Crée en statut `pending` (ou `draft`), au nom de l'utilisateur courant. */
  create(draft: PlaceDraft): Promise<Place>;
  /** Mise à jour par l'AUTEUR de ses propres contributions uniquement. */
  updateOwn(id: string, draft: PlaceDraft): Promise<Place>;
  /**
   * Proposition de modification sur le lieu d'autrui (place_revisions) —
   * examinée en modération, jamais appliquée directement.
   */
  suggestRevision(
    placeId: string,
    draft: PlaceDraft,
    note: string
  ): Promise<void>;
}

export interface EventQuery {
  from?: Date;
  to?: Date;
  statuses?: readonly FamilyEvent['status'][];
  placeId?: string;
  authorId?: string;
}

export interface EventRepository {
  list(query?: EventQuery): Promise<FamilyEvent[]>;
  getById(id: string): Promise<FamilyEvent | null>;
  create(draft: EventDraft): Promise<FamilyEvent>;
  updateOwn(id: string, draft: EventDraft): Promise<FamilyEvent>;
}

export interface ReviewRepository {
  listForPlace(placeId: string): Promise<Review[]>;
  listByAuthor(authorId: string): Promise<Review[]>;
  create(draft: ReviewDraft): Promise<Review>;
  updateOwn(id: string, draft: ReviewDraft): Promise<Review>;
}

export interface CategoryRepository {
  listActive(): Promise<Category[]>;
  /** Administration (rôle admin, contrôlé côté serveur). */
  save(category: Category): Promise<Category>;
}

export interface FavoriteRepository {
  listIds(): Promise<string[]>;
  add(placeId: string): Promise<void>;
  remove(placeId: string): Promise<void>;
}

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  signInWithEmail(email: string): Promise<{ sent: boolean }>;
  signOut(): Promise<void>;
  /** Abonnement aux changements de session ; renvoie une fonction de désinscription. */
  onSessionChange(cb: (session: AuthSession | null) => void): () => void;
  /** Suppression de compte (droit à l'effacement) — action sensible côté serveur. */
  requestAccountDeletion(): Promise<void>;
}

export interface FileStorageService {
  /** Téléverse une photo déjà assainie (métadonnées retirées) ; renvoie son chemin. */
  uploadPhoto(blob: Blob, kind: 'place' | 'review'): Promise<string>;
  /** URL affichable (signée ou publique selon le backend). */
  getPublicUrl(storagePath: string): string;
}

export interface GeocodingResult {
  label: string;
  coordinates: Coordinates;
}

export interface GeocodingService {
  /** Adresse/commune → coordonnées (avec attribution du fournisseur). */
  search(query: string): Promise<GeocodingResult[]>;
  attribution: string;
}

export interface ModerationService {
  listOpenReports(): Promise<Report[]>;
  report(
    targetType: ReportTarget,
    targetId: string,
    reason: ReportReason,
    details: string
  ): Promise<void>;
  decide(
    reportId: string | null,
    targetType: ReportTarget,
    targetId: string,
    decision: ModerationDecision,
    reason: string
  ): Promise<void>;
  history(): Promise<ModerationAction[]>;
}

export interface AnalyticsService {
  /** Événements produit anonymes — jamais de position ni d'identifiant enfant. */
  track(event: string, props?: Record<string, string | number | boolean>): void;
}

export interface RoleService {
  getRole(): Promise<Role>;
}

/** Regroupe tous les ports — injecté via React context (app/providers). */
export interface Backend {
  places: PlaceRepository;
  events: EventRepository;
  reviews: ReviewRepository;
  categories: CategoryRepository;
  favorites: FavoriteRepository;
  auth: AuthService;
  files: FileStorageService;
  geocoding: GeocodingService;
  moderation: ModerationService;
  analytics: AnalyticsService;
}
