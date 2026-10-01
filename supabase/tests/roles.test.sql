-- mister-family-map : les rôles (0001, 0002). pgTAP, joué par
-- `supabase test db` sur la pile jetable de la CI.
--
-- 0002 retire au client l'exécution de `current_role_of`, qui rend le rôle de
-- n'importe quel utilisateur. Ce fichier prouve le retrait, puis que les deux
-- aides de la RLS qui l'appellent, `is_admin` et `is_moderator`, répondent
-- toujours sous le rôle d'une session : sans quoi toutes les politiques qui
-- les citent tomberaient, en silence.

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(6);

select ok(
  not has_function_privilege('anon', 'public.current_role_of(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.current_role_of(uuid)', 'execute'),
  'ni anon ni authenticated n''exécutent current_role_of'
);
select ok(
  has_function_privilege('anon', 'public.is_admin()', 'execute')
  and has_function_privilege('authenticated', 'public.is_admin()', 'execute')
  and has_function_privilege('anon', 'public.is_moderator()', 'execute')
  and has_function_privilege('authenticated', 'public.is_moderator()', 'execute'),
  'les aides de la RLS restent exécutables : les politiques les évaluent sous l''appelant'
);

-- Deux comptes, posés sous `postgres`. Le déclencheur `on_auth_user_created`
-- leur crée un profil et le rôle `member` ; l'une devient administratrice.
insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'admin@essai.test'),
  ('b2222222-2222-4222-8222-222222222222', 'membre@essai.test');
update public.user_roles set role = 'admin'
 where user_id = 'a1111111-1111-4111-8111-111111111111';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.is_admin(), 'l''administratrice est administratrice');
select ok(public.is_moderator(), 'et modératrice, par la même voie');
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(
  not public.is_admin() and not public.is_moderator(),
  'le membre n''est ni l''un ni l''autre'
);
select throws_ok(
  $$ select public.current_role_of('a1111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'et il ne peut plus demander le rôle d''un autre'
);
reset role;

select * from finish();

rollback;
