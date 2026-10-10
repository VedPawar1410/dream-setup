import { create } from 'zustand'
import { customDefOf, isCustomId, type CustomDef } from '../catalog/catalog'
import { sizeOfItem } from '../catalog/models'
import type { Weather } from '../scene/atmosphere'
import type { ScreenMode } from '../scene/screens'
import type { FloorMaterial, WallPattern } from '../scene/surfaces'
import { openingHitsWallItems, shellFits, type Scale } from './itemRules'
import { fitShape, RECT, wallsOf, type RoomShape } from './layout'
import { record } from './history'
import { isValidOpening, ROOM } from './rules'

// The whole room is one plain, serialisable document. The 3D scene and the HUD only
// *read* it; the actions below are the only way to change it. That keeps save/load a
// JSON.stringify away, and makes undo a stack of snapshots.

/** A wall's id: north/east/south/west, plus inner-h/inner-v (L-shape) or divider. See layout.ts. */
export type WallSide = string

export type Opening = {
  id: string
  kind: 'window' | 'door'
  wall: WallSide
  /** Centre of the opening along its wall, in metres from the wall's midpoint. */
  offset: number
  width: number
  height: number
  /** Bottom edge above the floor. 0 for doors. */
  sill: number
}

/**
 * A piece of furniture. Items form a tree: something on a desk has the desk as its
 * parent, and its x/z/rot are relative to the desk, so moving the desk carries it along.
 * Height is never stored. It follows from where the item sits (floor, a parent's top
 * surface, the ceiling), so it can't go stale.
 */
export type PlacedItem = {
  id: string
  catalogId: string
  /** Position in the parent's space (room space at the root). Unused for wall items. */
  x: number
  z: number
  /** Yaw in radians, relative to the parent. */
  rot: number
  parentId: string | null
  /** Wall-mounted items: which wall, how far along it (wall-local x), and bottom edge height. */
  wall?: { side: WallSide; along: number; y: number }
  /** Colour overrides by material name ("wood", "carpet"…). Missing slots keep the model's colour. */
  colors?: Record<string, string>
  /** Lamps and electronics: switched off when false (on by default). */
  on?: boolean
  /** Resized: multipliers on the model's width/depth/height. Missing means original size. */
  size?: Scale
  /** What a monitor or TV shows (wallpaper by default). */
  screen?: ScreenMode
}

export type WallFinish = { pattern: WallPattern; color: string }
export type FloorFinish = { material: FloorMaterial; color: string }

export type RoomDoc = {
  version: 1
  shell: {
    width: number // x, metres
    depth: number // z, metres
    height: number
    /** Rectangle (default), L-shape or two rooms. */
    shape?: RoomShape
    /** Finish per wall id. A wall without an entry uses the north wall's finish. */
    walls: Record<WallSide, WallFinish>
    floor: FloorFinish
    openings: Opening[]
  }
  items: PlacedItem[]
  atmosphere: { weather: Weather; rgbCycle: boolean }
  /** Your own uploaded items used in this room, by catalog id: the room carries them, so it renders anywhere. */
  custom?: Record<string, CustomDef>
}

export type Shell = RoomDoc['shell']

