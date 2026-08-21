import { z } from 'zod';

/**
 * Variables d'environnement de build, validées au démarrage. AUCUN secret ici :
 * la clé « anon » Supabase est publique par conception (la sécurité vient des
 * politiques RLS) ; la service_role ne doit JAMAIS approcher le client.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /** Force le backend : `local` (défaut sans config Supabase) ou `supabase`. */
  VITE_BACKEND: z.enum(['local', 'supabase']).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(
  raw: Record<string, unknown> = import.meta.env
): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('Variables d’environnement invalides — repli backend local.');
    return {};
  }
  return parsed.data;
}

export function resolveBackendKind(env: AppEnv): 'local' | 'supabase' {
  if (env.VITE_BACKEND) return env.VITE_BACKEND;
  return env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? 'supabase'
    : 'local';
}
