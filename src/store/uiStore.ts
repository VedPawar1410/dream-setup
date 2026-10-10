import { create } from 'zustand'
import type { Filter } from '../scene/photo'
import type { Scale } from './itemRules'
import type { Opening, WallSide } from './roomStore'

// Transient editor state, kept apart from the RoomDoc on purpose: it's never saved,
// and (once we add undo) undoing shouldn't undo a selection.

export type Mode = 'view' | 'decorate' | 'blueprint'

/** An opening "in hand": a new one from the panel, or an existing one being moved. */
export type Carry = { item: Omit<Opening, 'wall' | 'offset'>; isNew: boolean }

/** Where the carried opening would land, and whether it fits there. */
export type Ghost = { wall: WallSide; offset: number; valid: boolean }

/**
 * A piece of furniture in hand: new from the catalog (itemId null) or being moved.
 * `rot` is its yaw in room space. Where it would land is solved every frame and lives
 * outside React (see scene/placementSolver.ts), so moving the mouse never re-renders.
 */
export type CarryItem = { catalogId: string; itemId: string | null; rot: number; colors?: Record<string, string>; size?: Scale }

type UiState = {
  mode: Mode
  // Blueprint mode
  selectedId: string | null
  carry: Carry | null
  ghost: Ghost | null
  // Decorate mode
  selectedItemId: string | null
  carryItem: CarryItem | null
  /** Which wall(s) the Room panel paints. */
  paintTarget: WallSide | 'all'
  roomTab: 'walls' | 'floor'
  roomsOpen: boolean
  firstPerson: boolean
  photo: boolean
  photoFilter: Filter
  photoBokeh: number
  /** The first-visit tour (also replayable from settings). */
  tourOpen: boolean
}

export const useUi = create<UiState>(() => ({
  mode: 'view',
  selectedId: null,
  carry: null,
  ghost: null,
  selectedItemId: null,
  carryItem: null,
  paintTarget: 'all',
  roomTab: 'walls',
  roomsOpen: false,
  firstPerson: false,
  photo: false,
  photoFilter: 'natural',
  photoBokeh: 2,
  tourOpen: false,
}))
