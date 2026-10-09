import { create } from 'zustand'

// The whole room is one plain, serialisable document. The 3D scene and the HUD only
// *read* it; later phases add store actions as the only way to change it. That keeps
// save/load a JSON.stringify away, and makes undo a stack of snapshots.

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

type RoomState = { doc: RoomDoc }

export const useRoom = create<RoomState>(() => ({ doc: defaultRoom }))