export const defaultRoom: RoomDoc = {
  version: 1,
  shell: {
    width: 5,
    depth: 4,
    height: 2.6,
    walls: {
      north: { pattern: 'paint', color: '#efe6dc' },
      east: { pattern: 'paint', color: '#efe6dc' },
      south: { pattern: 'paint', color: '#efe6dc' },
      west: { pattern: 'paint', color: '#efe6dc' },
    },
    floor: { material: 'planks', color: '#c8956a' },
    openings: [
      { id: 'win-1', kind: 'window', wall: 'north', offset: 0.7, width: 1.5, height: 1.3, sill: 0.85 },
      { id: 'door-1', kind: 'door', wall: 'west', offset: 0.9, width: 0.9, height: 2.1, sill: 0 },
    ],
  },
  // A starter setup so the room isn't empty on first load
  items: [
    { id: 'rug-1', catalogId: 'rugRectangle', x: 0.2, z: 0.35, rot: 0, parentId: null },
    { id: 'desk-1', catalogId: 'desk', x: 0.7, z: -1.62, rot: 0, parentId: null },
    { id: 'mat-1', catalogId: 'deskMat', x: 0, z: 0.12, rot: 0, parentId: 'desk-1' },
    { id: 'monitor-1', catalogId: 'monitorWide', x: 0, z: -0.17, rot: 0, parentId: 'desk-1' },
    { id: 'keyboard-1', catalogId: 'computerKeyboard', x: -0.05, z: 0, rot: 0, parentId: 'mat-1' },
    { id: 'mouse-1', catalogId: 'computerMouse', x: 0.28, z: 0, rot: 0, parentId: 'mat-1' },
    { id: 'lamp-1', catalogId: 'lampRoundTable', x: -0.55, z: -0.15, rot: 0, parentId: 'desk-1' },
    { id: 'chair-1', catalogId: 'chairDesk', x: 0.7, z: -0.85, rot: Math.PI, parentId: null },
    { id: 'pc-1', catalogId: 'pcTower', x: 1.75, z: -1.75, rot: 0, parentId: null },
    { id: 'bed-1', catalogId: 'bedSingle', x: -1.9, z: 0.9, rot: 0, parentId: null },
    { id: 'plant-1', catalogId: 'pottedPlant', x: 2.25, z: -1.75, rot: 0, parentId: null },
    { id: 'shelf-1', catalogId: 'wallShelf', x: 0, z: 0, rot: 0, parentId: null, wall: { side: 'north', along: -1.4, y: 1.45 } },
    { id: 'books-1', catalogId: 'books', x: -0.15, z: 0, rot: 0, parentId: 'shelf-1' },
    { id: 'succulent-1', catalogId: 'plantSmall2', x: 0.22, z: 0, rot: 0, parentId: 'shelf-1' },
    { id: 'poster-1', catalogId: 'posterSunset', x: 0, z: 0, rot: 0, parentId: null, wall: { side: 'west', along: -0.85, y: 1.15 } },
    { id: 'led-1', catalogId: 'ledStrip', x: 0, z: 0, rot: 0, parentId: null, wall: { side: 'north', along: 0.7, y: 2.3 } },
  ],
  atmosphere: { weather: 'sunny', rgbCycle: false },
}

const sizeOf = sizeOfItem

type SizePatch = Partial<Pick<Shell, 'width' | 'depth' | 'height' | 'shape'>>

/** Interpolate between two shells of the same shape kind (null if the kinds differ). */
function blendShells(a: Shell, b: Shell): ((k: number) => Shell) | null {
  const sa = a.shape ?? RECT
  const sb = b.shape ?? RECT
  const l = (x: number, y: number, k: number) => x + (y - x) * k
  let shape: (k: number) => RoomShape
  if (sa.kind === 'rect' && sb.kind === 'rect') shape = () => RECT
  else if (sa.kind === 'l' && sb.kind === 'l' && sa.corner === sb.corner) shape = (k) => ({ ...sb, cutW: l(sa.cutW, sb.cutW, k), cutD: l(sa.cutD, sb.cutD, k) })
  else if (sa.kind === 'split' && sb.kind === 'split') shape = (k) => ({ kind: 'split', at: l(sa.at, sb.at, k) })
  else return null
  return (k) => ({ ...b, width: l(a.width, b.width, k), depth: l(a.depth, b.depth, k), height: l(a.height, b.height, k), shape: shape(k) })
}

type RoomState = {
  doc: RoomDoc
  /**
   * Change the room's size or shape. If the result wouldn't fit everything in it, a drag
   * stops at the last size that does; a shape switch is refused. Returns whether it applied fully.
   */
  resize: (patch: SizePatch) => boolean
  /** Returns false (and changes nothing) if the opening doesn't fit. */
  addOpening: (o: Opening) => boolean
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id' | 'kind'>>) => boolean
  removeOpening: (id: string) => void
  // Item placement is validated by the placement solver before these are called: the
  // checks need model sizes, which only exist once the models have loaded.
  addItem: (item: PlacedItem) => void
  updateItem: (id: string, patch: Partial<Omit<PlacedItem, 'id' | 'catalogId'>>) => void
  /** Removes the item and everything sitting on it. */
  removeItem: (id: string) => void
  setWallFinish: (target: WallSide | 'all', patch: Partial<WallFinish>) => void
  setFloor: (patch: Partial<FloorFinish>) => void
  setWeather: (weather: Weather) => void
  setRgbCycle: (on: boolean) => void
  togglePower: (id: string) => void
}


