/**
 * L'état local de l'app, sous UNE clé, VERSIONNÉE.
 *
 * LE DÉFAUT CORRIGÉ ICI. Jusqu'à ce fichier, le backend local écrivait neuf
 * clés indépendantes (`mfm_places`, `mfm_events`, `mfm_reviews`, …), chacune
 * un tableau nu, sans version ni migration. Tant que le modèle ne bouge pas,
 * rien ne se voit. Le jour où il bouge — un champ ajouté, un statut renommé —
 * l'app lit une donnée qu'elle ne comprend plus, et la réécrit par-dessus :
 * les lieux saisis, l'agenda et les retours de la famille disparaissent d'un
 * coup, chez tout le monde, sans message d'erreur. Une perte latente, invisible
 * jusqu'à l'instant où elle est totale.
 *
 * CE QUE LE SOCLE APPORTE. `createVersionedStore` tient l'enveloppe
 * (`{ v, data }`), la chaîne de migrations (une par version SOURCE, chacune
 * monte d'un cran), et la règle sans exception : AVANT toute perte possible,
 * une copie de côté (`mfm_data.backup-v0`) ; APRÈS seulement, le repli. Une
 * donnée illisible, invalide ou venue d'une version d'après est mise DE CÔTÉ,
 * jamais jetée.
 *
 * CE QUE LE SOCLE NE PEUT PAS SAVOIR : où sont les données d'hier. C'est
 * `primeFromLegacy` + la migration `0 → 1` ci-dessous — les neuf clés
 * existantes sont relues et rassemblées, une seule fois, sans rien perdre.
 * `snapshot.test.ts` fige ce parcours sur un instantané des clés réelles.
 *
 * DEUX CHOIX, ET LEUR RAISON (cf. docs/adr/0004-magasin-versionne.md) :
 *
 * 1. **Les clés d'hier ne sont pas effacées.** Elles deviennent inertes. Un
 *    retour arrière du déploiement — ou un onglet resté sur l'ancienne
 *    version — retrouve alors l'app exactement dans l'état d'avant la
 *    migration, au lieu d'un stockage vide.
 * 2. **La validation est LÂCHE** : forme de l'objet et type des collections,
 *    pas le contenu de chaque enregistrement. Un `placeSchema.parse` sur tout
 *    le tableau échangerait « un lieu mal formé » contre « toutes les données
 *    dans un fichier de secours que l'utilisateur ne sait pas atteindre ».
 *    Les écritures, elles, restent validées à la saisie par zod.
 */
import { createVersionedStore } from '@mister-guiiug/dev-pwa-config/versioned-store';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';
import type { Category } from '../../../entities/category/model';
import type { Place } from '../../../entities/place/model';
import type { FamilyEvent } from '../../../entities/event/model';
import type { Review } from '../../../entities/review/model';
import type {
  ModerationAction,
  Report,
} from '../../../entities/moderation/model';
import type { AuthSession } from '../../../entities/user/model';
import { DEFAULT_CATEGORIES } from '../../constants/default-categories';
import { store } from '../storage';
import { SEED_EVENTS, SEED_PLACES, SEED_REVIEWS } from './seed';

const log = createLogger('snapshot');

/** Proposition de modification d'un lieu — non modélisée en zod à ce jour. */
export interface PlaceRevision {
  id: string;
  placeId: string;
  [field: string]: unknown;
}

/** Tout l'état local de l'app, en un objet. */
export interface AppSnapshot {
  places: Place[];
  events: FamilyEvent[];
  reviews: Review[];
  categories: Category[];
  favorites: string[];
  session: AuthSession | null;
  reports: Report[];
  moderationActions: ModerationAction[];
  revisions: PlaceRevision[];
}

/** Sans préfixe : `store` porte `mfm_`, la clé réelle est `mfm_data`. */
export const SNAPSHOT_KEY = 'data';

/** Version du schéma local. Toute évolution ajoute une migration, jamais moins. */
export const SNAPSHOT_VERSION = 1;

/**
 * Les clés d'hier, une par collection, SANS le préfixe `mfm_`.
 *
 * C'est la seule chose que la migration ne peut pas déduire — un renommage
 * silencieux ferait disparaître une collection entière. `snapshot.test.ts` les
 * fige nommément.
 */
export const LEGACY_KEYS = {
  places: 'places',
  events: 'events',
  reviews: 'reviews',
  categories: 'categories',
  favorites: 'favorites',
  session: 'session',
  reports: 'reports',
  moderationActions: 'moderation_actions',
  revisions: 'place_revisions',
} as const satisfies Record<keyof AppSnapshot, string>;

/** L'état d'une installation neuve : la démonstration, utilisable sans compte. */
function freshSnapshot(): AppSnapshot {
  return {
    places: [...SEED_PLACES],
    events: [...SEED_EVENTS],
    reviews: [...SEED_REVIEWS],
    categories: [...DEFAULT_CATEGORIES],
    favorites: [],
    session: null,
    reports: [],
    moderationActions: [],
    revisions: [],
  };
}

function asArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

