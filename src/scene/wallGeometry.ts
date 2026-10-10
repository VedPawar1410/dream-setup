import { ExtrudeGeometry, Path, Shape } from 'three'
import { outline, type RoomShape } from '../store/layout'
import type { Opening } from '../store/roomStore'

/**
 * The room's floor outline (edges pushed out by `grow`) as a flat 2D shape. Shapes are
 * (x, y); laid flat with a −90° turn about x, shape y becomes world −z, hence the flip.
 */
export function outlineShape(shell: { width: number; depth: number; shape?: RoomShape }, grow: number) {
  const shape = new Shape()
  outline(shell, grow).forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)))
  shape.closePath()
  return shape
}

/** How far walls sink into the floor slab, so door holes never touch the shape's edge. */
export const WALL_SINK = 0.02

/**
 * One wall as a 2D outline with rectangular holes, extruded to its thickness.
 * Local frame: x runs along the wall (0 = the middle of its inner face; the body may reach
 * past either end to close a corner, see layout.ts), y is up, z is thickness, with +z facing
 * into the room. Extruding a shape with holes gives proper reveals around every
 * window and door, so we never need boolean (CSG) operations.
 */
export function buildWallGeometry([start, end]: [number, number], height: number, thickness: number, openings: Opening[]) {
  const shape = new Shape()
  shape.moveTo(start, -WALL_SINK)
  shape.lineTo(end, -WALL_SINK)
  shape.lineTo(end, height)
  shape.lineTo(start, height)
  shape.closePath()

  for (const o of openings) {
    // Doors start 1mm above the wall's buried base: triangulation breaks if a hole
    // touches the outline, and the 1mm sliver is hidden inside the floor slab.
    const bottom = Math.max(o.sill, -WALL_SINK + 0.001)
    const left = o.offset - o.width / 2
    const hole = new Path()
    hole.moveTo(left, bottom)
    hole.lineTo(left + o.width, bottom)
    hole.lineTo(left + o.width, o.sill + o.height)
    hole.lineTo(left, o.sill + o.height)
    hole.closePath()
    shape.holes.push(hole)
  }

  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geometry.translate(0, 0, -thickness / 2)
  return geometry
}

/** Spans of [start, end] (wall-local x) not interrupted by doors: skirting boards and cut caps. */
export function solidSpans([start, end]: [number, number], openings: Opening[]): [number, number][] {
  const doors = openings
    .filter((o) => o.kind === 'door')
    .map((o) => [o.offset - o.width / 2, o.offset + o.width / 2] as const)
    .sort((a, b) => a[0] - b[0])

  const spans: [number, number][] = []
  let cursor = start
  for (const [a, b] of doors) {
    if (a > cursor) spans.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < end) spans.push([cursor, end])
  return spans
}
