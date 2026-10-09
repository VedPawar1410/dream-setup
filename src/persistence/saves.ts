import { openDB, type DBSchema } from 'idb'
import { create } from 'zustand'
import { playRoomSwap } from '../anim/intro'
import { resetView } from '../scene/camera'
import { defaultRoom, useRoom, type RoomDoc } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { migrate, parseRoomFile, type RoomFile } from './migrate'

// Rooms live in IndexedDB: one record per room, saved automatically a moment after you
// stop changing things. No server: everything stays in this browser, and export/import
// moves a room between browsers as a JSON file.

export type SaveRecord = { id: string; name: string; doc: RoomDoc; thumbnail: string | null; createdAt: number; updatedAt: number }
export type SaveMeta = Omit<SaveRecord, 'doc'>

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

type SavesState = {
  /** False when the browser blocks storage (some private modes): the app still works, it just can't save. */
  available: boolean
  currentId: string | null
  name: string
  list: SaveMeta[]
  status: 'saved' | 'saving' | 'error'
}

export const useSaves = create<SavesState>(() => ({ available: false, currentId: null, name: 'My Room', list: [], status: 'saved' }))

const CURRENT_KEY = 'dream-setup:current'
const readCurrent = () => {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}
const writeCurrent = (id: string) => {
  try {
    localStorage.setItem(CURRENT_KEY, id)
  } catch {
    // Storage blocked: we'll just open the most recent room next time
  }
}

const metaOf = ({ doc: _doc, ...meta }: SaveRecord): SaveMeta => meta
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

// ---------- Boot + autosave ----------

let applying = false // true while we load a room, so loading doesn't count as an edit
let timer: ReturnType<typeof setTimeout> | null = null
let lastThumb = 0

/** Runs before the first render, so the scene starts with your room rather than the default. */
export async function bootSaves() {
  try {
    const all = await (await db()).getAllFromIndex('rooms', 'updatedAt') // oldest → newest
    let rec = all.find((r) => r.id === readCurrent()) ?? all.at(-1)
    if (!rec) {
      rec = newRecord('My Room', defaultRoom)
      await (await db()).put('rooms', rec)
      all.push(rec)
    }
    applying = true
    useRoom.setState({ doc: migrate(rec.doc) })
    applying = false
    useSaves.setState({ available: true, currentId: rec.id, name: rec.name, list: all.map(metaOf).reverse() })
    writeCurrent(rec.id)
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

async function saveNow(forceThumb = false) {
  timer = null
  const { currentId, name } = useSaves.getState()
  if (!currentId) return
  try {
    const store = await db()
    const prev = await store.get('rooms', currentId)
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
    await store.put('rooms', rec)
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
  useSaves.setState({ currentId: rec.id, name: rec.name })
  writeCurrent(rec.id)
  resetView()
}

export async function openRoom(id: string) {
  if (id === useSaves.getState().currentId) return
  await flush()
  const rec = await (await db()).get('rooms', id)
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
  await (await db()).put('rooms', rec)
  upsertMeta(metaOf(rec))
  await openRoom(rec.id)
}

export async function renameRoom(id: string, name: string) {
  const clean = name.trim().slice(0, 40)
  const store = await db()
  const rec = await store.get('rooms', id)
  if (!clean || !rec) return
  rec.name = clean
  await store.put('rooms', rec)
  upsertMeta(metaOf(rec))
  if (id === useSaves.getState().currentId) useSaves.setState({ name: clean })
}

export async function duplicateRoom(id: string) {
  await flush()
  const store = await db()
  const rec = await store.get('rooms', id)
  if (!rec) return
  const copy = { ...newRecord(uniqueName(`${rec.name} copy`), rec.doc), thumbnail: rec.thumbnail }
  await store.put('rooms', copy)
  upsertMeta(metaOf(copy))
}

export async function deleteRoom(id: string) {
  const { list, currentId } = useSaves.getState()
  if (list.length <= 1) return // always keep at least one room
  if (id === currentId) await openRoom(list.find((m) => m.id !== id)!.id)
  await (await db()).delete('rooms', id)
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
  await (await db()).put('rooms', rec)
  upsertMeta(metaOf(rec))
  await openRoom(rec.id)
}
