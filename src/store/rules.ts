import { wallById, wallLength } from './layout'
import type { Opening, Shell, WallSide } from './roomStore'

// Pure layout rules: no React, no three.js. The store uses them to reject invalid edits,
// and the UI uses them to clamp drags. One source of truth for "what fits".

export const ROOM = { min: 2.5, max: 10, minHeight: 2.2, maxHeight: 3.4 }

const CORNER_GAP = 0.1 // openings keep this far from wall corners
const OPENING_GAP = 0.1 // and this far from each other
const HEADROOM = 0.15 // and this far below the ceiling

export const OPENING_LIMITS = {
  window: { width: [0.4, 3], height: [0.4, 2], sill: [0.3, 1.5] },
  door: { width: [0.7, 1.8], height: [1.9, 2.6], sill: [0, 0] },
} as const

export const OPENING_DEFAULTS = {
  window: { width: 1.2, height: 1.2, sill: 0.9 },
  door: { width: 0.9, height: 2.1, sill: 0 },
}

/** Length of a wall's inner face (0 if the room has no such wall). */
export function innerLength(shell: Shell, wall: WallSide) {
  const w = wallById(shell, wall)
  return w ? wallLength(w) : 0
}

/** How far from the wall's centre an opening of this width may sit. Negative = it can't fit. */
export function offsetLimit(shell: Shell, wall: WallSide, width: number) {
  return innerLength(shell, wall) / 2 - CORNER_GAP - width / 2
}

export function isValidOpening(shell: Shell, o: Opening) {
  if (!wallById(shell, o.wall)) return false // e.g. the L's inner wall after switching back to a rectangle
  if (Math.abs(o.offset) > offsetLimit(shell, o.wall, o.width) + 1e-6) return false
  if (o.sill + o.height > shell.height - HEADROOM + 1e-6) return false
  return shell.openings.every(
    (other) =>
      other.id === o.id ||
      other.wall !== o.wall ||
      Math.abs(other.offset - o.offset) >= (other.width + o.width) / 2 + OPENING_GAP - 1e-6,
  )
}
