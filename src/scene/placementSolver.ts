import { Euler, Matrix4, Plane, Quaternion, Vector3, type Object3D, type Raycaster } from 'three'
import { catalogById } from '../catalog/catalog'
import { sizeOfItem } from '../catalog/models'
import { halfExtents, rectsOverlap, spansOverlap, type Size } from '../store/itemRules'
import { useRoom, type PlacedItem, type WallSide } from '../store/roomStore'
import { innerLength } from '../store/rules'
import type { CarryItem } from '../store/uiStore'
import { THICKNESS } from './dimensions'
import { itemObjects, room, wallCut, wallGroups, wallMeshes } from './sceneRefs'

/** Where an item would go: on the floor/ceiling, on another item's top, or on a wall. */
export type Candidate =
  | { kind: 'floor' | 'ceiling'; x: number; z: number; rot: number }
  | { kind: 'surface'; parentId: string; x: number; z: number; rot: number }
  | { kind: 'wall'; side: WallSide; along: number; y: number }

/**
 * Written every frame by the ghost while an item is in hand, read once when the click
 * commits. A plain mutable object, deliberately not React state: it changes 60×/s.
 */
export const placement: { candidate: Candidate | null; valid: boolean } = { candidate: null, valid: false }

const SNAP = 0.15 // closer than this to a wall snaps flush against it
const SIDES: WallSide[] = ['north', 'east', 'south', 'west']
const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
const UP = new Vector3(0, 1, 0)
const ONE = new Vector3(1, 1, 1)

const v = new Vector3()
const n = new Vector3()
const q = new Quaternion()
const euler = new Euler()
const m = new Matrix4()
const local = new Matrix4()

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** The item and everything on it: it can't be placed onto itself or its own children. */
export function subtree(items: PlacedItem[], id: string | null) {
  const out = new Set<string>()
  const walk = (pid: string) => {
    out.add(pid)
    for (const it of items) if (it.parentId === pid) walk(it.id)
  }
  if (id) walk(id)
  return out
}

export function worldYaw(obj: Object3D) {
  obj.getWorldQuaternion(q)
  return euler.setFromQuaternion(q, 'YXZ').y
}

/** Pointer ray → best spot for the carried item, plus whether it fits there. */
export function solvePlacement(ray: Raycaster, carry: CarryItem): { candidate: Candidate; valid: boolean } | null {
  const entry = catalogById.get(carry.catalogId)
  const size = sizeOfItem(carry)
  if (!entry || !size) return null
  const ignore = subtree(useRoom.getState().doc.items, carry.itemId)

  let c: Candidate | null = null
  if (entry.mount === 'wall') c = onWall(ray, size)
  else {
    // Small things try the tops of other items first, then fall back to the floor
    if (entry.mount === 'surface') c = onSurface(ray, size, carry.rot, ignore)
    c ??= onFloor(ray, size, carry.rot, entry.mount === 'ceiling' ? 'ceiling' : 'floor')
  }
  return c && { candidate: c, valid: isValid(c, carry, ignore) }
}

function onFloor(ray: Raycaster, size: Size, rot: number, kind: 'floor' | 'ceiling'): Candidate | null {
  if (!ray.ray.intersectPlane(floorPlane, v)) return null
  const { width, depth } = useRoom.getState().doc.shell
  const { hx, hz } = halfExtents(size, rot)
  // Keep the whole footprint inside the room, and snap flush when close to a wall
  const fit = (p: number, limit: number) => {
    if (limit <= 0) return 0
    let r = clamp(p, -limit, limit)
    if (limit - r < SNAP) r = limit
    else if (r + limit < SNAP) r = -limit
    return r
  }
  return { kind, x: fit(v.x, width / 2 - hx), z: fit(v.z, depth / 2 - hz), rot }
}

const ownerOf = (o: Object3D | null): string | null => {
  for (; o; o = o.parent) if (o.userData.itemId) return o.userData.itemId
  return null
}

