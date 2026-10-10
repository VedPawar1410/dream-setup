import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { ExtrudeGeometry, MathUtils, Plane, ShapeGeometry, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { gsap, useGSAP } from '../anim/gsap'
import { intro } from '../anim/intro'
import { wallFrame, wallLength, wallsOf, wallSpan, type WallSeg } from '../store/layout'
import { useRoom, type FloorFinish, type Opening, type PlacedItem, type Shell, type WallFinish } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { drop, hoverWall } from './blueprintActions'
import { setPaintTarget } from './decorateActions'
import { ACCENT, FLOOR_T, THICKNESS } from './dimensions'
import { FLOOR_MATERIALS, FLOOR_TILE, floorTexture, WALL_PATTERNS, wallTexture } from './surfaces'
import { ItemList, Placement } from './Items'
import { OpeningView, type WallPointer } from './Openings'
import { clippedRaycast, noRaycast, room, wallCut, wallGroups, wallMeshes } from './sceneRefs'
import { buildWallGeometry, outlineShape, solidSpans } from './wallGeometry'

const BASE_COLOR = '#2a2235' // diorama plinth, also used for wall cut faces
const CUT_HEIGHT = 0.16 // how tall a cut-away wall stays
const SKIRTING_H = 0.08

type WallLayout = {
  side: string
  /** The body along local x (it may reach past the inner face to close a corner). */
  span: [number, number]
  innerLength: number
  position: [number, number, number]
  rotationY: number
  /** Points away from the room, in world space. */
  outward: Vector3
  /** A divider: both faces are inside the room. */
  interior: boolean
}

type GhostOpening = { opening: Opening; valid: boolean }

function layoutWalls(shell: Shell): WallLayout[] {
  return wallsOf(shell).map((w: WallSeg) => {
    const f = wallFrame(w)
    return {
      side: w.id,
      span: wallSpan(w),
      innerLength: wallLength(w),
      position: [f.x, 0, f.z],
      rotationY: f.rotationY,
      outward: new Vector3(-w.inward[0], 0, -w.inward[1]),
      interior: !!w.interior,
    }
  })
}

/** A flat outline turned into a slab `thickness` thick, its top at y = 0 (before positioning). */
function slab(shell: Shell, grow: number, thickness: number) {
  const g = new ExtrudeGeometry(outlineShape(shell, grow), { depth: thickness, bevelEnabled: false })
  g.rotateX(-Math.PI / 2) // extrusion now runs up y, from 0 to thickness
  g.translate(0, -thickness, 0)
  return g
}

const toCamera = new Vector3()

export default function RoomShell() {
  const shell = useRoom((s) => s.doc.shell)
  const items = useRoom((s) => s.doc.items)
  const carry = useUi((s) => s.carry)
  const ghost = useUi((s) => s.ghost)
  const carriedItemId = useUi((s) => s.carryItem?.itemId ?? null)
  const firstPerson = useUi((s) => s.firstPerson)
  const { width, depth, height } = shell
  const group = useRef<Group>(null!)

  useEffect(() => {
    room.group = group.current
    return () => {
      room.group = null
    }
  }, [])

  // Root items stand in room space; wall items render inside their wall's group. The item
  // being moved is left out (its ghost stands in for it until it's dropped).
  const rootItems = useMemo(() => items.filter((it) => !it.parentId && !it.wall && it.id !== carriedItemId), [items, carriedItemId])
  const shape = shell.shape
  const walls = useMemo(() => layoutWalls({ width, depth, shape } as Shell), [width, depth, shape])
  const wallItems = useMemo(
    () => walls.map((w) => items.filter((it) => it.wall?.side === w.side && !it.parentId && it.id !== carriedItemId)),
    [walls, items, carriedItemId],
  )

  // One clipping plane per wall: it keeps everything below `constant` metres.
  // Normal (0,-1,0) means "keep where -y + constant >= 0", i.e. y <= constant.
  const clips = useMemo(() => walls.map(() => [new Plane(new Vector3(0, -1, 0), height)]), [walls, height])
  const cut = useRef(walls.map(() => 0))

  useEffect(() => {
    cut.current = walls.map(() => 0)
  }, [walls])

  // The opening being moved is left out of its wall (so its hole closes) and drawn as the
  // ghost instead. These lists only change when openings do, so hovering doesn't rebuild
  // every wall, just the one under the ghost.
  const carriedId = carry && !carry.isNew ? carry.item.id : null
  const perWall = useMemo(
    () => walls.map((w) => shell.openings.filter((o) => o.wall === w.side && o.id !== carriedId)),
    [walls, shell.openings, carriedId],
  )
  const ghostOpening = useMemo<GhostOpening | null>(
    () => (carry && ghost ? { opening: { ...carry.item, wall: ghost.wall, offset: ghost.offset }, valid: ghost.valid } : null),
    [carry, ghost],
  )

  useFrame(({ camera }, delta) => {
    const p = intro.room.p
    group.current.scale.setScalar(0.9 + 0.1 * p)
    group.current.position.y = (1 - p) * -0.6

    // Hide the walls that sit between the camera and the room. Damping the value
    // (instead of snapping) makes walls glide down and up as you orbit.
    // The plane rests a little above the wall top: exactly at the top face, floating-point
    // precision clips random pixels along the edge.
    const fullHeight = height + 0.05
    const seated = useUi.getState().firstPerson
    toCamera.set(camera.position.x, 0, camera.position.z).normalize()
    walls.forEach((w, i) => {
      // Seated in first person you're inside the room: every wall stays up. A divider
      // hides half the room from either side, so it drops whenever it faces the camera.
      const facing = w.outward.dot(toCamera)
      const target = !seated && (w.interior ? Math.abs(facing) > 0.35 : facing > 0.25) ? 1 : 0
      cut.current[i] = MathUtils.damp(cut.current[i], target, 7, delta)
      wallCut[w.side] = cut.current[i]
      const visibleHeight = MathUtils.lerp(fullHeight, CUT_HEIGHT, cut.current[i])
      clips[i][0].constant = Math.min(visibleHeight, intro.walls[Math.min(i, intro.walls.length - 1)].h * fullHeight)
    })
  })

  return (
    <group ref={group}>
      {/* Diorama plinth, following the room's outline */}
      <Slab shell={shell} grow={THICKNESS + 0.15} thickness={0.24} y={-FLOOR_T} receiveShadow>
        <meshStandardMaterial color={BASE_COLOR} roughness={0.9} />
      </Slab>
      <FloorSlab shell={shell} finish={shell.floor} />

      {/* Invisible ceiling: draws no colour or depth, but still renders into the shadow
          map. Without it the open-topped room lets the sun in over the walls; with it,
          sunlight only enters through the windows, as in a real room. */}
      <Slab shell={shell} grow={THICKNESS} thickness={0.1} y={height + 0.15} castShadow>
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </Slab>

      {walls.map((w, i) => (
        <Wall
          key={w.side}
          layout={w}
          height={height}
          finish={shell.walls[w.side] ?? shell.walls.north}
          openings={perWall[i]}
          ghost={ghostOpening?.opening.wall === w.side ? ghostOpening : null}
          items={wallItems[i]}
          clip={clips[i]}
        />
      ))}

      {/* A real ceiling when you're inside the room (the dollhouse view has none) */}
      <Ceiling shell={shell} visible={firstPerson} />

      <ItemList items={rootItems} />
      <Placement />
    </group>
  )
}

/** A slab in the shape of the room (rectangle or L), its top at `y`. */
function Slab({ shell, grow, thickness, y, children, ...rest }: { shell: Shell; grow: number; thickness: number; y: number; children: React.ReactNode; castShadow?: boolean; receiveShadow?: boolean }) {
  const { width, depth, shape } = shell
  const geometry = useMemo(() => slab({ width, depth, shape } as Shell, grow, thickness), [width, depth, shape, grow, thickness])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} position-y={y} raycast={noRaycast} {...rest}>
      {children}
    </mesh>
  )
}

