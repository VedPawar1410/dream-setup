import type { SupabaseClient } from '@supabase/supabase-js'
import { metaOf, type RoomBackend, type SaveRecord } from '../persistence/saves'

type Row = { id: string; name: string; doc: SaveRecord['doc']; thumbnail: string | null; created_at: string; updated_at: string; share_token: string | null }

const fromRow = (r: Row): SaveRecord => ({
  id: r.id,
  name: r.name,
  doc: r.doc,
  thumbnail: r.thumbnail,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
  shareToken: r.share_token,
})

/**
 * Rooms in your account: the `rooms` table. No owner filter is needed in any query:
 * row-level security already limits every read and write to the signed-in user's rows.
 */
export function cloudRooms(sb: SupabaseClient): RoomBackend {
  const check = <T>({ data, error }: { data: T; error: unknown }) => {
    if (error) throw error
    return data
  }
  return {
    kind: 'cloud',
    async list() {
      const rows = check(await sb.from('rooms').select('id, name, thumbnail, created_at, updated_at, share_token').order('updated_at', { ascending: false }))
      return (rows as Omit<Row, 'doc'>[]).map((r) => metaOf(fromRow({ ...r, doc: null as never })))
    },
    async get(id) {
      const row = check(await sb.from('rooms').select('*').eq('id', id).maybeSingle())
      return row ? fromRow(row as Row) : undefined
    },
    // The share token is never written here, so saving can't accidentally revoke a link
    async put(rec) {
      check(
        await sb.from('rooms').upsert({
          id: rec.id,
          name: rec.name,
          doc: rec.doc,
          thumbnail: rec.thumbnail,
          created_at: new Date(rec.createdAt).toISOString(),
          updated_at: new Date(rec.updatedAt).toISOString(),
        }),
      )
    },
    async remove(id) {
      check(await sb.from('rooms').delete().eq('id', id))
    },
  }
}