/**
 * 0 → 1 : les neuf clés d'hier, rassemblées.
 *
 * `primeFromLegacy` a posé sous `mfm_data` ce qui EXISTAIT, tel quel et sans
 * enveloppe — le magasin le lit donc en version 0. Cette étape complète les
 * trous par les données de démonstration, exactement comme le faisait
 * `loadSeeded` clé par clé : un utilisateur qui n'a jamais ouvert l'agenda
 * n'avait pas de `mfm_events`, et retrouvait l'agenda de démonstration.
 */
function gatherLegacyKeys(data: unknown): unknown {
  const legacy = (
    data !== null && typeof data === 'object' ? data : {}
  ) as Partial<Record<keyof AppSnapshot, unknown>>;
  const base = freshSnapshot();
  return {
    places: asArray(legacy.places, base.places),
    events: asArray(legacy.events, base.events),
    reviews: asArray(legacy.reviews, base.reviews),
    categories: asArray(legacy.categories, base.categories),
    favorites: asArray(legacy.favorites, base.favorites),
    session: legacy.session ?? null,
    reports: asArray(legacy.reports, base.reports),
    moderationActions: asArray(
      legacy.moderationActions,
      base.moderationActions
    ),
    revisions: asArray(legacy.revisions, base.revisions),
  };
}

/**
 * Forme et types, pas contenu (cf. l'en-tête). Lève sur ce qui n'est
 * manifestement pas un instantané de cette app — c'est ce qui protège
 * `import()` d'un fichier étranger.
 */
function parseSnapshot(data: unknown): AppSnapshot {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Instantané illisible : ce n’est pas un objet.');
  }
  const raw = data as Partial<Record<keyof AppSnapshot, unknown>>;
  const known = (Object.keys(LEGACY_KEYS) as (keyof AppSnapshot)[]).filter(
    field => field in raw
  );
  if (known.length === 0) {
    throw new Error('Instantané illisible : aucune donnée de cette app.');
  }
  const base = freshSnapshot();
  return {
    places: asArray(raw.places, base.places),
    events: asArray(raw.events, base.events),
    reviews: asArray(raw.reviews, base.reviews),
    categories: asArray(raw.categories, base.categories),
    favorites: asArray(raw.favorites, base.favorites),
    session: (raw.session ?? null) as AuthSession | null,
    reports: asArray(raw.reports, base.reports),
    moderationActions: asArray(raw.moderationActions, base.moderationActions),
    revisions: asArray(raw.revisions, base.revisions),
  };
}

/** Le magasin versionné. Exporté pour `export()` / `import()`. */
export const snapshotStore = createVersionedStore<AppSnapshot>({
  store,
  key: SNAPSHOT_KEY,
  version: SNAPSHOT_VERSION,
  migrations: { 0: gatherLegacyKeys },
  validate: parseSnapshot,
  seed: freshSnapshot,
});

/**
 * Pose sous `mfm_data` ce que les clés d'hier contiennent — sans enveloppe,
 * donc lu en version 0 par le magasin, qui déclenche alors sa copie de côté
 * puis la migration.
 *
 * IDEMPOTENT : dès que l'instantané existe, il fait foi et les clés d'hier ne
 * sont plus regardées. Sans cette garde, un onglet resté sur l'ancienne
 * version réécrirait `mfm_places` et la migration se rejouerait par-dessus le
 * travail de l'utilisateur.
 */
function primeFromLegacy(): void {
  if (store.getRaw(SNAPSHOT_KEY) !== null) return;

  const gathered: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(LEGACY_KEYS)) {
    const raw = store.getRaw(key);
    if (raw === null) continue;
    try {
      gathered[field] = JSON.parse(raw) as unknown;
    } catch {
      // Illisible ne veut pas dire bon à jeter : la clé d'hier reste où elle
      // est, et cette collection repart des données de démonstration.
      log.warn('clé d’hier illisible, laissée en place', { key });
    }
  }

  // Rien à migrer : installation neuve. Le magasin rendra son seed, sans écrire.
  if (Object.keys(gathered).length === 0) return;

  store.set(SNAPSHOT_KEY, gathered);
}

/** L'état local, migré et validé. Ne lève jamais. */
export function readSnapshot(): AppSnapshot {
  primeFromLegacy();
  return snapshotStore.load();
}

/**
 * Écrit une ou plusieurs collections. Lecture-modification-écriture sur
 * l'instantané entier : c'est déjà ce que faisait chaque mutation clé par clé
 * (`store.set(KEYS.places, [...places, place])`), et localStorage étant
 * synchrone, la fenêtre entre les deux reste celle d'une instruction.
 */
export function writeSnapshot(patch: Partial<AppSnapshot>): AppSnapshot {
  const next = { ...readSnapshot(), ...patch };
  if (!snapshotStore.save(next)) {
    log.error('écriture du stockage impossible — modification non conservée');
  }
  return next;
}

/** Efface l'instantané ET ses copies de côté. Le reste du magasin survit. */
export function clearSnapshot(): void {
  snapshotStore.clear();
}
