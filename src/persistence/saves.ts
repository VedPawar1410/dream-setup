import { openDB, type DBSchema } from 'idb'
import { create } from 'zustand'
import { playRoomSwap } from '../anim/intro'
import { resetView } from '../scene/camera'
import { clearHistory } from '../store/history'
import { defaultRoom, useRoom, type RoomDoc } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { migrate, parseRoomFile, type RoomFile } from './migrate'

// Rooms are saved automatically a moment after you stop changing things. Where they go
// depends on who you are: guests keep them in this browser (IndexedDB); signed in, they
// live in your account (Supabase). Both sit behind the same four-call interface, so
// everything below works the same either way. Export/import still moves single rooms.

export type SaveRecord = { id: string; name: string; doc: RoomDoc; thumbnail: string | null; createdAt: number; updatedAt: number }
export type SaveMeta = Omit<SaveRecord, 'doc'>

/** A place rooms are kept. */
export type RoomBackend = {
  kind: 'local' | 'cloud'
  /** Newest first, without the (bigger) room documents. */
  list(): Promise<SaveMeta[]>
  get(id: string): Promise<SaveRecord | undefined>
  put(rec: SaveRecord): Promise<void>
  remove(id: string): Promise<void>
}

interface Schema extends DBSchema {
  rooms: { key: string; value: SaveRecord; indexes: { updatedAt: number } }
}

