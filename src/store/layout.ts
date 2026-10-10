// Room shapes as pure geometry: no React, no three.js. A shape turns into a list of
// walls (each with a stable id) and a floor outline. Everything else (rendering, the
// placement solver, the rules) works on that list, so it never needs to know which
// preset made it.

/** Wall thickness, metres. The one source of truth (scene/dimensions.ts re-exports it). */
export const THICKNESS = 0.14

export type Corner = 'ne' | 'nw' | 'se' | 'sw'

export type RoomShape =
  | { kind: 'rect' }
  /** An L: one corner of the rectangle is cut out, `cutW` along x and `cutD` along z. */
  | { kind: 'l'; corner: Corner; cutW: number; cutD: number }
  /** Two rooms side by side: a divider wall across the room at x = `at`, with a doorway. */
  | { kind: 'split'; at: number }

export const RECT: RoomShape = { kind: 'rect' }

/** Smallest cut-out, and smallest leg of floor left beside it. */
export const L_LIMITS = { minCut: 0.8, minLeg: 1.2 }
/** The divider keeps each room at least this wide. */
export const SPLIT_MIN_ROOM = 1.2

type Footprint = { width: number; depth: number; shape?: RoomShape }

/**
 * One wall. Its inner face is a line at `at` on one axis, running `from`..`to` on the
 * other (`along`). `inward` points into the room; the body sits on the outward side.
 * `ext` lengthens (or, negative, shortens) the body past its `from`/`to` ends so that
 * corners close: see `wallSpan`.
 */
export type WallSeg = {
  id: string
  along: 'x' | 'z'
  at: number
  from: number
  to: number
  inward: [number, number]
  ext: [number, number]
  /** Divider walls: both faces are inside the room. */
  interior?: boolean
}

export const wallLength = (w: WallSeg) => w.to - w.from

const t = THICKNESS

/** Where the wall's group sits (its body's centre line) and its yaw. Local +z faces into the room. */
export function wallFrame(w: WallSeg) {
  const mid = (w.from + w.to) / 2
  const [nx, nz] = w.inward
  const x = w.along === 'x' ? mid : w.at
  const z = w.along === 'x' ? w.at : mid
  return { x: x - (nx * t) / 2, z: z - (nz * t) / 2, rotationY: Math.atan2(nx, nz) }
}

/** Does the wall's local +x point back toward its `from` end? (south and west walls do) */
function flipped(w: WallSeg) {
  const { rotationY } = wallFrame(w)
  // A yaw of θ turns local +x into world (cos θ, −sin θ)
  return (w.along === 'x' ? Math.cos(rotationY) : -Math.sin(rotationY)) < 0
}

/**
 * The wall body along its local x, measured from the middle of its inner face. Bodies meet
 * exactly once at every corner: walls running along x reach a thickness past outer corners
 * (filling them), and walls along z stop a thickness short of an inner (reflex) corner,
 * where the other wall's body already is. For a rectangle this is the familiar "north and
 * south walls run the full width plus both corners".
 */
export function wallSpan(w: WallSeg): [number, number] {
  const half = wallLength(w) / 2
  const [a, b] = flipped(w) ? [w.ext[1], w.ext[0]] : w.ext
  return [-half - a, half + b]
}

