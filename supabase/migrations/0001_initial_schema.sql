-- ============================================================================
-- mister-family-map — schéma initial (Supabase / Postgres)
-- Migration versionnée : ne jamais modifier après application ; toute évolution
-- passe par une nouvelle migration.
--
-- Principes :
--  * RLS activée sur TOUTES les tables, politiques explicites par opération ;
--  * aucune confiance dans le rôle transmis par le client : les rôles vivent
--    dans user_roles, lus par des fonctions SECURITY DEFINER ;
--  * suppression LOGIQUE (deleted_at) des contenus collaboratifs ;
--  * aucune donnée nominative sur les enfants (tranches d'âge uniquement) ;
--  * stratégie géospatiale MVP : colonnes lat/lng contraintes + index B-tree
--    (requêtes par rectangle). PostGIS est disponible sur Supabase et pourra
--    être adoptée dans une migration ultérieure si le besoin (rayon exact,
--    tri par distance SQL) le justifie — cf. docs/DATA-MODEL.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rôles applicatifs
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('member', 'moderator', 'admin');
create type public.publication_status as enum
  ('draft', 'pending', 'published', 'hidden', 'rejected');
create type public.event_status as enum
  ('draft', 'proposed', 'published', 'cancelled', 'finished');
create type public.tri_state as enum ('yes', 'no', 'unknown');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- profiles — profil public minimal (1-1 avec auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_roles — séparée de profiles : un utilisateur ne peut pas éditer son rôle.
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'member',
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now()
);

-- Helpers de rôle (SECURITY DEFINER : lisent user_roles sans l'exposer).
create or replace function public.current_role_of(uid uuid)
returns public.app_role
language sql security definer stable set search_path = public as $$
  select coalesce((select role from public.user_roles where user_id = uid), 'member');
$$;

create or replace function public.is_moderator()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_role_of(auth.uid()) in ('moderator', 'admin');
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_role_of(auth.uid()) = 'admin';
$$;

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'famille'));
  insert into public.user_roles (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories — configurables par l'administration
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 1 and 80),
  icon text not null default 'Sparkles',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- places — points d'intérêt
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  category_id uuid not null references public.categories (id),
  short_description text not null default '' check (char_length(short_description) <= 280),
  description text not null default '' check (char_length(description) <= 4000),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text not null default '' check (char_length(address) <= 200),
  city text not null default '' check (char_length(city) <= 100),
  age_min int check (age_min between 0 and 18),
  age_max int check (age_max between 0 and 18),
  duration_minutes int check (duration_minutes between 10 and 1440),
  price_kind text not null default 'unknown' check (price_kind in ('free','paid','unknown')),
  price_min_euros numeric(8,2) check (price_min_euros >= 0),
  price_max_euros numeric(8,2) check (price_max_euros >= 0),
  opening_hours text check (char_length(opening_hours) <= 500),
  website_url text check (website_url ~* '^https?://'),
  phone text check (char_length(phone) <= 20),
  practical_tips text not null default '' check (char_length(practical_tips) <= 2000),
  status public.publication_status not null default 'pending',
  author_id uuid not null default auth.uid() references auth.users (id),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint age_range_coherent check (
    (age_min is null and age_max is null) or (age_min <= age_max)
  )
);

-- Stratégie géospatiale MVP : rectangle englobant sur index composite.
create index places_lat_lng_idx on public.places (lat, lng) where deleted_at is null;
create index places_status_idx on public.places (status) where deleted_at is null;
create index places_author_idx on public.places (author_id);

-- place_features — attributs famille ternaires (1-1 avec places)
create table public.place_features (
  place_id uuid primary key references public.places (id) on delete cascade,
  accessibility public.tri_state not null default 'unknown',
  stroller public.tri_state not null default 'unknown',
  pets_allowed public.tri_state not null default 'unknown',
  water_point public.tri_state not null default 'unknown',
  toilets public.tri_state not null default 'unknown',
  picnic_area public.tri_state not null default 'unknown',
  food_nearby public.tri_state not null default 'unknown',
  weather_proof public.tri_state not null default 'unknown',
  setting text not null default 'unknown' check (setting in ('indoor','outdoor','mixed','unknown')),
  difficulty text not null default 'unknown' check (difficulty in ('easy','moderate','hard','unknown'))
);

-- place_photos — métadonnées des photos (fichiers dans Storage, bucket privé)
create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  storage_path text not null,
  alt text not null default '' check (char_length(alt) <= 200),
  author_id uuid not null default auth.uid() references auth.users (id),
  status public.publication_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index place_photos_place_idx on public.place_photos (place_id);

-- place_revisions — propositions de modification (jamais d'édition directe d'autrui)
create table public.place_revisions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  payload jsonb not null,
  note text not null default '' check (char_length(note) <= 1000),
  author_id uuid not null default auth.uid() references auth.users (id),
  status public.publication_status not null default 'pending',
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index place_revisions_place_idx on public.place_revisions (place_id);

