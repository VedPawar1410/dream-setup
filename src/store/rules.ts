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

export function innerLength(shell: Shell, wall: WallSide) {
  return wall === 'north' || wall === 'south' ? shell.width : shell.depth
}

/** How far from the wall's centre an opening of this width may sit. Negative = it can't fit. */
export function offsetLimit(shell: Shell, wall: WallSide, width: number) {
  return innerLength(shell, wall) / 2 - CORNER_GAP - width / 2
}

export function isValidOpening(shell: Shell, o: Opening) {
  if (Math.abs(o.offset) > offsetLimit(shell, o.wall, o.width) + 1e-6) return false
  if (o.sill + o.height > shell.height - HEADROOM + 1e-6) return false
  return shell.openings.every(
    (other) =>
      other.id === o.id ||
      other.wall !== o.wall ||
      Math.abs(other.offset - o.offset) >= (other.width + o.width) / 2 + OPENING_GAP - 1e-6,
  )
}

/**
 * The room can't shrink past its openings. Rather than silently deleting a window
 * when you drag a wall in, the wall simply stops, which is easier to predict.
 */
export function clampSize(shell: Shell, patch: Partial<Pick<Shell, 'width' | 'depth' | 'height'>>) {
  const span = (walls: WallSide[]) =>
    Math.max(
      ROOM.min,
      ...shell.openings.filter((o) => walls.includes(o.wall)).map((o) => 2 * (Math.abs(o.offset) + o.width / 2 + CORNER_GAP)),
    )
  const minHeight = Math.max(ROOM.minHeight, ...shell.openings.map((o) => o.sill + o.height + HEADROOM))
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  return {
    width: clamp(patch.width ?? shell.width, span(['north', 'south']), ROOM.max),
    depth: clamp(patch.depth ?? shell.depth, span(['east', 'west']), ROOM.max),
    height: clamp(patch.height ?? shell.height, minHeight, ROOM.maxHeight),
  }
}
