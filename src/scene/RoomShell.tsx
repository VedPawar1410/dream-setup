import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MathUtils, Plane, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { gsap, useGSAP } from '../anim/gsap'
import { intro } from '../anim/intro'
import { useRoom, type FloorFinish, type Opening, type PlacedItem, type WallFinish, type WallSide } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { drop, hoverWall } from './blueprintActions'
import { setPaintTarget } from './decorateActions'
import { ACCENT, FLOOR_T, THICKNESS } from './dimensions'
import { FLOOR_MATERIALS, FLOOR_TILE, floorTexture, WALL_PATTERNS, wallTexture } from './surfaces'
import { ItemList, Placement } from './Items'
import { OpeningView, type WallPointer } from './Openings'
import { clippedRaycast, noRaycast, room, wallCut, wallGroups, wallMeshes } from './sceneRefs'
import { buildWallGeometry, solidSpans } from './wallGeometry'

const BASE_COLOR = '#2a2235' // diorama plinth, also used for wall cut faces
const CUT_HEIGHT = 0.16 // how tall a cut-away wall stays
const SKIRTING_H = 0.08

const SIDES: WallSide[] = ['north', 'east', 'south', 'west']

type WallLayout = {
  side: WallSide
  length: number
  innerLength: number
  position: [number, number, number]
  rotationY: number
  /** Points away from the room, in world space. */
  outward: Vector3
}

type GhostOpening = { opening: Opening; valid: boolean }

