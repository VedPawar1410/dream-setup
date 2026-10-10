import type { Opening, PlacedItem } from './roomStore'

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

/** The smallest room that still holds every placed item; resizing stops here. */
export function itemMinRoom(items: PlacedItem[], sizeOf: SizeOf) {
  let width = 0
  let depth = 0
  let height = 0
  for (const it of items) {
    const s = it.parentId ? undefined : sizeOf(it)
    if (!s) continue
    if (it.wall) {
      const need = 2 * (Math.abs(it.wall.along) + s.x / 2)
      if (it.wall.side === 'north' || it.wall.side === 'south') width = Math.max(width, need)
      else depth = Math.max(depth, need)
      height = Math.max(height, it.wall.y + s.y)
    } else {
      const { hx, hz } = halfExtents(s, it.rot)
      width = Math.max(width, 2 * (Math.abs(it.x) + hx))
      depth = Math.max(depth, 2 * (Math.abs(it.z) + hz))
      height = Math.max(height, s.y)
    }
  }
  return { width, depth, height }
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
