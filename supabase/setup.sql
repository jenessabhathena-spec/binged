-- Binged: the whole database in one paste. Supabase dashboard > SQL Editor > New query > paste all of this > Run.
-- It is the four migrations in supabase/migrations joined in order (a test keeps the two in sync). Safe to run twice.

-- ===== 0001_users.sql =====
-- M1: users (SPEC §6). Run in the Supabase SQL editor, or with the Supabase CLI: supabase db push.
-- One row per signed-in person, keyed to Supabase Auth. Created automatically on first Google sign-in.
-- No street address column exists, by design (SPEC §2.2): an area name and a map pin only.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  name text,
  avatar_url text,
  home_area_name text,
  home_lat double precision,
  home_lng double precision,
  work_area_name text,
  work_lat double precision,
  work_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_pin_complete check ((home_lat is null) = (home_lng is null)),
  constraint work_pin_complete check ((work_lat is null) = (work_lng is null)),
  constraint home_in_bengaluru check (home_lat is null or (home_lat between 12.7 and 13.3 and home_lng between 77.3 and 77.9)),
  constraint work_in_bengaluru check (work_lat is null or (work_lat between 12.7 and 13.3 and work_lng between 77.3 and 77.9))
);

alter table public.users enable row level security;

-- A person can read and update only their own row. Other members never read this table directly;
-- plan screens use a public view (added in M4) without locations.
drop policy if exists "users read own row" on public.users;
create policy "users read own row" on public.users for select using (auth.uid() = id);

drop policy if exists "users update own row" on public.users;
create policy "users update own row" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

-- No insert or delete policy for clients: rows are created by the trigger below and deleted with the auth user.

-- On first sign-in, copy name, email and photo from the Google profile (SPEC S1).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();

-- ===== 0002_preferences.sql =====
-- M2: preferences (SPEC §6). Run in the Supabase SQL editor after 0001_users.sql.
-- One row per person. budget_per_person is PRIVATE: only its owner can read it, and no view or policy exposes
-- it to anyone else. Plan screens never select from this table (M4 adds a public view without it).

create table if not exists public.preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  cuisines text[] not null default '{}',
  diet text check (diet in ('Veg', 'Non-veg', 'Jain', 'Vegan', 'Eggetarian')),
  spice text check (spice in ('Mild', 'Medium', 'Hot')),
  budget_per_person integer check (budget_per_person between 200 and 4000),
  vibes text[] not null default '{}',
  dealbreakers text[] not null default '{}',
  max_travel_min integer not null default 40 check (max_travel_min in (15, 20, 30, 40, 50, 60)),
  updated_at timestamptz not null default now(),
  constraint dealbreakers_known check (dealbreakers <@ array['must_have_veg', 'no_alcohol', 'needs_parking', 'wheelchair_access'])
);

alter table public.preferences enable row level security;

-- Own row only, for every operation. Nobody else, including other members of the same plan, can read it.
drop policy if exists "preferences read own" on public.preferences;
create policy "preferences read own" on public.preferences for select using (auth.uid() = user_id);

drop policy if exists "preferences insert own" on public.preferences;
create policy "preferences insert own" on public.preferences for insert with check (auth.uid() = user_id);

drop policy if exists "preferences update own" on public.preferences;
create policy "preferences update own" on public.preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "preferences delete own" on public.preferences;
create policy "preferences delete own" on public.preferences for delete using (auth.uid() = user_id);

drop trigger if exists preferences_touch on public.preferences;
create trigger preferences_touch before update on public.preferences
  for each row execute function public.touch_updated_at();

-- ===== 0003_plans.sql =====
-- M3: plans (SPEC §6). Run in the Supabase SQL editor after 0001 and 0002.
-- The organiser reads and manages their own plans through Row Level Security. There is deliberately NO policy
-- that lets anyone else read this table: invite links are resolved by server code with the service role, which
-- returns only the public fields (plan name, start time, organiser's first name, party size).
-- The plan_members table (organiser + friends) arrives with M4.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.users (id) on delete cascade,
  organiser_first_name text not null,
  name text not null check (char_length(name) between 1 and 50),
  starts_at timestamptz not null,
  search_mode text not null check (search_mode in ('anywhere_fair', 'area')),
  search_area_name text,
  search_lat double precision,
  search_lng double precision,
  party_size integer not null check (party_size between 2 and 8),
  deadline_at timestamptz not null,
  status text not null default 'collecting' check (status in ('collecting', 'organiser_swiping', 'group_swiping', 'decided', 'closed')),
  invite_code text not null unique check (invite_code ~ '^[A-Za-z0-9_-]{11}$'),
  winner_place_id text,
  created_at timestamptz not null default now(),
  constraint search_area_matches_mode check (
    (search_mode = 'area' and search_area_name is not null and search_lat is not null and search_lng is not null)
    or (search_mode = 'anywhere_fair' and search_area_name is null and search_lat is null and search_lng is null)
  ),
  constraint search_in_bengaluru check (search_lat is null or (search_lat between 12.7 and 13.3 and search_lng between 77.3 and 77.9)),
  constraint deadline_before_start check (deadline_at < starts_at)
);

