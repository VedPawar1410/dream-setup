import { Mesh, type Intersection, type MeshStandardMaterial, type Object3D, type Plane, type Raycaster } from 'three'
import type { WallSide } from '../store/roomStore'

// Live scene objects that non-React code (the placement solver, editor actions) needs
// to reach. Components register on mount and unregister on unmount.

/** How far each wall is cut away (0 = full height, 1 = stub). RoomShell writes it every frame. */
export const wallCut: Record<WallSide, number> = {}

/** Live scene objects per opening id, so UI code can animate one (e.g. shrink it before deleting). */
export const openingObjects = new Map<string, Object3D>()

/** Each wall's body mesh (for raycasting) and its group (whose local frame wall items live in). */
export const wallMeshes = new Map<WallSide, Mesh>()
export const wallGroups = new Map<WallSide, Object3D>()

/** Each placed item's frame (origin at its bottom-centre) and the inner group GSAP animates. */
export const itemObjects = new Map<string, Object3D>()
export const itemAnims = new Map<string, Object3D>()

/** Every placed item's RGB material, for the rainbow cycle. Items add theirs on mount. */
export const rgbMaterials = new Set<MeshStandardMaterial>()

/** The room's root group. Placement maths happens in its space. */
export const room: { group: Object3D | null } = { group: null }

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
