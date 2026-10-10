-- Fixes from Supabase's security/performance advisor after 001.

-- The sign-up trigger function must never be callable through the API
-- (triggers still fire: they don't go through EXECUTE permissions).
-- username_available() stays callable on purpose: sign-up checks a name before the account exists.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Wrapping auth.uid() in a sub-select lets Postgres evaluate it once per query instead of once per row
drop policy "own rooms: read" on public.rooms;
drop policy "own rooms: create" on public.rooms;
drop policy "own rooms: update" on public.rooms;
drop policy "own rooms: delete" on public.rooms;
create policy "own rooms: read" on public.rooms
  for select using (owner = (select auth.uid()));
create policy "own rooms: create" on public.rooms
  for insert with check (owner = (select auth.uid()));
create policy "own rooms: update" on public.rooms
  for update using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own rooms: delete" on public.rooms
  for delete using (owner = (select auth.uid()));
