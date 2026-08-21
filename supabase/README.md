# Backend Supabase

## Mise en place

1. Créer un projet sur [supabase.com](https://supabase.com) (plan Free suffisant
   pour le MVP).
2. Appliquer les migrations avec la CLI Supabase :

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

   En CI, réutiliser la composite action famille
   `mister-guiiug/dev-wpa-config/.github/actions/supabase-migrate@v3`
   (secrets requis : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
   `SUPABASE_PROJECT_REF`).

3. Créer un bucket Storage **privé** `photos` (les URLs signées sont générées à
   la demande ; aucune photo en accès public direct).
4. Renseigner côté app (variables de build, jamais committées) :

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<clé anon publique>
   ```

   La clé `service_role` ne doit JAMAIS être utilisée côté client ni en CI de
   build — uniquement dans des fonctions serveur.

5. Anti-pause plan Free : appliquer
   `dev-wpa-config/templates/supabase/keep-alive.sql` puis copier le workflow
   `templates/github-workflows/supabase-keepalive.yml` (cf. README du paquet
   partagé).

## Sécurité

- RLS activée sur toutes les tables, politiques par opération (cf. migration).
- Les rôles vivent dans `user_roles`, jamais dans le JWT côté client : les
  fonctions `is_moderator()` / `is_admin()` (SECURITY DEFINER) font foi.
- Les triggers `places_force_defaults` / `places_reset_status` imposent
  auteur et statut côté serveur : le client ne peut ni publier directement,
  ni contribuer au nom d'autrui.
- Limitation de débit : à poser au niveau API (paramètres Supabase) et/ou via
  des Edge Functions pour les actions sensibles — suivi dans
  docs/THREAT-MODEL.md.

## Feuille de route des adaptateurs

| Port                                                                                                                          | Adaptateur Supabase                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| PlaceRepository                                                                                                               | ✅ `shared/api/supabase/supabase-place-repository.ts` (référence)                                             |
| EventRepository, ReviewRepository, CategoryRepository, FavoriteRepository, AuthService, FileStorageService, ModerationService | À écrire sur le même patron (mapping ligne → schéma Zod du domaine, zéro décision d'autorisation côté client) |
