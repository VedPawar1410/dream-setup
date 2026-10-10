import { migrate } from '../persistence/migrate'
import { localRooms, newRecord, rememberCurrent, useSaves } from '../persistence/saves'
import { defaultRoom, useRoom } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { startingBackend } from './auth'
import { supabase } from './supabase'

// View-only share links. A shared room has a random token; the link carries it as ?s=…
// Opening a link loads that one room read-only. Nothing about it touches your own saves.

const siteUrl = () => location.origin + import.meta.env.BASE_URL

export const shareUrl = (token: string) => `${siteUrl()}?s=${token}`

/** The share token in this page's URL, if it was opened from a link. */
export const sharedTokenInUrl = () => new URLSearchParams(location.search).get('s')

/** 16 random bytes as URL-safe base64: 22 characters, about 10^38 possibilities. Unguessable. */
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Turn a room's link on (a fresh token), give it a new one (old links stop working), or
 * turn it off. Plain update: row-level security already ensures it's your room.
 */
export async function setSharing(roomId: string, share: boolean) {
  const token = share ? newToken() : null
  const sb = await supabase()
  const { error } = await sb.from('rooms').update({ share_token: token }).eq('id', roomId)
  if (error) throw new Error("Couldn't update the link. Are you online?")
  useSaves.setState((s) => ({ list: s.list.map((m) => (m.id === roomId ? { ...m, shareToken: token } : m)) }))
  return token
}

let shared: { name: string; owner: string } | null = null

/** Instead of your own rooms: load the room behind a share link, view-only. */
export async function bootShared(token: string) {
  let row: { name: string; doc: unknown; owner_username: string } | undefined
  try {
    const sb = await supabase()
    const { data, error } = await sb.rpc('get_shared_room', { token })
    if (!error) row = data?.[0]
  } catch {
    // offline or no backend: treated like a dead link
  }
  if (!row) {
    useRoom.setState({ doc: { ...defaultRoom, items: [] } })
    useUi.setState({ viewing: { missing: true } })
    return
  }
  shared = { name: row.name, owner: row.owner_username }
  useRoom.setState({ doc: migrate(row.doc) })
  useUi.setState({ viewing: shared })
  useSaves.setState({ name: row.name, available: false })
}

/**
 * "Save a copy": the room goes into your own rooms (your account if you're signed in on
 * this browser, otherwise this browser), then the app reopens on it.
 */
export async function saveSharedCopy() {
  if (!shared) return
  const start = await startingBackend()
  const backend = start?.backend ?? localRooms
  const rec = newRecord(`${shared.name} (from ${shared.owner})`.slice(0, 40), useRoom.getState().doc)
  await backend.put(rec)
  rememberCurrent(start?.scope ?? 'local', rec.id)
  location.href = siteUrl()
}

/** Leave the shared room for your own rooms. */
export const leaveShared = () => void (location.href = siteUrl())