function onSurface(ray: Raycaster, size: Size, rot: number, ignore: Set<string>): Candidate | null {
  const { items } = useRoom.getState().doc
  const byId = new Map(items.map((it) => [it.id, it]))
  const targets: Object3D[] = []
  for (const [id, obj] of itemObjects) {
    const it = byId.get(id)
    if (it && !ignore.has(id) && catalogById.get(it.catalogId)?.surface) targets.push(obj)
  }

  for (const hit of ray.intersectObjects(targets, true)) {
    const ownerId = ownerOf(hit.object)
    const owner = ownerId ? byId.get(ownerId) : undefined
    if (!owner || ignore.has(owner.id) || !catalogById.get(owner.catalogId)?.surface || !hit.face) continue
    // Only upward-facing faces count as "on top of"
    n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
    if (n.y < 0.7) continue
    const parentObj = itemObjects.get(owner.id)
    const parentSize = sizeOfItem(owner)
    if (!parentObj || !parentSize) continue

    // Work in the parent's own space, so a rotated desk still works
    parentObj.worldToLocal(v.copy(hit.point))
    const localRot = rot - worldYaw(parentObj)
    const { hx, hz } = halfExtents(size, localRot)
    const fit = (p: number, limit: number) => (limit <= 0 ? 0 : clamp(p, -limit, limit))
    return { kind: 'surface', parentId: owner.id, x: fit(v.x, parentSize.x / 2 - hx), z: fit(v.z, parentSize.z / 2 - hz), rot: localRot }
  }
  return null
}

function onWall(ray: Raycaster, size: Size): Candidate | null {
  let best: { side: WallSide; distance: number; local: Vector3 } | null = null
  for (const side of SIDES) {
    if (wallCut[side] > 0.5) continue // can't see it, so can't hang things on it
    const mesh = wallMeshes.get(side)
    const group = wallGroups.get(side)
    const hit = mesh && group ? ray.intersectObject(mesh, false)[0] : undefined
    if (!hit || (best && hit.distance >= best.distance)) continue
    const p = group!.worldToLocal(hit.point.clone())
    if (p.z < THICKNESS / 2 - 0.02) continue // the outside face
    best = { side, distance: hit.distance, local: p }
  }
  if (!best) return null
  const shell = useRoom.getState().doc.shell
  const limit = innerLength(shell, best.side) / 2 - size.x / 2
  return {
    kind: 'wall',
    side: best.side,
    along: limit <= 0 ? 0 : clamp(best.local.x, -limit, limit),
    // Centre the item vertically on the pointer
    y: clamp(best.local.y - size.y / 2, 0.05, Math.max(0.05, shell.height - size.y - 0.05)),
  }
}

/**
 * Does the item (at its own size) fit at this spot? `ignore` holds itself and anything on it.
 * Placing clamps spots into range already; resizing doesn't, so the bounds are checked here too.
 */