/** The floor slab runs under the walls, so wall bases sink into it. */
function FloorSlab({ shell, finish }: { shell: Shell; finish: FloorFinish }) {
  const { width, depth, shape } = shell
  // Extruded outlines get UVs in metres (from the 2D shape), so one texture repeat per
  // FLOOR_TILE metres. A clone per floor: clones share the image, not the repeat settings.
  const map = useMemo(() => {
    const t = floorTexture(finish.material).clone()
    t.repeat.set(1 / FLOOR_TILE, 1 / FLOOR_TILE)
    t.needsUpdate = true
    return t
  }, [finish.material])
  useEffect(() => () => map.dispose(), [map])
  const geometry = useMemo(() => slab({ width, depth, shape } as Shell, THICKNESS, FLOOR_T), [width, depth, shape])
  useEffect(() => () => geometry.dispose(), [geometry])
  const roughness = FLOOR_MATERIALS.find((m) => m.id === finish.material)?.roughness ?? 0.6

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={map} color={finish.color} roughness={roughness} />
    </mesh>
  )
}

/** A real ceiling for first person (the dollhouse view has none), in the room's shape. */
function Ceiling({ shell, visible }: { shell: Shell; visible: boolean }) {
  const { width, depth, shape } = shell
  const geometry = useMemo(() => new ShapeGeometry(outlineShape({ width, depth, shape } as Shell, 0)), [width, depth, shape])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    // −90° maps the shape's y (= −z) back onto world z, like the floor; seen from below, so both sides render
    <mesh geometry={geometry} visible={visible} position-y={shell.height} rotation-x={-Math.PI / 2} raycast={noRaycast}>
      <meshStandardMaterial color={shell.walls.north.color} roughness={0.95} side={2} />
    </mesh>
  )
}

