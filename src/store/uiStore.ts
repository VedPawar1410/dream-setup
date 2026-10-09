import { create } from 'zustand'
import type { Opening, WallSide } from './roomStore'

// Transient editor state, kept apart from the RoomDoc on purpose: it's never saved,
// and (once we add undo) undoing shouldn't undo a selection.

export type Mode = 'view' | 'blueprint'

/** An opening "in hand": a new one from the panel, or an existing one being moved. */
export type Carry = { item: Omit<Opening, 'wall' | 'offset'>; isNew: boolean }

/** Where the carried opening would land, and whether it fits there. */
export type Ghost = { wall: WallSide; offset: number; valid: boolean }

type UiState = {
  mode: Mode
  selectedId: string | null
  carry: Carry | null
  ghost: Ghost | null
}

export const useUi = create<UiState>(() => ({ mode: 'view', selectedId: null, carry: null, ghost: null }))