export function isValid(c: Candidate, item: Pick<PlacedItem, 'catalogId' | 'size'>, ignore: Set<string>): boolean {
  const { shell, items } = useRoom.getState().doc
  const size = sizeOfItem(item)
  const entry = catalogById.get(item.catalogId)
  if (!size || !entry) return false
  const TOL = 1e-3

  if (c.kind === 'wall') {
    const [a0, a1, y0, y1] = [c.along - size.x / 2, c.along + size.x / 2, c.y, c.y + size.y]
    if (Math.abs(c.along) + size.x / 2 > innerLength(shell, c.side) / 2 + TOL || y0 < -TOL || y1 > shell.height + TOL) return false
    const hitsOpening = shell.openings.some(
      (o) => o.wall === c.side && spansOverlap(a0, a1, o.offset - o.width / 2, o.offset + o.width / 2) && spansOverlap(y0, y1, o.sill, o.sill + o.height),
    )
    const hitsItem = items.some((it) => {
      const s = !ignore.has(it.id) && it.wall?.side === c.side && !it.parentId ? sizeOfItem(it) : undefined
      return !!s && spansOverlap(a0, a1, it.wall!.along - s.x / 2, it.wall!.along + s.x / 2) && spansOverlap(y0, y1, it.wall!.y, it.wall!.y + s.y)
    })
    return !hitsOpening && !hitsItem
  }

  const parentId = c.kind === 'surface' ? c.parentId : null
  const { hx, hz } = halfExtents(size, c.rot)
  if (parentId) {
    // Stay on the parent's top
    const parent = items.find((it) => it.id === parentId)
    const top = parent && sizeOfItem(parent)
    if (!top || Math.abs(c.x) + hx > top.x / 2 + TOL || Math.abs(c.z) + hz > top.z / 2 + TOL) return false
  } else if (Math.abs(c.x) + hx > shell.width / 2 + TOL || Math.abs(c.z) + hz > shell.depth / 2 + TOL || size.y > shell.height + TOL) {
    return false
  }
  if (entry.flat) return true // rugs go under anything

  // Only things at the same level and overlapping heights can collide: a ceiling fan
  // never blocks a desk, and a rug never blocks anything.
  const range = (kind: string, s: Size) => (kind === 'ceiling' ? [shell.height - s.y, shell.height] : [0, s.y])
  const [y0, y1] = range(c.kind, size)
  const rect = { x: c.x, z: c.z, hw: size.x / 2, hd: size.z / 2, rot: c.rot }
  return !items.some((it) => {
    if (ignore.has(it.id) || it.wall || it.parentId !== parentId) return false
    const other = catalogById.get(it.catalogId)
    const s = sizeOfItem(it)
    if (!other || !s || other.flat) return false
    const [b0, b1] = range(!parentId && other.mount === 'ceiling' ? 'ceiling' : 'floor', s)
    return spansOverlap(y0, y1, b0, b1) && rectsOverlap(rect, { x: it.x, z: it.z, hw: s.x / 2, hd: s.z / 2, rot: it.rot })
  })
}

/** The candidate an already-placed item occupies (used to re-check it when rotating). */
export function candidateOf(it: PlacedItem): Candidate {
  if (it.wall) return { kind: 'wall', side: it.wall.side, along: it.wall.along, y: it.wall.y }
  if (it.parentId) return { kind: 'surface', parentId: it.parentId, x: it.x, z: it.z, rot: it.rot }
  return { kind: catalogById.get(it.catalogId)?.mount === 'ceiling' ? 'ceiling' : 'floor', x: it.x, z: it.z, rot: it.rot }
}

/** The PlacedItem fields a candidate turns into when committed. */
export function candidateFields(c: Candidate): Omit<PlacedItem, 'id' | 'catalogId'> {
  if (c.kind === 'wall') return { x: 0, z: 0, rot: 0, parentId: null, wall: { side: c.side, along: c.along, y: c.y } }
  return { x: c.x, z: c.z, rot: c.rot, parentId: c.kind === 'surface' ? c.parentId : null, wall: undefined }
}

/** Room-space transform of a candidate, for drawing the ghost. Returns false if it can't be resolved yet. */
export function candidateMatrix(c: Candidate, size: Size, out: Matrix4): boolean {
  if (!room.group) return false
  m.copy(room.group.matrixWorld).invert() // world → room space

  if (c.kind === 'wall') {
    const wall = wallGroups.get(c.side)
    if (!wall) return false
    // Back against the wall's inner face
    out.multiplyMatrices(m, wall.matrixWorld).multiply(local.compose(v.set(c.along, c.y, THICKNESS / 2 + size.z / 2), q.identity(), ONE))
  } else if (c.kind === 'surface') {
    const parent = itemObjects.get(c.parentId)
    const parentItem = useRoom.getState().doc.items.find((it) => it.id === c.parentId)
    const parentSize = parentItem && sizeOfItem(parentItem)
    if (!parent || !parentSize) return false
    out.multiplyMatrices(m, parent.matrixWorld).multiply(local.compose(v.set(c.x, parentSize.y, c.z), q.setFromAxisAngle(UP, c.rot), ONE))
  } else {
    const y = c.kind === 'ceiling' ? useRoom.getState().doc.shell.height - size.y : 0
    out.compose(v.set(c.x, y, c.z), q.setFromAxisAngle(UP, c.rot), ONE)
  }
  return true
}
