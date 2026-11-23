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
