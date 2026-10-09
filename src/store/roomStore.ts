import { create } from 'zustand'
import { itemSizes } from '../catalog/models'
import { itemMinRoom, openingHitsWallItems, type SizeOf } from './itemRules'
import { clampSize, isValidOpening } from './rules'

// The whole room is one plain, serialisable document. The 3D scene and the HUD only
// *read* it; the actions below are the only way to change it. That keeps save/load a
// JSON.stringify away, and makes undo a stack of snapshots.

export type WallSide = 'north' | 'east' | 'south' | 'west'

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
}

export type RoomDoc = {
  version: 1
  shell: {
    width: number // x, metres
    depth: number // z, metres
    height: number
    wallColor: string
    floorColor: string
    openings: Opening[]
  }
  items: PlacedItem[]
}

export type Shell = RoomDoc['shell']

export const defaultRoom: RoomDoc = {
  version: 1,
  shell: {
    width: 5,
    depth: 4,
    height: 2.6,
    wallColor: '#efe6dc',
    floorColor: '#b98a62',
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
  ],
}

const sizeOf: SizeOf = (id) => itemSizes.get(id)

type SizePatch = Partial<Pick<Shell, 'width' | 'depth' | 'height'>>

type RoomState = {
  doc: RoomDoc
  resize: (patch: SizePatch) => void
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
}

export const useRoom = create<RoomState>((set, get) => {
  // Always replace, never mutate: Zustand selectors compare by reference, so a new
  // object is what tells React "this changed".
  const setShell = (shell: Shell) => set({ doc: { ...get().doc, shell } })
  const setItems = (items: PlacedItem[]) => set({ doc: { ...get().doc, items } })
  const openingFits = (shell: Shell, o: Opening) => isValidOpening(shell, o) && !openingHitsWallItems(o, get().doc.items, sizeOf)

  return {
    doc: defaultRoom,

    resize: (patch) => {
      const { shell, items } = get().doc
      setShell({ ...shell, ...clampSize(shell, patch, itemMinRoom(items, sizeOf)) })
    },

    addOpening: (o) => {
      const shell = get().doc.shell
      if (!openingFits(shell, o)) return false
      setShell({ ...shell, openings: [...shell.openings, o] })
      return true
    },

    updateOpening: (id, patch) => {
      const shell = get().doc.shell
      const current = shell.openings.find((o) => o.id === id)
      if (!current) return false
      const next = { ...current, ...patch }
      if (!openingFits(shell, next)) return false
      setShell({ ...shell, openings: shell.openings.map((o) => (o.id === id ? next : o)) })
      return true
    },

    removeOpening: (id) => {
      const shell = get().doc.shell
      setShell({ ...shell, openings: shell.openings.filter((o) => o.id !== id) })
    },

    addItem: (item) => setItems([...get().doc.items, item]),

    updateItem: (id, patch) => setItems(get().doc.items.map((it) => (it.id === id ? { ...it, ...patch } : it))),

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
      setItems(items.filter((it) => !gone.has(it.id)))
    },
  }
})
