-- Dream Setup v2.3: view-only share links.
--
-- A room is shared by giving it an unguessable token (16 random bytes from the browser).
-- The rooms table stays owner-only: strangers never get read access to it. Instead they
-- can call one narrow function that returns a single shared room by its token.
-- "Stop sharing" sets the token back to null, and every old link stops working.

alter table public.rooms
  add column share_token text unique
  check (share_token is null or char_length(share_token) >= 20);

create function public.get_shared_room(token text)
returns table (name text, doc jsonb, owner_username text, updated_at timestamptz)
language sql
security definer set search_path = ''
stable
as $$
  select r.name, r.doc, p.username, r.updated_at
  from public.rooms r
  join public.profiles p on p.id = r.owner
  where r.share_token = token;
$$;

revoke execute on function public.get_shared_room(text) from public;
grant execute on function public.get_shared_room(text) to anon, authenticated;
