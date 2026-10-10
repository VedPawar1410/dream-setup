-- Dream Setup v2.2: accounts and cloud saves.
-- Applied to the dream-setup project as migration 001_accounts (or paste into SQL Editor → Run on a fresh project).
--
-- Security model: the browser talks to the database directly with the public anon key,
-- so every table has row-level security (RLS). Postgres checks each query against the
-- policies below; a signed-in user can only ever touch their own rows.

-- ---------- Profiles: one per account, holds the public username ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Usernames will be shown on shared rooms (v2.3), so they're readable by anyone
create policy "profiles are public" on public.profiles
  for select using (true);

-- Created automatically on sign-up from the username the app passes as user metadata.
-- security definer: it runs as the table owner, since a brand-new user can't insert yet.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The sign-up form checks a username is free before creating the account
create function public.username_available(name text)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;

-- ---------- Rooms: the same records the app keeps in IndexedDB for guests ----------

create table public.rooms (
  id uuid primary key,
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  doc jsonb not null,
  -- A small JPEG data URL (~20 kB). Simpler than file storage at this scale.
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_owner_updated on public.rooms (owner, updated_at desc);

alter table public.rooms enable row level security;

create policy "own rooms: read" on public.rooms
  for select using (owner = auth.uid());
create policy "own rooms: create" on public.rooms
  for insert with check (owner = auth.uid());
create policy "own rooms: update" on public.rooms
  for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rooms: delete" on public.rooms
  for delete using (owner = auth.uid());
