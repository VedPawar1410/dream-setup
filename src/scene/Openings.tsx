import type { Plane } from 'three'
import type { Opening } from '../store/roomStore'

const FRAME = 0.06 // frame bar thickness
const FRAME_COLOR = '#f7f3ee'
const DOOR_COLOR = '#b98b62'

type Props = { opening: Opening; thickness: number; clip: Plane[] }

// Openings render inside their wall's local frame (+z faces into the room), so they move,
// rotate and get clipped together with the wall.
export function Window({ opening: o, thickness, clip }: Props) {
  const depth = thickness + 0.04
  const cy = o.sill + o.height / 2
  return (
    <group position={[o.offset, cy, 0]}>
      <Frame width={o.width} height={o.height} depth={depth} clip={clip} />
      {/* Centre mullion */}
      <mesh castShadow>
        <boxGeometry args={[FRAME * 0.6, o.height - FRAME, FRAME * 0.8]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.5} clippingPlanes={clip} />
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
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.5} clippingPlanes={clip} />
      </mesh>
    </group>
  )
}

export function Door({ opening: o, thickness, clip }: Props) {
  const depth = thickness + 0.04
  return (
    <group position={[o.offset, o.height / 2, 0]}>
      <Frame width={o.width} height={o.height} depth={depth} clip={clip} openBottom />
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
    </group>
  )
}

function Frame({ width, height, depth, clip, openBottom = false }: { width: number; height: number; depth: number; clip: Plane[]; openBottom?: boolean }) {
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
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.5} clippingPlanes={clip} />
        </mesh>
      ))}
    </>
  )
}