function layoutWalls(width: number, depth: number): WallLayout[] {
  const t = THICKNESS
  // North and south walls run the full width plus both corners, so corners close neatly.
  return [
    { side: 'north', length: width + 2 * t, innerLength: width, position: [0, 0, -depth / 2 - t / 2], rotationY: 0, outward: new Vector3(0, 0, -1) },
    { side: 'east', length: depth, innerLength: depth, position: [width / 2 + t / 2, 0, 0], rotationY: -Math.PI / 2, outward: new Vector3(1, 0, 0) },
    { side: 'south', length: width + 2 * t, innerLength: width, position: [0, 0, depth / 2 + t / 2], rotationY: Math.PI, outward: new Vector3(0, 0, 1) },
    { side: 'west', length: depth, innerLength: depth, position: [-width / 2 - t / 2, 0, 0], rotationY: Math.PI / 2, outward: new Vector3(-1, 0, 0) },
  ]
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
  const wallItems = useMemo(
    () => SIDES.map((side) => items.filter((it) => it.wall?.side === side && !it.parentId && it.id !== carriedItemId)),
    [items, carriedItemId],
  )

  const walls = useMemo(() => layoutWalls(width, depth), [width, depth])

  // One clipping plane per wall: it keeps everything below `constant` metres.
  // Normal (0,-1,0) means "keep where -y + constant >= 0", i.e. y <= constant.
  const clips = useMemo(() => SIDES.map(() => [new Plane(new Vector3(0, -1, 0), height)]), [height])
  const cut = useRef(SIDES.map(() => 0))

  useEffect(() => {
    cut.current = SIDES.map(() => 0)
  }, [walls])

  // The opening being moved is left out of its wall (so its hole closes) and drawn as the
  // ghost instead. These lists only change when openings do, so hovering doesn't rebuild
  // every wall, just the one under the ghost.
  const carriedId = carry && !carry.isNew ? carry.item.id : null
  const perWall = useMemo(
    () => SIDES.map((side) => shell.openings.filter((o) => o.wall === side && o.id !== carriedId)),
    [shell.openings, carriedId],
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
      // Seated in first person you're inside the room: every wall stays up
      const target = !seated && w.outward.dot(toCamera) > 0.25 ? 1 : 0
      cut.current[i] = MathUtils.damp(cut.current[i], target, 7, delta)
      wallCut[w.side] = cut.current[i]
      const visibleHeight = MathUtils.lerp(fullHeight, CUT_HEIGHT, cut.current[i])
      clips[i][0].constant = Math.min(visibleHeight, intro.walls[i].h * fullHeight)
    })
  })

  return (
    <group ref={group}>
      {/* Diorama plinth */}
      <mesh position={[0, -FLOOR_T - 0.12, 0]} receiveShadow>
        <boxGeometry args={[width + 2 * THICKNESS + 0.3, 0.24, depth + 2 * THICKNESS + 0.3]} />
        <meshStandardMaterial color={BASE_COLOR} roughness={0.9} />
      </mesh>
      <FloorSlab width={width + 2 * THICKNESS} depth={depth + 2 * THICKNESS} finish={shell.floor} />

      {/* Invisible ceiling: draws no colour or depth, but still renders into the shadow
          map. Without it the open-topped room lets the sun in over the walls; with it,
          sunlight only enters through the windows, as in a real room. */}
      <mesh position={[0, height + 0.1, 0]} castShadow raycast={noRaycast}>
        <boxGeometry args={[width + 2 * THICKNESS, 0.1, depth + 2 * THICKNESS]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {walls.map((w, i) => (
        <Wall
          key={w.side}
          layout={w}
          height={height}
          finish={shell.walls[w.side]}
          openings={perWall[i]}
          ghost={ghostOpening?.opening.wall === w.side ? ghostOpening : null}
          items={wallItems[i]}
          clip={clips[i]}
        />
      ))}

      {/* A real ceiling when you're inside the room (the dollhouse view has none) */}
      <mesh visible={firstPerson} position={[0, height, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={shell.walls.north.color} roughness={0.95} />
      </mesh>

      <ItemList items={rootItems} />
      <Placement />
    </group>
  )
}

/** The floor slab runs under the walls, so wall bases sink into it. */
function FloorSlab({ width, depth, finish }: { width: number; depth: number; finish: FloorFinish }) {
  // The box's top face spans UV 0..1, so the texture repeats once per FLOOR_TILE metres.
  // Each size needs its own repeat, hence a clone (clones share the image, not the GPU upload settings).
  const map = useMemo(() => {
    const t = floorTexture(finish.material).clone()
    t.repeat.set(width / FLOOR_TILE, depth / FLOOR_TILE)
    t.needsUpdate = true
    return t
  }, [finish.material, width, depth])
  useEffect(() => () => map.dispose(), [map])
  const roughness = FLOOR_MATERIALS.find((m) => m.id === finish.material)?.roughness ?? 0.6

  return (
    <mesh position={[0, -FLOOR_T / 2, 0]} receiveShadow>
      <boxGeometry args={[width, FLOOR_T, depth]} />
      <meshStandardMaterial map={map} color={finish.color} roughness={roughness} />
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
  const geometry = useMemo(() => buildWallGeometry(layout.length, height, THICKNESS, holes), [layout.length, height, holes])
  useEffect(() => () => geometry.dispose(), [geometry])
  const spans = useMemo(() => solidSpans(layout.innerLength, holes), [layout.innerLength, holes])
  const capSpans = useMemo(() => solidSpans(layout.length, holes), [layout.length, holes])
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

      {spans.map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, SKIRTING_H / 2, THICKNESS / 2 + 0.008]} castShadow receiveShadow>
          <boxGeometry args={[b - a, SKIRTING_H, 0.016]} />
          <meshStandardMaterial color="#f7f3ee" roughness={0.5} clippingPlanes={clip} />
        </mesh>
      ))}

      {openings.map((o) => (
        <OpeningView key={o.id} opening={o} thickness={THICKNESS} clip={clip} />
      ))}
      {ghost && <OpeningView key="ghost" opening={ghost.opening} thickness={THICKNESS} clip={clip} ghost={{ valid: ghost.valid, wall: pointer }} />}

      <ItemList items={items} clip={clip} />
    </group>
  )
}
