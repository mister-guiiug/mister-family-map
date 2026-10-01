-- ============================================================================
-- mister-family-map — 0002 : current_role_of n'est plus exécutable par le client
--
-- POURQUOI. Supabase accorde EXECUTE à `anon` et `authenticated` sur toute
-- fonction créée dans `public`, par un privilège par défaut. `current_role_of`
-- (0001) est SECURITY DEFINER et rend le rôle de N'IMPORTE QUEL utilisateur :
-- la clé publique du bundle pouvait donc demander, pour chaque identifiant lu
-- dans `profiles` (lisible par tous), qui est modérateur ou administrateur.
-- Relevé le 01/10/2026 en posant `supabase/tests/structure-securite.test.sql`,
-- dont le deuxième invariant n'admet que des fonctions relues.
--
-- SANS EFFET DE BORD. Seules `is_moderator()` et `is_admin()` l'appellent.
-- Elles sont SECURITY DEFINER (et portent un `set search_path`, donc ne sont
-- jamais inlinées) : elles l'appellent sous leur propriétaire, qui garde le
-- droit. Elles-mêmes restent exécutables par `anon` et `authenticated` : les
-- politiques RLS les évaluent sous le rôle de l'appelant, et elles ne parlent
-- que de lui (`auth.uid()`). Le client n'appelle pas `current_role_of`.
--
-- Rejouable : un `revoke` déjà fait ne change rien.
-- ============================================================================

revoke execute on function public.current_role_of(uuid)
  from public, anon, authenticated;
