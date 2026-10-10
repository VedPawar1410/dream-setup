import { create } from 'zustand'
import { CUSTOM_PREFIX, registerCustom, type CustomDef } from '../catalog/catalog'
import { useAuth } from '../store/authStore'
import { SUPABASE_URL } from './config'
import { supabase } from './supabase'

// Your own uploaded models: a row in custom_items plus a GLB file in the "models"
// storage bucket at {your user id}/{uuid}.glb. Files are publicly readable by their
// unguessable path, so rooms you share can show them; only you can add or remove them.

export type MyItem = { id: string; catalogId: string; name: string; height: number; mount: CustomDef['mount']; path: string; bytes: number }

type Row = { id: string; name: string; height: number; mount: CustomDef['mount']; path: string; bytes: number }

export const MAX_BYTES = 25 * 1024 * 1024

/** Opened from a phone via the "upload from phone" QR code: the page exists to upload. */
export const isUploadPage = () => new URLSearchParams(location.search).has('upload')

/** Your library, newest first. `arrived` is the last one that came in from another device. */
export const useMyItems = create(() => ({ items: [] as MyItem[], loaded: false, arrived: null as MyItem | null }))

const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/models/${path}`

function toItem(r: Row): MyItem {
  const catalogId = CUSTOM_PREFIX + r.id
  registerCustom(catalogId, { name: r.name, url: publicUrl(r.path), height: r.height, mount: r.mount })
  return { ...r, catalogId }
}

let watching: string | null = null

/** Load your library (once per account) and listen for items added from another device. */
export async function syncMyItems() {
  const uid = useAuth.getState().account?.id
  if (!uid || watching === uid) return
  watching = uid
  const sb = await supabase()
  const { data, error } = await sb.from('custom_items').select('id, name, height, mount, path, bytes').order('created_at', { ascending: false })
  if (error) {
    watching = null
    throw new Error("Couldn't load your items. Are you online?")
  }
  useMyItems.setState({ items: (data as Row[]).map(toItem), loaded: true })

  // Realtime: Postgres streams new rows to subscribers. Row-level security still applies,
  // so you only ever hear about your own items
  sb.channel(`my-items:${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'custom_items', filter: `owner=eq.${uid}` }, ({ new: row }) => {
      const item = toItem(row as Row)
      useMyItems.setState((s) => (s.items.some((i) => i.id === item.id) ? s : { items: [item, ...s.items], arrived: item }))
    })
    .subscribe()
}

/** Upload a GLB and add it to your library. Returns the new item's catalog id. */
export async function uploadItem(file: File, details: { name: string; height: number; mount: CustomDef['mount'] }) {
  const uid = useAuth.getState().account?.id
  if (!uid) throw new Error('Sign in to add your own items.')
  if (file.size > MAX_BYTES) throw new Error('That file is over 25 MB. Try exporting the scan at a lower quality.')
  const sb = await supabase()
  const path = `${uid}/${crypto.randomUUID()}.glb`
  const up = await sb.storage.from('models').upload(path, file, { contentType: 'model/gltf-binary', upsert: false })
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`)
  const { data, error } = await sb
    .from('custom_items')
    .insert({ name: details.name.trim().slice(0, 40), height: details.height, mount: details.mount, path, bytes: file.size })
    .select('id, name, height, mount, path, bytes')
    .single()
  if (error) {
    await sb.storage.from('models').remove([path]) // don't leave an orphaned file behind
    throw new Error("Couldn't save the item. Please try again.")
  }
  const item = toItem(data as Row)
  useMyItems.setState((s) => (s.items.some((i) => i.id === item.id) ? s : { items: [item, ...s.items] }))
  return item.catalogId
}

/**
 * Remove an item from your library and delete its file. Rooms that already use it keep
 * the definition but can no longer load the model, so it shows as a placeholder box.
 */
export async function deleteItem(item: MyItem) {
  const sb = await supabase()
  const { error } = await sb.from('custom_items').delete().eq('id', item.id)
  if (error) throw new Error("Couldn't delete it. Are you online?")
  await sb.storage.from('models').remove([item.path])
  useMyItems.setState((s) => ({ items: s.items.filter((i) => i.id !== item.id) }))
}
