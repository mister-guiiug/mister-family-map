import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Fabrique du client Supabase. La clé anon est publique ; toutes les
 * autorisations sont portées par les politiques RLS (supabase/migrations) —
 * aucune confiance n'est accordée au rôle transmis par le navigateur.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
