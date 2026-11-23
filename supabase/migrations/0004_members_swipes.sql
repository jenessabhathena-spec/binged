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
