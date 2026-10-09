import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BackSide, MathUtils, Plane, Vector3, type Group } from 'three'
import { intro } from '../anim/intro'
import { useRoom, type Opening, type WallSide } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { drop, hoverWall } from './blueprintActions'
import { FLOOR_T, THICKNESS } from './dimensions'
import { OpeningView, type WallPointer } from './Openings'
import { clippedRaycast, noRaycast, wallCut } from './sceneRefs'
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
  const carry = useUi((s) => s.carry)
  const ghost = useUi((s) => s.ghost)
  const { width, depth, height } = shell
  const group = useRef<Group>(null!)

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
    toCamera.set(camera.position.x, 0, camera.position.z).normalize()
    walls.forEach((w, i) => {
      const target = w.outward.dot(toCamera) > 0.25 ? 1 : 0
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
      {/* Floor slab runs under the walls, so wall bases sink into it */}
      <mesh position={[0, -FLOOR_T / 2, 0]} receiveShadow>
        <boxGeometry args={[width + 2 * THICKNESS, FLOOR_T, depth + 2 * THICKNESS]} />
        <meshStandardMaterial color={shell.floorColor} roughness={0.55} />
      </mesh>

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
          color={shell.wallColor}
          openings={perWall[i]}
          ghost={ghostOpening?.opening.wall === w.side ? ghostOpening : null}
          clip={clips[i]}
        />
      ))}
    </group>
  )
}

type WallProps = { layout: WallLayout; height: number; color: string; openings: Opening[]; ghost: GhostOpening | null; clip: Plane[] }

function Wall({ layout, height, color, openings, ghost, clip }: WallProps) {
  const group = useRef<Group>(null!)

  // A valid ghost cuts a live hole, so you see the result before you commit.
  const holes = useMemo(() => (ghost?.valid ? [...openings, ghost.opening] : openings), [openings, ghost])
  const geometry = useMemo(() => buildWallGeometry(layout.length, height, THICKNESS, holes), [layout.length, height, holes])
  useEffect(() => () => geometry.dispose(), [geometry])
  const spans = useMemo(() => solidSpans(layout.innerLength, holes), [layout.innerLength, holes])

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
        // e.delta is how far the pointer travelled since pointerdown: a drag that orbited
        // the camera shouldn't also place a window.
        if (!useUi.getState().carry?.isNew || e.delta > 6 || !targetable()) return
        e.stopPropagation()
        drop()
      },
    }
  }, [layout.side])

  return (
    <group ref={group} position={layout.position} rotation-y={layout.rotationY}>
      {/* clipShadows stays off on purpose: a cut-away wall still casts its full shadow,
          so the room's lighting doesn't change as you orbit. */}
      <mesh geometry={geometry} castShadow receiveShadow raycast={raycast} {...pointer}>
        <meshStandardMaterial color={color} roughness={0.85} clippingPlanes={clip} />
      </mesh>
      {/* Cross-section trick: once the top is clipped, you'd see into the hollow wall.
          A back-face-only copy in a dark colour makes the cut look like a solid slab. */}
      <mesh geometry={geometry}>
        <meshBasicMaterial color={BASE_COLOR} side={BackSide} clippingPlanes={clip} />
      </mesh>

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
    </group>
  )
}
