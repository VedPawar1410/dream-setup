import { create } from 'zustand'
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
}

type RoomState = {
  doc: RoomDoc
  resize: (patch: Partial<Pick<Shell, 'width' | 'depth' | 'height'>>) => void
  /** Returns false (and changes nothing) if the opening doesn't fit. */
  addOpening: (o: Opening) => boolean
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id' | 'kind'>>) => boolean
  removeOpening: (id: string) => void
}

export const useRoom = create<RoomState>((set, get) => {
  // Always replace, never mutate: Zustand selectors compare by reference, so a new
  // object is what tells React "this changed".
  const setShell = (shell: Shell) => set({ doc: { ...get().doc, shell } })

  return {
    doc: defaultRoom,

    resize: (patch) => {
      const shell = get().doc.shell
      setShell({ ...shell, ...clampSize(shell, patch) })
    },

    addOpening: (o) => {
      const shell = get().doc.shell
      if (!isValidOpening(shell, o)) return false
      setShell({ ...shell, openings: [...shell.openings, o] })
      return true
    },

    updateOpening: (id, patch) => {
      const shell = get().doc.shell
      const current = shell.openings.find((o) => o.id === id)
      if (!current) return false
      const next = { ...current, ...patch }
      if (!isValidOpening(shell, next)) return false
      setShell({ ...shell, openings: shell.openings.map((o) => (o.id === id ? next : o)) })
      return true
    },

    removeOpening: (id) => {
      const shell = get().doc.shell
      setShell({ ...shell, openings: shell.openings.filter((o) => o.id !== id) })
    },
  }
})