const cornerExt = (along: 'x' | 'z', reflex: boolean) => (along === 'x' ? (reflex ? 0 : t) : reflex ? -t : 0)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** The room's walls, in a stable order: north, east, south, west, then any extras. */
export function wallsOf(shell: Footprint): WallSeg[] {
  const hw = shell.width / 2
  const hd = shell.depth / 2
  const shape = shell.shape ?? RECT

  if (shape.kind === 'l') {
    // One canonical layout (cut at the north-east), mirrored into whichever corner is cut
    const sx = shape.corner.endsWith('e') ? 1 : -1
    const sz = shape.corner.startsWith('n') ? -1 : 1
    const ix = sx * (hw - shape.cutW) // the cut-out's inner edges
    const iz = sz * (hd - shape.cutD)
    const seg = (id: string, along: 'x' | 'z', at: number, a: number, b: number, inward: [number, number]): WallSeg => {
      const [from, to] = a < b ? [a, b] : [b, a]
      // The only inner corner of an L is where the cut-out's two walls meet
      const isReflex = (v: number) => (along === 'x' ? near(v, ix) && near(at, iz) : near(v, iz) && near(at, ix))
      return { id, along, at, from, to, inward, ext: [cornerExt(along, isReflex(from)), cornerExt(along, isReflex(to))] }
    }
    const walls = [
      seg(sz < 0 ? 'north' : 'south', 'x', sz * hd, -sx * hw, ix, [0, -sz]),
      seg('inner-h', 'x', iz, ix, sx * hw, [0, -sz]),
      seg('inner-v', 'z', ix, sz * hd, iz, [-sx, 0]),
      seg(sx > 0 ? 'east' : 'west', 'z', sx * hw, iz, -sz * hd, [-sx, 0]),
      seg(sz < 0 ? 'south' : 'north', 'x', -sz * hd, -hw, hw, [0, sz]),
      seg(sx > 0 ? 'west' : 'east', 'z', -sx * hw, -hd, hd, [sx, 0]),
    ]
    return walls.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  }

  const walls: WallSeg[] = [
    { id: 'north', along: 'x', at: -hd, from: -hw, to: hw, inward: [0, 1], ext: [t, t] },
    { id: 'east', along: 'z', at: hw, from: -hd, to: hd, inward: [-1, 0], ext: [0, 0] },
    { id: 'south', along: 'x', at: hd, from: -hw, to: hw, inward: [0, -1], ext: [t, t] },
    { id: 'west', along: 'z', at: -hw, from: -hd, to: hd, inward: [1, 0], ext: [0, 0] },
  ]
  if (shape.kind === 'split') {
    // The divider's main face looks west; its body runs a thickness east, between the
    // north and south walls' inner faces
    walls.push({ id: 'divider', along: 'z', at: shape.at - t / 2, from: -hd, to: hd, inward: [-1, 0], ext: [0, 0], interior: true })
  }
  return walls
}

const ORDER = ['north', 'east', 'south', 'west', 'inner-h', 'inner-v', 'divider']

/** Short labels for the wall picker. */
export const WALL_LABELS: Record<string, string> = { north: 'N', east: 'E', south: 'S', west: 'W', 'inner-h': 'Inner 1', 'inner-v': 'Inner 2', divider: 'Divider' }

/** A wall by id, if the room has one. */
export const wallById = (shell: Footprint, id: string) => wallsOf(shell).find((w) => w.id === id)

/** The floor outline with its edges pushed out by `grow` (THICKNESS gives the walls' outer faces). */
export function outline(shell: Footprint, grow: number): [number, number][] {
  const hw = shell.width / 2 + grow
  const hd = shell.depth / 2 + grow
  const shape = shell.shape ?? RECT
  if (shape.kind !== 'l') {
    return [
      [-hw, -hd],
      [-hw, hd],
      [hw, hd],
      [hw, -hd],
    ]
  }
  const sx = shape.corner.endsWith('e') ? 1 : -1
  const sz = shape.corner.startsWith('n') ? 1 : -1 // canonical cut is at -z (north)
  // Canonical L cut at +x/−z; the cut-out's inner corner moves outward (into the cut) by `grow`
  const cx = shell.width / 2 - shape.cutW + grow
  const cz = -(shell.depth / 2 - shape.cutD) - grow
  const canonical: [number, number][] = [
    [-hw, -hd],
    [-hw, hd],
    [hw, hd],
    [hw, cz],
    [cx, cz],
    [cx, -hd],
  ]
  return canonical.map(([x, z]) => [x * sx, z * sz])
}

/** Areas inside the bounding rectangle that aren't floor: the L's cut-out, the divider. */
export function blockedAreas(shell: Footprint): { x0: number; x1: number; z0: number; z1: number }[] {
  const shape = shell.shape ?? RECT
  const hw = shell.width / 2
  const hd = shell.depth / 2
  if (shape.kind === 'l') {
    const sx = shape.corner.endsWith('e') ? 1 : -1
    const sz = shape.corner.startsWith('n') ? -1 : 1
    const [xa, xb, za, zb] = [sx * hw, sx * (hw - shape.cutW), sz * hd, sz * (hd - shape.cutD)]
    return [{ x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) }]
  }
  if (shape.kind === 'split') return [{ x0: shape.at - t / 2, x1: shape.at + t / 2, z0: -hd, z1: hd }]
  return []
}

/** Keep a shape's numbers valid for a room size (a cut-out or divider can't outgrow the room). */
export function fitShape(shape: RoomShape, width: number, depth: number): RoomShape {
  const c = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))
  if (shape.kind === 'l') {
    return { ...shape, cutW: c(shape.cutW, L_LIMITS.minCut, width - L_LIMITS.minLeg), cutD: c(shape.cutD, L_LIMITS.minCut, depth - L_LIMITS.minLeg) }
  }
  if (shape.kind === 'split') {
    const lim = width / 2 - SPLIT_MIN_ROOM - t / 2
    return { ...shape, at: c(shape.at, -lim, lim) }
  }
  return shape
}
