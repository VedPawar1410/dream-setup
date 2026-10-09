import { useCursor } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Group, Plane } from 'three'
import { gsap, useGSAP } from '../anim/gsap'
import type { Opening } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { startMoving } from './blueprintActions'
import { setCameraLocked } from './camera'
import { ACCENT, DANGER } from './dimensions'
import { clippedRaycast, noRaycast, openingObjects } from './sceneRefs'

const FRAME = 0.06 // frame bar thickness
const FRAME_COLOR = '#f7f3ee'
const DOOR_COLOR = '#b98b62'
const HOVER_TINT = '#d6c4ff'

/** The wall's pointer handlers, forwarded to a ghost so hovering its hole still counts as the wall. */
export type WallPointer = {
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void
  onClick: (e: ThreeEvent<MouseEvent>) => void
}

type Props = {
  opening: Opening
  thickness: number
  clip: Plane[]
  /** Set when this is the placement preview rather than a real opening. */
  ghost?: { valid: boolean; wall: WallPointer }
}

const canEdit = () => {
  const ui = useUi.getState()
  return ui.mode === 'blueprint' && !ui.carry
}

// Rendered inside its wall's local frame (+z faces into the room), so it moves, rotates
// and gets clipped together with the wall.
export function OpeningView({ opening: o, thickness, clip, ghost }: Props) {
  const group = useRef<Group>(null!)
  const visual = useRef<Group>(null!)
  const selected = useUi((s) => s.selectedId === o.id)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered, 'grab')

  const raycast = useMemo(() => clippedRaycast(clip[0]), [clip])

  // The frames and glass never take pointer events; the single hit box below does.
  useLayoutEffect(() => {
    visual.current.traverse((obj) => (obj.raycast = noRaycast))
  })

  useEffect(() => {
    if (ghost) return
    openingObjects.set(o.id, group.current)
    return () => {
      openingObjects.delete(o.id)
    }
  }, [ghost, o.id])

  // Pop in on mount, so placing or dropping an opening feels physical
  useGSAP(() => {
    if (!ghost) gsap.from(group.current.scale, { x: 0.4, y: 0.4, z: 0.4, duration: 0.55, ease: 'back.out(2.2)' })
  })

  const tint = ghost ? (ghost.valid ? ACCENT : DANGER) : selected ? ACCENT : hovered ? HOVER_TINT : undefined
  const centerY = o.kind === 'window' ? o.sill + o.height / 2 : o.height / 2

  const handlers = ghost
    ? ghost.wall
    : {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          if (!canEdit()) return
          e.stopPropagation()
          setHovered(true)
          // Lock the camera while hovering, so pressing here drags the opening, not the view
          setCameraLocked(true)
        },
        onPointerOut: () => {
          setHovered(false)
          if (!useUi.getState().carry) setCameraLocked(false)
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          if (!canEdit()) return
          e.stopPropagation()
          setHovered(false)
          startMoving(o)
        },
      }

  return (
    <group ref={group} position={[o.offset, centerY, 0]}>
      <group ref={visual}>
        {o.kind === 'window' ? <Window opening={o} thickness={thickness} clip={clip} tint={tint} /> : <Door opening={o} thickness={thickness} clip={clip} tint={tint} />}
      </group>
      {/* Invisible hit box covering the whole opening. It draws nothing, but still catches the pointer. */}
      <mesh raycast={raycast} {...handlers}>
        <boxGeometry args={[o.width, o.height, thickness + 0.06]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}

type PartProps = { opening: Opening; thickness: number; clip: Plane[]; tint?: string }

function Window({ opening: o, thickness, clip, tint }: PartProps) {
  const color = tint ?? FRAME_COLOR
  return (
    <>
      <Frame width={o.width} height={o.height} depth={thickness + 0.04} clip={clip} color={color} />
      {/* Centre mullion */}
      <mesh castShadow>
        <boxGeometry args={[FRAME * 0.6, o.height - FRAME, FRAME * 0.8]} />
        <meshStandardMaterial color={color} roughness={0.5} clippingPlanes={clip} />
      </mesh>
      {/* Glass casts no shadow so sunlight falls through. It skips depth writes so
          ambient occlusion doesn't treat it as a solid surface. */}
      <mesh>
        <planeGeometry args={[o.width - FRAME, o.height - FRAME]} />
        <meshStandardMaterial color="#cfe6ff" transparent opacity={0.12} roughness={0.05} depthWrite={false} clippingPlanes={clip} />
      </mesh>
      {/* Sill */}
      <mesh position={[0, -o.height / 2 - 0.02, thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[o.width + 0.16, 0.04, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.5} clippingPlanes={clip} />
      </mesh>
    </>
  )
}

function Door({ opening: o, thickness, clip, tint }: PartProps) {
  return (
    <>
      <Frame width={o.width} height={o.height} depth={thickness + 0.04} clip={clip} color={tint ?? FRAME_COLOR} openBottom />
      {/* Leaf sits towards the room side of the reveal */}
      <group position={[0, -FRAME / 4, thickness / 2 - 0.035]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[o.width - FRAME * 1.5, o.height - FRAME * 0.75, 0.04]} />
          <meshStandardMaterial color={DOOR_COLOR} roughness={0.6} clippingPlanes={clip} />
        </mesh>
        <mesh position={[o.width / 2 - 0.13, -0.05, 0.04]} castShadow>
          <sphereGeometry args={[0.03, 16, 12]} />
          <meshStandardMaterial color="#d8c08a" metalness={0.9} roughness={0.25} clippingPlanes={clip} />
        </mesh>
      </group>
    </>
  )
}

function Frame({ width, height, depth, clip, color, openBottom = false }: { width: number; height: number; depth: number; clip: Plane[]; color: string; openBottom?: boolean }) {
  const bars: [number, number, number, number][] = [
    // [x, y, w, h]
    [-width / 2 + FRAME / 2, 0, FRAME, height],
    [width / 2 - FRAME / 2, 0, FRAME, height],
    [0, height / 2 - FRAME / 2, width, FRAME],
  ]
  if (!openBottom) bars.push([0, -height / 2 + FRAME / 2, width, FRAME])
  return (
    <>
      {bars.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, depth]} />
          <meshStandardMaterial color={color} roughness={0.5} clippingPlanes={clip} />
        </mesh>
      ))}
    </>
  )
}
