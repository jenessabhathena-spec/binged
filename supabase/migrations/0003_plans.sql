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