let dbPromise: ReturnType<typeof openDB<Schema>> | null = null
const db = () =>
  (dbPromise ??= openDB<Schema>('dream-setup', 1, {
    upgrade(d) {
      d.createObjectStore('rooms', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt')
    },
  }))

/** Guests: this browser's IndexedDB. */
export const localRooms: RoomBackend = {
  kind: 'local',
  list: async () => (await (await db()).getAllFromIndex('rooms', 'updatedAt')).reverse().map(metaOf),
  get: async (id) => (await db()).get('rooms', id),
  put: async (rec) => void (await (await db()).put('rooms', rec)),
  remove: async (id) => (await db()).delete('rooms', id),
}

let backend: RoomBackend = localRooms
/** Whose rooms are open: 'local' for a guest, otherwise the account's user id. */
let scope = 'local'

type SavesState = {
  /** False when the browser blocks storage (some private modes): the app still works, it just can't save. */
  available: boolean
  currentId: string | null
  name: string
  list: SaveMeta[]
  status: 'saved' | 'saving' | 'error'
  /** Where the open rooms are saved. */
  where: 'local' | 'cloud'
}

export const useSaves = create<SavesState>(() => ({ available: false, currentId: null, name: 'My Room', list: [], status: 'saved', where: 'local' }))

// The last open room, remembered per account so switching accounts reopens the right one
const currentKey = () => (scope === 'local' ? 'dream-setup:current' : `dream-setup:current:${scope}`)
const readCurrent = () => {
  try {
    return localStorage.getItem(currentKey())
  } catch {
    return null
  }
}
const writeCurrent = (id: string) => {
  try {
    localStorage.setItem(currentKey(), id)
  } catch {
    // Storage blocked: we'll just open the most recent room next time
  }
}

export const metaOf = ({ doc: _doc, ...meta }: SaveRecord): SaveMeta => meta
const newRecord = (name: string, doc: RoomDoc): SaveRecord => {
  const now = Date.now()
  return { id: crypto.randomUUID(), name, doc, thumbnail: null, createdAt: now, updatedAt: now }
}
const upsertMeta = (meta: SaveMeta) =>
  useSaves.setState((s) => ({ list: [meta, ...s.list.filter((m) => m.id !== meta.id)] }))

// ---------- Thumbnails ----------

let source: HTMLCanvasElement | null = null
/** The WebGL canvas. It's created with preserveDrawingBuffer so its last frame can be read back. */
export const setCaptureSource = (canvas: HTMLCanvasElement) => void (source = canvas)

/** A small JPEG of what's on screen right now (post-processing included, HUD not). */
export function captureThumbnail(width = 360, height = 225): string | null {
  if (!source || !source.width) return null
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  // Cover-crop the centre of the frame into the thumbnail's 16:10 shape
  const scale = Math.max(width / source.width, height / source.height)
  const sw = width / scale
  const sh = height / scale
  out.getContext('2d')!.drawImage(source, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, 0, 0, width, height)
  return out.toDataURL('image/jpeg', 0.78)
}

/** The full-resolution frame as a PNG, for photo mode. */
export const captureFrame = () => (source && source.width ? source.toDataURL('image/png') : null)

// ---------- Boot + autosave ----------

let applying = false // true while we load a room, so loading doesn't count as an edit
let timer: ReturnType<typeof setTimeout> | null = null
let lastThumb = 0

/** The room to open for the current backend: the last one used, else the newest, else a fresh starter room. */
async function loadInitial(): Promise<{ rec: SaveRecord; list: SaveMeta[] }> {
  let list = await backend.list()
  const id = list.find((m) => m.id === readCurrent())?.id ?? list[0]?.id
  let rec = id ? await backend.get(id) : undefined
  if (!rec) {
    rec = newRecord('My Room', defaultRoom)
    await backend.put(rec)
    list = [metaOf(rec), ...list]
  }
  return { rec, list }
}

/**
 * Runs before the first render, so the scene starts with your room rather than the default.
 * `start` picks where rooms live (a signed-in account, or this browser).
 */
export async function bootSaves(start: { backend: RoomBackend; scope: string } = { backend: localRooms, scope: 'local' }) {
  try {
    ;({ backend, scope } = start)
    let initial
    try {
      initial = await loadInitial()
    } catch (err) {
      if (backend === localRooms) throw err
      // The account couldn't be reached (offline?): start with this browser's rooms instead
      console.warn('Could not load your account rooms; using this browser for now', err)
      ;({ backend, scope } = { backend: localRooms, scope: 'local' })
      initial = await loadInitial()
    }
    applying = true
    useRoom.setState({ doc: migrate(initial.rec.doc) })
    applying = false
    clearHistory()
    useSaves.setState({ available: true, currentId: initial.rec.id, name: initial.rec.name, list: initial.list, where: backend.kind })
    writeCurrent(initial.rec.id)
  } catch (err) {
    console.warn('Saving is unavailable in this browser', err)
    useSaves.setState({ available: false })
  }

  useRoom.subscribe((state, prev) => {
    if (state.doc === prev.doc || applying || !useSaves.getState().available) return
    useSaves.setState({ status: 'saving' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void saveNow(), 700) // debounce: one save after a burst of edits
  })
  // Closing or hiding the tab mid-debounce shouldn't lose the last edit
  window.addEventListener('pagehide', () => void flush())
  // Back online after a failed cloud save: try again
  window.addEventListener('online', () => {
    if (useSaves.getState().status === 'error') void saveNow()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

async function saveNow(forceThumb = false) {
  timer = null
  const { currentId, name, list } = useSaves.getState()
  if (!currentId) return
  // The list already knows when this room was made and its last thumbnail, so saving
  // never has to download the room first (that matters over the network)
  const prev = list.find((m) => m.id === currentId)
  try {
    const now = Date.now()
    // Thumbnails are the expensive part, so refresh them at most every 8 seconds
    const fresh = forceThumb || now - lastThumb > 8000 ? captureThumbnail() : null
    if (fresh) lastThumb = now
    const rec: SaveRecord = {
      id: currentId,
      name,
      doc: useRoom.getState().doc,
      thumbnail: fresh ?? prev?.thumbnail ?? null,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    }
    await backend.put(rec)
    upsertMeta(metaOf(rec))
    useSaves.setState({ status: 'saved' })
  } catch (err) {
    console.error('Autosave failed', err)
    useSaves.setState({ status: 'error' })
  }
}

/** Save any pending change immediately. */
export async function flush() {
  if (timer) {
    clearTimeout(timer)
    await saveNow()
  }
}

/** Refresh the current room's thumbnail (e.g. when opening the rooms panel). */
export const refreshCurrentThumbnail = () => (useSaves.getState().available ? saveNow(true) : Promise.resolve())

// ---------- Room management ----------

function apply(rec: SaveRecord) {
  useUi.setState({ mode: 'view', selectedId: null, selectedItemId: null, carry: null, ghost: null, carryItem: null })
  applying = true
  useRoom.setState({ doc: migrate(rec.doc) })
  applying = false
  clearHistory()
  useSaves.setState({ currentId: rec.id, name: rec.name })
  writeCurrent(rec.id)
  resetView()
}

export async function openRoom(id: string) {
  if (id === useSaves.getState().currentId) return
  await flush()
  const rec = await backend.get(id)
  if (rec) playRoomSwap(() => apply(rec)) // walls sink, room swaps, new walls rise
}

const uniqueName = (base: string) => {
  const names = new Set(useSaves.getState().list.map((m) => m.name))
  if (!names.has(base)) return base
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`
}

export async function newRoom(kind: 'empty' | 'starter') {
  const doc: RoomDoc = kind === 'empty' ? { ...defaultRoom, items: [] } : defaultRoom
  const rec = newRecord(uniqueName(kind === 'empty' ? 'Empty Room' : 'New Room'), doc)
  await backend.put(rec)
  upsertMeta(metaOf(rec))
  await openRoom(rec.id)
}

export async function renameRoom(id: string, name: string) {
  const clean = name.trim().slice(0, 40)
  const rec = clean ? await backend.get(id) : undefined
  if (!rec) return
  rec.name = clean
  await backend.put(rec)
  upsertMeta(metaOf(rec))
  if (id === useSaves.getState().currentId) useSaves.setState({ name: clean })
}

export async function duplicateRoom(id: string) {
  await flush()
  const rec = await backend.get(id)
  if (!rec) return
  const copy = { ...newRecord(uniqueName(`${rec.name} copy`), rec.doc), thumbnail: rec.thumbnail }
  await backend.put(copy)
  upsertMeta(metaOf(copy))
}

export async function deleteRoom(id: string) {
  const { list, currentId } = useSaves.getState()
  if (list.length <= 1) return // always keep at least one room
  if (id === currentId) await openRoom(list.find((m) => m.id !== id)!.id)
  await backend.remove(id)
  useSaves.setState((s) => ({ list: s.list.filter((m) => m.id !== id) }))
}

// ---------- Files ----------

export async function exportCurrentRoom() {
  await flush()
  const { name } = useSaves.getState()
  const file: RoomFile = { app: 'dream-setup', version: 1, name, doc: useRoom.getState().doc }
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase() || 'room'}.dreamroom.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Reads a file, validates it, saves it as a new room and opens it. Throws a readable error. */
export async function importRoomFile(file: File) {
  const { name, doc } = parseRoomFile(await file.text(), file.name.replace(/\.(dreamroom\.)?json$/i, ''))
  const rec = newRecord(uniqueName(name), doc)
  await backend.put(rec)
  upsertMeta(metaOf(rec))
  await openRoom(rec.id)
}

// ---------- Switching accounts ----------

/**
 * Signing in or out: save what's pending to where it belongs, then open the other side's
 * rooms with the room-swap animation.
 */
export async function switchBackend(next: RoomBackend, nextScope: string) {
  if (nextScope === scope) return
  await flush()
  backend = next
  scope = nextScope
  const { rec, list } = await loadInitial()
  useSaves.setState({ list, where: next.kind, status: 'saved' })
  playRoomSwap(() => apply(rec))
}

/** Copy this browser's guest rooms into the signed-in account (as new rooms). */
export async function importLocalRooms() {
  if (backend === localRooms) return 0
  const metas = await localRooms.list()
  for (const meta of metas.reverse()) {
    const rec = await localRooms.get(meta.id)
    if (!rec) continue
    const copy: SaveRecord = { ...rec, id: crypto.randomUUID(), name: uniqueName(rec.name) }
    await backend.put(copy)
    upsertMeta(metaOf(copy))
  }
  return metas.length
}

/** How many guest rooms this browser has (to offer bringing them into an account). */
export const countLocalRooms = async () => (await localRooms.list()).length
