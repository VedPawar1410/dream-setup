-- Dream Setup v2.6: bring your own objects (phone scans as GLB files).
--
-- custom_items: your library of uploaded models (owner-only, like rooms).
-- Storage bucket "models": files live at {user id}/{uuid}.glb. The bucket is public for
-- reading, so shared rooms can load the models, but only by their unguessable path:
-- there's no select policy, so nobody can list the bucket. Only you can upload into or
-- delete from your own folder.

create table public.custom_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  height real not null check (height > 0.02 and height < 4), -- metres, as the user set it
  mount text not null check (mount in ('floor', 'surface', 'wall')),
  path text not null, -- storage path inside the bucket
  bytes integer not null,
  created_at timestamptz not null default now()
);

create index custom_items_owner on public.custom_items (owner, created_at desc);

alter table public.custom_items enable row level security;

create policy "own items: read" on public.custom_items
  for select using (owner = (select auth.uid()));
create policy "own items: create" on public.custom_items
  for insert with check (owner = (select auth.uid()));
create policy "own items: update" on public.custom_items
  for update using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own items: delete" on public.custom_items
  for delete using (owner = (select auth.uid()));

-- Realtime: an upload from your phone appears on your computer straight away
-- (row-level security still applies to what each listener receives)
alter publication supabase_realtime add table public.custom_items;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('models', 'models', true, 26214400, array['model/gltf-binary', 'application/octet-stream']);

create policy "own models: upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own models: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);
