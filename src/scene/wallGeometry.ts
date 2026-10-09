import { ExtrudeGeometry, Path, Shape } from 'three'
import type { Opening } from '../store/roomStore'

/** How far walls sink into the floor slab, so door holes never touch the shape's edge. */
export const WALL_SINK = 0.02

/**
 * One wall as a 2D outline with rectangular holes, extruded to its thickness.
 * Local frame: x runs along the wall (centred), y is up, z is thickness, with +z facing
 * into the room. Extruding a shape with holes gives proper reveals around every
 * window and door, so we never need boolean (CSG) operations.
 */
export function buildWallGeometry(length: number, height: number, thickness: number, openings: Opening[]) {
  const half = length / 2
  const shape = new Shape()
  shape.moveTo(-half, -WALL_SINK)
  shape.lineTo(half, -WALL_SINK)
  shape.lineTo(half, height)
  shape.lineTo(-half, height)
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

/** Spans along an inner wall face not interrupted by doors, used for skirting boards. */
export function solidSpans(innerLength: number, openings: Opening[]): [number, number][] {
  const doors = openings
    .filter((o) => o.kind === 'door')
    .map((o) => [o.offset - o.width / 2, o.offset + o.width / 2] as const)
    .sort((a, b) => a[0] - b[0])

  const spans: [number, number][] = []
  let cursor = -innerLength / 2
  for (const [start, end] of doors) {
    if (start > cursor) spans.push([cursor, start])
    cursor = Math.max(cursor, end)
  }
  if (cursor < innerLength / 2) spans.push([cursor, innerLength / 2])
  return spans
}
