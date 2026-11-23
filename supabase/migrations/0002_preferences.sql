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
