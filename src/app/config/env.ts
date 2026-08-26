import { z } from 'zod';
import { createLogger } from '@mister-guiiug/dev-wpa-config/logger';

/** Journal nommé : cet avertissement finit dans le fil d'Ariane des erreurs,
 *  au lieu de disparaître dans la console de l'utilisateur. */
const log = createLogger('config');

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
    log.warn('Variables d’environnement invalides — repli backend local.', {
      issues: parsed.error.issues.map(issue => issue.path.join('.')),
    });
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
