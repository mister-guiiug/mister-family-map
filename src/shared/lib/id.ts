/** Identifiants stables (UUID v4) — même format que les `uuid` Postgres/Supabase. */
export function newId(): string {
  return crypto.randomUUID();
}
