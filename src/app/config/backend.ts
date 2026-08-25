import type { Backend } from '../../shared/api/ports';
import { createLocalBackend } from '../../shared/api/local/local-backend';
import { createSupabaseClient } from '../../shared/api/supabase/client';
import { createSupabasePlaceRepository } from '../../shared/api/supabase/supabase-place-repository';
import { readEnv, resolveBackendKind } from './env';

/**
 * Sélection du backend au démarrage.
 *
 * - `local` (défaut) : adaptateurs localStorage + seed — app utilisable sans
 *   serveur, y compris hors ligne.
 * - `supabase` : PlaceRepository branché sur Supabase (adaptateur de
 *   référence) ; les autres ports restent locaux tant que leurs adaptateurs
 *   ne sont pas écrits — migration port par port, suivie dans le README
 *   (« Feuille de route backend »).
 */
export function createBackend(options: { fetch?: typeof fetch } = {}): Backend {
  const env = readEnv();
  const kind = resolveBackendKind(env);
  const local = createLocalBackend();

  if (
    kind === 'supabase' &&
    env.VITE_SUPABASE_URL &&
    env.VITE_SUPABASE_ANON_KEY
  ) {
    const client = createSupabaseClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY,
      { ...(options.fetch ? { fetch: options.fetch } : {}) }
    );
    return {
      ...local,
      places: createSupabasePlaceRepository(client),
    };
  }

  return local;
}