export const useRoom = create<RoomState>((set, get) => {
  // Always replace, never mutate: Zustand selectors compare by reference, so a new
  // object is what tells React "this changed". Edits pass an undo key (same key in quick
  // succession = one undo step); switching a lamp passes none, so it isn't an undo step.
  const setShell = (shell: Shell, key: string) => {
    record(get().doc, key)
    set({ doc: { ...get().doc, shell } })
  }
  const setItems = (items: PlacedItem[], key: string | null) => {
    if (key) record(get().doc, key)
    set({ doc: { ...get().doc, items } })
  }
  const openingFits = (shell: Shell, o: Opening) => isValidOpening(shell, o) && !openingHitsWallItems(o, get().doc.items, sizeOf)

  return {
    doc: defaultRoom,

    resize: (patch) => {
      const { shell, items } = get().doc
      const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
      const width = c(patch.width ?? shell.width, ROOM.min, ROOM.max)
      const depth = c(patch.depth ?? shell.depth, ROOM.min, ROOM.max)
      const height = c(patch.height ?? shell.height, ROOM.minHeight, ROOM.maxHeight)
      const target: Shell = { ...shell, width, depth, height, shape: fitShape(patch.shape ?? shell.shape ?? RECT, width, depth) }
      const fits = (s: Shell) => shellFits(s, items, sizeOf)
      if (fits(target)) {
        setShell(target, 'resize')
        return true
      }
      // A drag: find the last size on the way that still fits (binary search on the
      // blend), so the wall or handle stops at the furniture instead of jumping back
      const blend = blendShells(shell, target)
      if (!blend) return false // a different shape kind: nothing in between
      let lo = 0
      let hi = 1
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2
        if (fits(blend(mid))) lo = mid
        else hi = mid
      }
      if (lo > 1e-3) setShell(blend(lo), 'resize')
      return false
    },

    addOpening: (o) => {
      const shell = get().doc.shell
      if (!openingFits(shell, o)) return false
      setShell({ ...shell, openings: [...shell.openings, o] }, `add:${o.id}`)
      return true
    },

    updateOpening: (id, patch) => {
      const shell = get().doc.shell
      const current = shell.openings.find((o) => o.id === id)
      if (!current) return false
      const next = { ...current, ...patch }
      if (!openingFits(shell, next)) return false
      setShell({ ...shell, openings: shell.openings.map((o) => (o.id === id ? next : o)) }, `opening:${id}:${Object.keys(patch).join()}`)
      return true
    },

    removeOpening: (id) => {
      const shell = get().doc.shell
      setShell({ ...shell, openings: shell.openings.filter((o) => o.id !== id) }, `remove:${id}`)
    },

    addItem: (item) => {
      // Placing one of your uploads copies its definition into the room
      const doc = get().doc
      const def = isCustomId(item.catalogId) && !doc.custom?.[item.catalogId] ? customDefOf(item.catalogId) : undefined
      record(doc, `add:${item.id}`)
      set({ doc: { ...doc, items: [...doc.items, item], ...(def && { custom: { ...doc.custom, [item.catalogId]: def } }) } })
    },

    updateItem: (id, patch) => setItems(get().doc.items.map((it) => (it.id === id ? { ...it, ...patch } : it)), `item:${id}:${Object.keys(patch).join()}`),

    removeItem: (id) => {
      const items = get().doc.items
      const gone = new Set([id])
      // Walk down the tree: anything resting on a removed item goes too
      for (let grew = true; grew; ) {
        grew = false
        for (const it of items) {
          if (it.parentId && gone.has(it.parentId) && !gone.has(it.id)) {
            gone.add(it.id)
            grew = true
          }
        }
      }
      setItems(items.filter((it) => !gone.has(it.id)), `remove:${id}`)
    },

    setWallFinish: (target, patch) => {
      const shell = get().doc.shell
      const walls = { ...shell.walls }
      const base = walls.north
      for (const side of target === 'all' ? wallsOf(shell).map((w) => w.id) : [target]) walls[side] = { ...(walls[side] ?? base), ...patch }
      setShell({ ...shell, walls }, `walls:${target}:${Object.keys(patch).join()}`)
    },

    setFloor: (patch) => {
      const shell = get().doc.shell
      setShell({ ...shell, floor: { ...shell.floor, ...patch } }, `floor:${Object.keys(patch).join()}`)
    },

    setWeather: (weather) => set({ doc: { ...get().doc, atmosphere: { ...get().doc.atmosphere, weather } } }),

    setRgbCycle: (rgbCycle) => set({ doc: { ...get().doc, atmosphere: { ...get().doc.atmosphere, rgbCycle } } }),

    togglePower: (id) => {
      const item = get().doc.items.find((it) => it.id === id)
      if (item) setItems(get().doc.items.map((it) => (it.id === id ? { ...it, on: item.on === false } : it)), null)
    },
  }
})