create index if not exists plans_organiser_idx on public.plans (organiser_id, starts_at);

alter table public.plans enable row level security;

drop policy if exists "plans organiser read" on public.plans;
create policy "plans organiser read" on public.plans for select using (auth.uid() = organiser_id);

drop policy if exists "plans organiser insert" on public.plans;
create policy "plans organiser insert" on public.plans for insert with check (auth.uid() = organiser_id and status = 'collecting');

drop policy if exists "plans organiser update" on public.plans;
create policy "plans organiser update" on public.plans for update using (auth.uid() = organiser_id) with check (auth.uid() = organiser_id);

-- No delete policy for clients. Plans disappear with their organiser (on delete cascade).

-- ===== 0004_members_swipes.sql =====
-- M4-M8: plan members, their private answers, swipes and tie-break votes (SPEC §6). Run in the Supabase SQL
-- editor after 0001-0003.
--
-- PRIVACY MODEL
--  * Guests have no account, so the server (service role) does all reading and writing for plan members, after
--    checking the guest's secret cookie or the signed-in user. See src/lib/group.ts and src/lib/group-store.ts.
--  * Row Level Security is ON for every table and there is NO policy that lets a browser holding only the public
--    anon key read other people's rows. Because an authenticated browser can call the database directly, the
--    policies below are written so that even then nobody can read another member's budget or start area.
--  * A member's private answers (start area, BUDGET, dealbreakers, ...) live in plan_member_private, readable
--    only by the signed-in account that owns that member row. The organiser can NOT read them either.

alter table public.plans
  add column if not exists pool jsonb,                       -- the deck + reserve (never holds budgets)
  add column if not exists picking_started_at timestamptz,
  add column if not exists voting_closed_at timestamptz,
  add column if not exists tiebreak jsonb,
  add column if not exists winner_via text check (winner_via in ('full_match', 'only_option', 'tiebreak', 'organiser'));

create table if not exists public.plan_members (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid references public.users (id) on delete cascade,   -- null for a guest who joined with just a first name
  first_name text not null check (char_length(first_name) between 1 and 30),
  role text not null default 'member' check (role in ('organiser', 'member')),
  joined_at timestamptz not null default now(),
  answered_at timestamptz,
  token text not null,                                           -- a guest's secret (kept in their cookie); never exposed
  unique (plan_id, user_id)
);
create index if not exists plan_members_plan_idx on public.plan_members (plan_id);

create table if not exists public.plan_member_private (
  member_id uuid primary key references public.plan_members (id) on delete cascade,
  start_name text not null,
  start_lat double precision not null check (start_lat between 12.7 and 13.3),
  start_lng double precision not null check (start_lng between 77.3 and 77.9),
  budget integer check (budget is null or budget between 200 and 4000),
  cuisines text[] not null default '{}',
  diet text,
  spice text,
  vibes text[] not null default '{}',
  dealbreakers text[] not null default '{}',
  max_travel_min integer not null default 40 check (max_travel_min between 10 and 120)
);

create table if not exists public.swipes (
  plan_id uuid not null references public.plans (id) on delete cascade,
  member_id uuid not null references public.plan_members (id) on delete cascade,
  place_id text not null,
  liked boolean not null,
  at timestamptz not null default now(),
  primary key (member_id, place_id)
);
create index if not exists swipes_plan_idx on public.swipes (plan_id);

create table if not exists public.tiebreak_votes (
  plan_id uuid not null references public.plans (id) on delete cascade,
  member_id uuid not null references public.plan_members (id) on delete cascade,
  place_id text not null,
  primary key (plan_id, member_id)
);

alter table public.plan_members enable row level security;
alter table public.plan_member_private enable row level security;
alter table public.swipes enable row level security;
alter table public.tiebreak_votes enable row level security;

-- A signed-in person may see only their OWN member row (never the token of anyone else, never other members).
drop policy if exists "member reads own row" on public.plan_members;
create policy "member reads own row" on public.plan_members for select using (auth.uid() = user_id);

-- Private answers: the owner only. Not the organiser, not other members.
drop policy if exists "member reads own private answers" on public.plan_member_private;
create policy "member reads own private answers" on public.plan_member_private for select using (
  exists (select 1 from public.plan_members m where m.id = member_id and m.user_id = auth.uid())
);

-- Swipes stay hidden until results: no client policy at all. Only the server (service role) reads and writes them.
-- tiebreak_votes: same.

-- MANUAL RLS TEST (run as two different signed-in users A and B who are members of the same plan):
--   select * from plan_member_private;      -- as A: returns exactly A's row; B's budget is not visible
--   select * from plan_members;             -- as A: returns exactly A's row
--   select * from swipes;                   -- as A: returns zero rows
-- With only the anon key (signed out) all four tables return zero rows.
