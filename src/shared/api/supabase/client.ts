import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Fabrique du client Supabase. La clé anon est publique ; toutes les
 * autorisations sont portées par les politiques RLS (supabase/migrations) —
 * aucune confiance n'est accordée au rôle transmis par le navigateur.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options: { fetch?: typeof fetch } = {}
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    // `fetch` corrélé : chaque requête part avec X-Correlation-Id et
    // X-Session-Id, si bien que le journal du serveur et l'erreur remontée
    // côté client désignent le même incident.
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
  });
}