type WallProps = {
  layout: WallLayout
  height: number
  finish: WallFinish
  openings: Opening[]
  ghost: GhostOpening | null
  items: PlacedItem[]
  clip: Plane[]
}

function Wall({ layout, height, finish, openings, ghost, items, clip }: WallProps) {
  const group = useRef<Group>(null!)
  const body = useRef<Mesh>(null!)
  const material = useRef<MeshStandardMaterial>(null!)
  const map = wallTexture(finish.pattern)
  const roughness = WALL_PATTERNS.find((p) => p.id === finish.pattern)?.roughness ?? 0.85

  // Flash the wall(s) you just picked to paint, so it's obvious which one is targeted
  const paintTarget = useUi((s) => s.paintTarget)
  const firstTarget = useRef(true)
  useGSAP(
    () => {
      if (firstTarget.current) {
        firstTarget.current = false
        return
      }
      if (paintTarget === layout.side || paintTarget === 'all') {
        gsap.fromTo(material.current, { emissiveIntensity: 0.45 }, { emissiveIntensity: 0, duration: 0.9, ease: 'power2.out' })
      }
    },
    { dependencies: [paintTarget] },
  )

  // The placement solver raycasts wall bodies and positions wall items in the wall's frame
  useEffect(() => {
    wallMeshes.set(layout.side, body.current)
    wallGroups.set(layout.side, group.current)
    return () => {
      wallMeshes.delete(layout.side)
      wallGroups.delete(layout.side)
    }
  }, [layout.side])

  // A valid ghost cuts a live hole, so you see the result before you commit.
  const holes = useMemo(() => (ghost?.valid ? [...openings, ghost.opening] : openings), [openings, ghost])
  const [s0, s1] = layout.span
  const geometry = useMemo(() => buildWallGeometry([s0, s1], height, THICKNESS, holes), [s0, s1, height, holes])
  useEffect(() => () => geometry.dispose(), [geometry])
  const spans = useMemo(() => solidSpans([-layout.innerLength / 2, layout.innerLength / 2], holes), [layout.innerLength, holes])
  const capSpans = useMemo(() => solidSpans([s0, s1], holes), [s0, s1, holes])
  const cap = useRef<Group>(null!)

  // The lid follows this wall's clip height, and hides when the wall is whole
  useFrame(() => {
    const h = clip[0].constant
    cap.current.visible = h < height
    cap.current.position.y = h
  })

  const raycast = useMemo(() => clippedRaycast(clip[0]), [clip])

  // While an opening is in hand, the wall reports where along it the pointer is.
  // Cut-away walls are skipped: you couldn't see what you were placing.
  const pointer = useMemo<WallPointer>(() => {
    const local = new Vector3()
    const targetable = () => {
      const ui = useUi.getState()
      return ui.mode === 'blueprint' && ui.carry !== null && wallCut[layout.side] < 0.5
    }
    return {
      onPointerMove: (e) => {
        if (!targetable()) return
        e.stopPropagation()
        const x = group.current.worldToLocal(local.copy(e.point)).x
        hoverWall(layout.side, x, e.nativeEvent.shiftKey)
      },
      onClick: (e) => {
        const ui = useUi.getState()
        // e.delta is how far the pointer travelled since pointerdown: a drag that orbited
        // the camera shouldn't count as a click.
        if (ui.mode === 'decorate') {
          // Clicking a wall picks it for painting, unless an item or opening in front took the click
          const inFront = e.intersections[0]?.eventObject !== e.eventObject
          if (ui.carryItem || e.delta > 6 || wallCut[layout.side] >= 0.5 || inFront) return
          e.stopPropagation()
          setPaintTarget(layout.side)
          return
        }
        if (!ui.carry?.isNew || e.delta > 6 || !targetable()) return
        e.stopPropagation()
        drop()
      },
    }
  }, [layout.side])

  return (
    <group ref={group} position={layout.position} rotation-y={layout.rotationY}>
      {/* clipShadows stays off on purpose: a cut-away wall still casts its full shadow,
          so the room's lighting doesn't change as you orbit. */}
      <mesh ref={body} geometry={geometry} castShadow receiveShadow raycast={raycast} {...pointer}>
        {/* Keyed by pattern: adding or removing a texture map needs a different shader,
            so the material is remade rather than patched. Wall UVs come straight from the
            2D outline (metres), so one texture tile is exactly one metre of wall. */}
        <meshStandardMaterial
          key={finish.pattern}
          ref={material}
          map={map}
          color={finish.color}
          roughness={roughness}
          emissive={ACCENT}
          emissiveIntensity={0}
          clippingPlanes={clip}
        />
      </mesh>
      {/* Cross-section cap: once the top is clipped you'd see into the hollow wall shape,
          where the floor slab and skirting z-fight. A flat lid that rides at the clip
          height hides all of that and reads as a solid cut slab. Doorways stay open. */}
      <group ref={cap}>
        {capSpans.map(([a, b]) => (
          <mesh key={a} position={[(a + b) / 2, 0, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
            <planeGeometry args={[b - a, THICKNESS]} />
            <meshBasicMaterial color={BASE_COLOR} />
          </mesh>
        ))}
      </group>

      {/* Skirting along the inner face (and both faces of a divider) */}
      {(layout.interior ? [1, -1] : [1]).flatMap((face) =>
        spans.map(([a, b]) => (
          <mesh key={`${face}:${a}`} position={[(a + b) / 2, SKIRTING_H / 2, face * (THICKNESS / 2 + 0.008)]} castShadow receiveShadow>
            <boxGeometry args={[b - a, SKIRTING_H, 0.016]} />
            <meshStandardMaterial color="#f7f3ee" roughness={0.5} clippingPlanes={clip} />
          </mesh>
        )),
      )}

      {openings.map((o) => (
        <OpeningView key={o.id} opening={o} thickness={THICKNESS} clip={clip} />
      ))}
      {ghost && <OpeningView key="ghost" opening={ghost.opening} thickness={THICKNESS} clip={clip} ghost={{ valid: ghost.valid, wall: pointer }} />}

      <ItemList items={items} clip={clip} />
    </group>
  )
}
