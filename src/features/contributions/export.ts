/**
 * L'export des contributions — la promesse écrite en page « Mentions ».
 *
 * LE DÉFAUT CORRIGÉ ICI. `LegalPage.tsx` dit à l'utilisateur, au chapitre
 * Confidentialité : « Vous pouvez supprimer votre compte et exporter vos
 * contributions depuis le profil. » La suppression de compte existait. L'export,
 * lui, n'existait nulle part — ni dans le Profil, ni dans « Mes
 * contributions ». Le seul export de l'app était le fichier `.ics` d'un
 * événement. Une page qui énonce un droit sans l'outiller ne vaut pas mieux
 * qu'une page qui n'en parle pas : elle est fausse.
 *
 * TROIS DÉCISIONS :
 *
 * 1. **Par les PORTS, pas par le stockage.** L'export lit les mêmes dépôts que
 *    les écrans (`backend.places`, `backend.events`, …). Il fonctionnera donc
 *    tel quel le jour où les dix ports restants passeront à Supabase — un
 *    export qui lirait `localStorage` rendrait un fichier vide ce jour-là,
 *    sans erreur.
 * 2. **Le supprimé est DEDANS.** Une contribution supprimée est logique, donc
 *    toujours stockée : elle est encore à l'utilisateur, et un export de
 *    portabilité qui la cacherait mentirait sur ce qui est conservé. Chaque
 *    enregistrement porte son `deletedAt`.
 * 3. **Les favoris sont RÉSOLUS.** Une liste d'identifiants ne dit rien à un
 *    humain qui ouvre le fichier. Chaque favori emporte le nom du lieu quand il
 *    est lisible — et l'identifiant seul quand il ne l'est plus (lieu supprimé
 *    par la modération), plutôt que de le taire.
 */
import { dateSlug } from '@mister-guiiug/dev-pwa-config/download';
import type { Place } from '../../entities/place/model';
import { PUBLICATION_STATUSES } from '../../entities/place/model';
import type { FamilyEvent } from '../../entities/event/model';
import { EVENT_STATUSES } from '../../entities/event/model';
import type { Review } from '../../entities/review/model';
import type { AuthSession } from '../../entities/user/model';
import type { Backend } from '../../shared/api/ports';

/** Un favori, tel qu'il se lit dans le fichier. */
export interface ExportedFavorite {
  placeId: string;
  /** `null` quand le lieu n'est plus lisible (supprimé, masqué). */
  name: string | null;
}

export interface ContributionsExport {
  app: 'mister-family-map';
  /** Version du FORMAT de fichier, indépendante de celle du stockage local. */
  format: 1;
  exportedAt: string;
  account: {
    userId: string;
    displayName: string;
    role: string;
  };
  places: Place[];
  events: FamilyEvent[];
  reviews: Review[];
  favorites: ExportedFavorite[];
}

export interface ContributionsInput {
  session: AuthSession;
  places: Place[];
  events: FamilyEvent[];
  reviews: Review[];
  favorites: ExportedFavorite[];
  exportedAt?: Date;
}

/**
 * Assemble le fichier. Fonction PURE : ce qui décide de son contenu est
 * éprouvable sans navigateur, sans stockage et sans réseau.
 *
 * Filtre par auteur une seconde fois, après les dépôts : un adaptateur qui
 * ignorerait `authorId` (une erreur de requête, une politique RLS trop large)
 * ferait sinon partir les contributions d'autrui dans le fichier de
 * l'utilisateur.
 */
export function buildContributionsExport(
  input: ContributionsInput
): ContributionsExport {
  const mine = input.session.userId;
  return {
    app: 'mister-family-map',
    format: 1,
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    account: {
      userId: input.session.userId,
      displayName: input.session.profile.displayName,
      role: input.session.profile.role,
    },
    places: input.places.filter(p => p.authorId === mine),
    events: input.events.filter(e => e.authorId === mine),
    reviews: input.reviews.filter(r => r.authorId === mine),
    favorites: input.favorites,
  };
}

/**
 * Interroge les ports et résout les favoris.
 *
 * `includeDeleted` partout : cf. la décision 2 de l'en-tête.
 */
export async function collectContributions(
  backend: Backend,
  session: AuthSession
): Promise<Omit<ContributionsInput, 'exportedAt'>> {
  const [places, events, reviews, favoriteIds] = await Promise.all([
    backend.places.list({
      authorId: session.userId,
      statuses: PUBLICATION_STATUSES,
      includeDeleted: true,
    }),
    backend.events.list({
      authorId: session.userId,
      statuses: EVENT_STATUSES,
      includeDeleted: true,
    }),
    backend.reviews.listByAuthor(session.userId, { includeDeleted: true }),
    backend.favorites.listIds(),
  ]);

  const favorites = await Promise.all(
    favoriteIds.map(async (placeId): Promise<ExportedFavorite> => {
      try {
        const place = await backend.places.getById(placeId);
        return { placeId, name: place?.name ?? null };
      } catch {
        // Un favori illisible ne fait pas échouer tout l'export.
        return { placeId, name: null };
      }
    })
  );

  return { session, places, events, reviews, favorites };
}

/**
 * `mister-family-map-contributions-2026-09-06.json`
 *
 * `dateSlug` du socle, et non `toISOString().slice(0, 10)` : la date de l'ISO
 * est celle d'UTC. Un export lancé à 23 h 30 à Paris en été porterait le nom du
 * LENDEMAIN, et l'utilisateur qui trie ses fichiers par date se demanderait
 * lequel est le bon. `dateSlug` lit les composantes locales — la date que
 * l'utilisateur a sous les yeux.
 */
export function contributionsFilename(date = new Date()): string {
  return `mister-family-map-contributions-${dateSlug(date)}.json`;
}