-- ---------------------------------------------------------------------------
-- reviews — retours d'expérience structurés
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id),
  visited_on date not null check (visited_on <= current_date),
  -- Tranches d'âge ANONYMES — jamais de données nominatives sur les enfants.
  age_brackets text[] not null default '{}',
  rating int not null check (rating between 1 and 5),
  positives text not null default '' check (char_length(positives) <= 1000),
  watchouts text not null default '' check (char_length(watchouts) <= 1000),
  accessibility_notes text not null default '' check (char_length(accessibility_notes) <= 500),
  crowd_level text not null default 'unknown' check (crowd_level in ('quiet','moderate','busy','unknown')),
  value_for_money text not null default 'unknown' check (value_for_money in ('good','fair','poor','unknown')),
  practical_tips text not null default '' check (char_length(practical_tips) <= 1000),
  status public.publication_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Un seul retour par membre, par lieu et par date de visite (anti-spam).
  constraint one_review_per_visit unique (place_id, author_id, visited_on)
);
create index reviews_place_idx on public.reviews (place_id) where deleted_at is null;

create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  storage_path text not null,
  alt text not null default '' check (char_length(alt) <= 200),
  status public.publication_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events — agenda
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '' check (char_length(description) <= 4000),
  category_id uuid not null references public.categories (id),
  organizer text not null default '' check (char_length(organizer) <= 120),
  place_id uuid references public.places (id) on delete set null,
  address text not null default '' check (char_length(address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Paris',
  all_day boolean not null default false,
  recurrence jsonb,
  registration_deadline timestamptz,
  price_kind text not null default 'unknown' check (price_kind in ('free','paid','unknown')),
  price_min_euros numeric(8,2) check (price_min_euros >= 0),
  price_max_euros numeric(8,2) check (price_max_euros >= 0),
  age_min int check (age_min between 0 and 18),
  age_max int check (age_max between 0 and 18),
  capacity int check (capacity > 0),
  website_url text check (website_url ~* '^https?://'),
  booking_info text not null default '' check (char_length(booking_info) <= 500),
  contact text not null default '' check (char_length(contact) <= 200),
  accessibility text not null default '' check (char_length(accessibility) <= 500),
  indoor text not null default 'unknown' check (indoor in ('indoor','outdoor','mixed','unknown')),
  status public.event_status not null default 'proposed',
  author_id uuid not null default auth.uid() references auth.users (id),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint event_dates_coherent check (ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at) where deleted_at is null;
create index events_place_idx on public.events (place_id);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- ---------------------------------------------------------------------------
-- reports & moderation
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('place','event','review','photo')),
  target_id uuid not null,
  reason text not null check (reason in ('incorrect','duplicate','inappropriate','closed','privacy','other')),
  details text not null default '' check (char_length(details) <= 1000),
  reporter_id uuid not null default auth.uid() references auth.users (id),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);
create index reports_open_idx on public.reports (status) where status = 'open';

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null default auth.uid() references auth.users (id),
  target_type text not null check (target_type in ('place','event','review','photo')),
  target_id uuid not null,
  decision text not null check (decision in
    ('approve','hide','reject','mark-duplicate','fix-category','dismiss-report')),
  reason text not null default '' check (char_length(reason) <= 1000),
  related_report_id uuid references public.reports (id),
  created_at timestamptz not null default now()
);

-- audit_logs — journal d'administration (append-only)
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id),
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Horodatage automatique + retour en validation après modification
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Une modification par l'auteur repasse le contenu en validation ; seule la
-- modération peut poser published/hidden/rejected.
create or replace function public.reset_place_status_on_author_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    new.status := 'pending';
    new.author_id := old.author_id;      -- l'auteur ne change jamais
    new.last_verified_at := old.last_verified_at;
  end if;
  return new;
end;
$$;
create trigger places_reset_status before update on public.places
  for each row execute function public.reset_place_status_on_author_update();

create or replace function public.force_place_defaults_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    new.status := 'pending';             -- le client ne choisit pas son statut
    new.last_verified_at := null;
  end if;
  new.author_id := auth.uid();
  return new;
end;
$$;
create trigger places_force_defaults before insert on public.places
  for each row execute function public.force_place_defaults_on_insert();

-- ---------------------------------------------------------------------------
-- Row Level Security — politiques explicites par table et par opération
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.places enable row level security;
alter table public.place_features enable row level security;
alter table public.place_photos enable row level security;
alter table public.place_revisions enable row level security;
alter table public.reviews enable row level security;
alter table public.review_photos enable row level security;
alter table public.events enable row level security;
alter table public.favorites enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs enable row level security;

-- profiles : lecture publique (pseudonyme), écriture par le propriétaire.
create policy "profiles_select_all" on public.profiles
  for select using (true);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- user_roles : lisible par soi et par la modération ; géré par l'admin.
create policy "user_roles_select_own_or_mod" on public.user_roles
  for select using (auth.uid() = user_id or public.is_moderator());
