/**
 * Accès au stockage local — délégué au socle.
 *
 * CE FICHIER ÉTAIT UN DOUBLON. Les trente lignes qu'il contenait — `readJson`,
 * `writeJson`, `removeKey` enveloppés d'un `try/catch` — sont recopiées dans
 * SEPT des dix-sept apps de la famille : la plus grosse duplication du relevé
 * d'adoption. Elles vivent désormais dans
 * `@mister-guiiug/dev-pwa-config/storage`, avec les tests qu'elles n'avaient
 * nulle part.
 *
 * LES CLÉS NE CHANGENT PAS D'UN OCTET. `createStore('mfm_')` préfixe ce qu'on
 * lui donne : `store.get('places')` lit `mfm_places`, exactement la clé que
 * `local-backend.ts` écrivait déjà. C'est la condition pour que la mise à jour
 * ne fasse pas disparaître les lieux, les favoris et la session des
 * utilisateurs qui ont l'app installée.
 *
 * Le préfixe compte : les seize apps de la famille sont servies depuis
 * `mister-guiiug.github.io`, donc depuis UN seul `localStorage`.
 */
import { createStore } from '@mister-guiiug/dev-pwa-config/storage';

/** Le magasin de l'app. Toutes ses clés commencent par `mfm_`. */
export const store = createStore('mfm_');

/** Le stockage accepte-t-il réellement une écriture ? (Éprouvé, pas supposé.) */
export function storageAvailable(): boolean {
  return store.available();
}
