import { Mesh, type Intersection, type Object3D, type Plane, type Raycaster } from 'three'
import type { WallSide } from '../store/roomStore'

/** How far each wall is cut away (0 = full height, 1 = stub). RoomShell writes it every frame. */
export const wallCut: Record<WallSide, number> = { north: 0, east: 0, south: 0, west: 0 }

/** Live scene objects per opening id, so UI code can animate one (e.g. shrink it before deleting). */
export const openingObjects = new Map<string, Object3D>()

/**
 * three.js raycasting ignores clipping planes, so the invisible, clipped-off top of a
 * cut-away wall would still catch clicks. This raycast drops hits on the clipped side.
 */
export function clippedRaycast(plane: Plane) {
  return function (this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
    const start = hits.length
    Mesh.prototype.raycast.call(this, raycaster, hits)
    for (let i = hits.length - 1; i >= start; i--) {
      if (plane.distanceToPoint(hits[i].point) < 0) hits.splice(i, 1)
    }
  }
}

export const noRaycast = () => {}