create policy "user_roles_admin_all" on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- categories : lecture publique ; gestion admin.
create policy "categories_select_all" on public.categories
  for select using (true);
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- places : le public voit le publié ; l'auteur voit et modifie les siens ;
-- la modération voit et modifie tout.
create policy "places_select_public" on public.places
  for select using (
    (status = 'published' and deleted_at is null)
    or author_id = auth.uid()
    or public.is_moderator()
  );
create policy "places_insert_authenticated" on public.places
  for insert with check (auth.uid() is not null);
create policy "places_update_own_or_mod" on public.places
  for update using (author_id = auth.uid() or public.is_moderator());
-- Pas de DELETE : suppression logique via la modération (deleted_at).

-- place_features : suit la visibilité du lieu.
create policy "place_features_select" on public.place_features
  for select using (exists (
    select 1 from public.places p where p.id = place_id
  ));
create policy "place_features_write_owner_or_mod" on public.place_features
  for all using (exists (
    select 1 from public.places p
    where p.id = place_id and (p.author_id = auth.uid() or public.is_moderator())
  )) with check (exists (
    select 1 from public.places p
    where p.id = place_id and (p.author_id = auth.uid() or public.is_moderator())
  ));

-- place_photos / review_photos : publiées visibles, dépôt par membres.
create policy "place_photos_select" on public.place_photos
  for select using (status = 'published' or author_id = auth.uid() or public.is_moderator());
create policy "place_photos_insert" on public.place_photos
  for insert with check (auth.uid() is not null);
create policy "review_photos_select" on public.review_photos
  for select using (status = 'published' or public.is_moderator());
create policy "review_photos_insert" on public.review_photos
  for insert with check (auth.uid() is not null);

-- place_revisions : proposables par tout membre, traitées par la modération.
create policy "place_revisions_insert" on public.place_revisions
  for insert with check (auth.uid() is not null);
create policy "place_revisions_select_own_or_mod" on public.place_revisions
  for select using (author_id = auth.uid() or public.is_moderator());
create policy "place_revisions_update_mod" on public.place_revisions
  for update using (public.is_moderator());

-- reviews : publiés visibles ; l'auteur gère les siens.
create policy "reviews_select_public" on public.reviews
  for select using (
    (status = 'published' and deleted_at is null)
    or author_id = auth.uid()
    or public.is_moderator()
  );
create policy "reviews_insert_authenticated" on public.reviews
  for insert with check (auth.uid() is not null);
create policy "reviews_update_own_or_mod" on public.reviews
  for update using (author_id = auth.uid() or public.is_moderator());

-- events : mêmes principes que places.
create policy "events_select_public" on public.events
  for select using (
    (status in ('published','cancelled') and deleted_at is null)
    or author_id = auth.uid()
    or public.is_moderator()
  );
create policy "events_insert_authenticated" on public.events
  for insert with check (auth.uid() is not null);
create policy "events_update_own_or_mod" on public.events
  for update using (author_id = auth.uid() or public.is_moderator());

-- favorites : strictement privés.
create policy "favorites_own" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reports : dépôt par membres ; lecture par l'auteur du signalement et la
-- modération ; traitement par la modération.
create policy "reports_insert_authenticated" on public.reports
  for insert with check (auth.uid() is not null);
create policy "reports_select_own_or_mod" on public.reports
  for select using (reporter_id = auth.uid() or public.is_moderator());
create policy "reports_update_mod" on public.reports
  for update using (public.is_moderator());

-- moderation_actions : écrites et lues par la modération (historique).
create policy "moderation_actions_mod" on public.moderation_actions
  for all using (public.is_moderator()) with check (public.is_moderator());

-- audit_logs : lecture admin uniquement ; écriture via fonctions serveur.
create policy "audit_logs_admin_select" on public.audit_logs
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed des catégories initiales (id stables non requis : slug = clé métier)
-- ---------------------------------------------------------------------------
insert into public.categories (slug, label, icon, sort_order) values
  ('parc', 'Parc', 'Trees', 0),
  ('aire-de-jeux', 'Aire de jeux', 'ToyBrick', 1),
  ('balade', 'Balade', 'Footprints', 2),
  ('randonnee-familiale', 'Randonnée familiale', 'Mountain', 3),
  ('activite-sportive', 'Activité sportive', 'Bike', 4),
  ('activite-culturelle', 'Activité culturelle', 'Palette', 5),
  ('musee', 'Musée', 'Landmark', 6),
  ('ferme-pedagogique', 'Ferme pédagogique', 'Tractor', 7),
  ('baignade', 'Baignade', 'Waves', 8),
  ('pique-nique', 'Pique-nique', 'Apple', 9),
  ('restaurant-familial', 'Restaurant adapté aux familles', 'UtensilsCrossed', 10),
  ('evenement-ponctuel', 'Événement ponctuel', 'CalendarDays', 11),
  ('autre', 'Autre activité familiale', 'Sparkles', 12);
