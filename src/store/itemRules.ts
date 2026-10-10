import { blockedAreas } from './layout'
import type { Opening, PlacedItem, Shell } from './roomStore'
import { innerLength, isValidOpening } from './rules'

// Pure geometry for furniture: footprints, overlap tests and the room size items need.
// No three.js or React here, so it's easy to reason about and to test.

export type Size = { x: number; y: number; z: number }

/** A placed item's resize: multipliers on the model's own width (x), depth (z) and height (y). */
export type Scale = { w: number; d: number; h: number }
export const SCALE_MIN = 0.4
export const SCALE_MAX = 3

/** The model's size stretched by an item's scale (or as-is when it has none). */
export const scaled = (s: Size, k?: Scale): Size => (k ? { x: s.x * k.w, y: s.y * k.h, z: s.z * k.d } : s)

/** Real size of a placed item, or undefined while its model is still loading. */
export type SizeOf = (item: Pick<PlacedItem, 'catalogId' | 'size'>) => Size | undefined

/** An item's floor footprint: centre, half width/depth, and yaw (radians). */
export type Rect = { x: number; z: number; hw: number; hd: number; rot: number }

const EPS = 1e-4 // touching (flush against each other) is allowed; overlapping isn't

/** Half extents of the axis-aligned box around a footprint rotated by `rot`. */
export function halfExtents(size: Size, rot: number) {
  const c = Math.abs(Math.cos(rot))
  const s = Math.abs(Math.sin(rot))
  return { hx: (c * size.x + s * size.z) / 2, hz: (s * size.x + c * size.z) / 2 }
}

export function spansOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 - EPS && b0 < a1 - EPS
}

// A rect's local x and z axes in room space, matching three.js's rotation.y convention.
const axes = (r: Rect): [number, number][] => [
  [Math.cos(r.rot), -Math.sin(r.rot)],
  [Math.sin(r.rot), Math.cos(r.rot)],
]

/**
 * Separating Axis Theorem for two rotated rectangles: they overlap unless some axis
 * (one of the four edge directions) has a gap between their projections.
 */
export function rectsOverlap(a: Rect, b: Rect) {
  const radius = (r: Rect, [ux, uz]: [number, number]) => {
    const [[ax, az], [bx, bz]] = axes(r)
    return r.hw * Math.abs(ax * ux + az * uz) + r.hd * Math.abs(bx * ux + bz * uz)
  }
  for (const u of [...axes(a), ...axes(b)]) {
    const gap = Math.abs((b.x - a.x) * u[0] + (b.z - a.z) * u[1])
    if (gap >= radius(a, u) + radius(b, u) - EPS) return false
  }
  return true
}

const TOL = 1e-3

/** Is this footprint on the floor: inside the room and clear of any cut-out or divider? */
export function onFloor(shell: Shell, r: Rect) {
  const { hx, hz } = halfExtents({ x: r.hw * 2, y: 0, z: r.hd * 2 }, r.rot)
  if (Math.abs(r.x) + hx > shell.width / 2 + TOL || Math.abs(r.z) + hz > shell.depth / 2 + TOL) return false
  return blockedAreas(shell).every((b) => !rectsOverlap(r, { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, rot: 0 }))
}

/**
 * Would everything still fit in this room? Every opening on an existing wall, every wall
 * item within its wall, every floor item on the floor, nothing taller than the room.
 * Resizing and reshaping use this to stop (or refuse) instead of breaking the room.
 */
export function shellFits(shell: Shell, items: PlacedItem[], sizeOf: SizeOf) {
  if (!shell.openings.every((o) => isValidOpening(shell, o))) return false
  return items.every((it) => {
    if (it.parentId) return true // moves with its parent
    const s = sizeOf(it)
    if (!s) return true // not loaded yet: can't judge
    if (it.wall) {
      const len = innerLength(shell, it.wall.side)
      return len > 0 && Math.abs(it.wall.along) + s.x / 2 <= len / 2 + TOL && it.wall.y + s.y <= shell.height + TOL
    }
    return s.y <= shell.height + TOL && onFloor(shell, { x: it.x, z: it.z, hw: s.x / 2, hd: s.z / 2, rot: it.rot })
  })
}

/** Would this window/door cut through something hanging on its wall? */
export function openingHitsWallItems(o: Opening, items: PlacedItem[], sizeOf: SizeOf) {
  return items.some((it) => {
    const s = it.wall?.side === o.wall && !it.parentId ? sizeOf(it) : undefined
    return (
      !!s &&
      spansOverlap(o.offset - o.width / 2, o.offset + o.width / 2, it.wall!.along - s.x / 2, it.wall!.along + s.x / 2) &&
      spansOverlap(o.sill, o.sill + o.height, it.wall!.y, it.wall!.y + s.y)
    )
  })
}
