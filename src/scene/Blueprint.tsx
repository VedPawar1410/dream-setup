import { useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, Plane, RepeatWrapping, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { gsap, useGSAP } from '../anim/gsap'
import { useRoom } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { cancelCarry, drop, removeSelected, select, setMode, toggleBlueprint } from './blueprintActions'
import { setCameraLocked } from './camera'
import { ACCENT, THICKNESS } from './dimensions'
import { noRaycast } from './sceneRefs'

const HANDLE_GAP = 0.5 // from a wall's outer face to its resize handle

// Every blueprint visual fades with this single value (0 → 1), tweened on mode change
// and read in useFrame, so grid, handles and labels always move together.
const reveal = { p: 0 }

export default function Blueprint() {
  const mode = useUi((s) => s.mode)

  useGSAP(
    () => {
      gsap.to(reveal, { p: mode === 'blueprint' ? 1 : 0, duration: 0.6, ease: 'power2.inOut', overwrite: true })
    },
    { dependencies: [mode] },
  )

  useBlueprintInput()

  return (
    <>
      <FloorGrid />
      <ResizeHandle axis="x" sign={1} />
      <ResizeHandle axis="x" sign={-1} />
      <ResizeHandle axis="z" sign={1} />
      <ResizeHandle axis="z" sign={-1} />
    </>
  )
}

function useBlueprintInput() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      const ui = useUi.getState()
      if (e.code === 'KeyB') return toggleBlueprint()
      if (ui.mode !== 'blueprint') return
      // Named keys go by e.key (the same on every layout); letters use e.code so they
      // stay in the same physical spot on AZERTY etc.
      if (e.key === 'Escape') {
        if (ui.carry) cancelCarry()
        else if (ui.selectedId) select(null)
        else setMode('view')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected()
      }
    }
    // A moved opening drops wherever the button comes up, even off the walls.
    // (New ones are placed by clicking a wall; see RoomShell.)
    const onPointerUp = () => {
      const { carry } = useUi.getState()
      if (carry && !carry.isNew) drop()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])
}

function makeGridTexture() {
  const size = 128 // one tile = one metre
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, size, size)
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(size / 2, 0)
  ctx.lineTo(size / 2, size)
  ctx.moveTo(0, size / 2)
  ctx.lineTo(size, size / 2)
  ctx.stroke()

  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function FloorGrid() {
  const { width, depth } = useRoom((s) => s.doc.shell)
  const mesh = useRef<Mesh>(null!)
  const texture = useMemo(() => makeGridTexture(), [])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame(() => {
    const m = mesh.current
    m.visible = reveal.p > 0.001
    const material = m.material as MeshBasicMaterial
    material.opacity = reveal.p * 0.5
    material.map!.repeat.set(width, depth) // 1 repeat per metre
  })

  // depthWrite off: the grid is a decal, so ambient occlusion shouldn't see it
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} raycast={noRaycast}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} color={ACCENT} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
const floorHit = new Vector3()

function ResizeHandle({ axis, sign }: { axis: 'x' | 'z'; sign: 1 | -1 }) {
  const shell = useRoom((s) => s.doc.shell)
  const resize = useRoom((s) => s.resize)
  const isBlueprint = useUi((s) => s.mode === 'blueprint')
  const outer = useRef<Group>(null!)
  const inner = useRef<Group>(null!)
  const dragging = useRef(false)
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  useCursor(hovered || active, active ? 'grabbing' : 'grab')

  const size = axis === 'x' ? shell.width : shell.depth
  const dist = size / 2 + THICKNESS + HANDLE_GAP
  const position: [number, number, number] = axis === 'x' ? [sign * dist, 0.03, 0] : [0, 0.03, sign * dist]

  useGSAP(
    () => {
      const s = hovered || active ? 1.25 : 1
      gsap.to(inner.current.scale, { x: s, y: s, z: s, duration: 0.35, ease: 'back.out(3)', overwrite: true })
    },
    { dependencies: [hovered, active] },
  )

  useFrame(() => {
    outer.current.visible = reveal.p > 0.001
    outer.current.scale.setScalar(Math.max(reveal.p, 0.001))
  })

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isBlueprint) return
    e.stopPropagation()
    // Capture keeps move events coming to this handle even when the cursor slips off it
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragging.current = true
    setActive(true)
    setCameraLocked(true)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !e.ray.intersectPlane(floorPlane, floorHit)) return
    const along = (axis === 'x' ? floorHit.x : floorHit.z) * sign
    // The room grows symmetrically, so the size is twice the handle's distance from centre.
    // Hold Shift to skip the 10cm snapping.
    let next = 2 * (along - THICKNESS - HANDLE_GAP)
    if (!e.nativeEvent.shiftKey) next = Math.round(next * 10) / 10
    resize(axis === 'x' ? { width: next } : { depth: next })
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    dragging.current = false
    setActive(false)
    if (!hovered) setCameraLocked(false)
  }

  return (
    <group ref={outer} position={position}>
      <group ref={inner} rotation-y={axis === 'z' ? Math.PI / 2 : 0}>
        <mesh
          onPointerOver={(e) => {
            if (!isBlueprint) return
            e.stopPropagation()
            setHovered(true)
            setCameraLocked(true)
          }}
          onPointerOut={() => {
            setHovered(false)
            if (!dragging.current) setCameraLocked(false)
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          <cylinderGeometry args={[0.22, 0.22, 0.05, 40]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
        {/* Double-headed arrow showing the drag direction */}
        {[1, -1].map((dir) => (
          <mesh key={dir} position={[dir * 0.1, 0.045, 0]} rotation-z={-dir * (Math.PI / 2)} raycast={noRaycast}>
            <coneGeometry args={[0.05, 0.08, 3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
        <mesh position={[0, 0.045, 0]} raycast={noRaycast}>
          <boxGeometry args={[0.12, 0.012, 0.025]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      {sign === 1 && <FloorLabel position={axis === 'x' ? [0.62, 0, 0] : [0, 0, 0.62]} text={`${size.toFixed(1)} m`} on={isBlueprint} />}
    </group>
  )
}

const projected = new Vector3()

/**
 * A DOM label pinned to a 3D point. Each frame it projects its world position to screen
 * pixels and moves one plain <div>. (drei's <Html> does the same, but it mounts a separate
 * React root per label, and on React 19 one of ours kept coming up empty.)
 */
function FloorLabel({ position, text, on }: { position: [number, number, number]; text: string; on: boolean }) {
  const gl = useThree((s) => s.gl)
  const anchor = useRef<Group>(null!)
  const wrapper = useRef<HTMLDivElement | null>(null)
  const label = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const w = document.createElement('div')
    w.className = 'floor-label'
    const l = document.createElement('div')
    l.className = 'dim-label'
    w.appendChild(l)
    gl.domElement.parentElement!.appendChild(w)
    wrapper.current = w
    label.current = l
    return () => w.remove()
  }, [gl])

  useEffect(() => {
    if (!label.current) return
    label.current.textContent = text
    label.current.classList.toggle('on', on)
  }, [text, on])

  useFrame(({ camera, size }) => {
    if (!wrapper.current) return
    anchor.current.getWorldPosition(projected).project(camera) // to normalised device coords (-1..1)
    const x = ((projected.x + 1) / 2) * size.width
    const y = ((1 - projected.y) / 2) * size.height
    wrapper.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
  })

  return <group ref={anchor} position={position} />
}
