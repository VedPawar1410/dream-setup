import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, Vector3 } from 'three'
import { useGSAP } from '../anim/gsap'
import { HOME, markReady, playIntro } from '../anim/intro'
import { useRoom } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { registerControls, resetView, rotateQuarter } from './camera'

const { ACTION } = CameraControlsImpl

const itemInHand = () => {
  const ui = useUi.getState()
  return ui.mode === 'decorate' && (ui.carryItem !== null || ui.selectedItemId !== null)
}
const PAN_SPEED = 4 // metres per second

// Movement keys by KeyboardEvent.code, which is layout-independent (WASD on AZERTY too).
const MOVE: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

export default function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null!)
  const held = useRef(new Set<string>())
  const { width, depth } = useRoom((s) => s.doc.shell)

  useEffect(() => {
    registerControls(ref.current)
    return () => registerControls(null)
  }, [])

  // Keep the orbit target over the room so you can't pan off into the void.
  useEffect(() => {
    ref.current.setBoundary(new Box3(new Vector3(-width / 2, 0, -depth / 2), new Vector3(width / 2, 1.5, depth / 2)))
  }, [width, depth])

  const framesRendered = useRef(0)

  // The intro is built only once a few frames have rendered: by then the canvas has its
  // real size, so the camera's end distance (which depends on aspect ratio) is right.
  // contextSafe ties the timeline to this component, so unmounting still reverts it.
  const { contextSafe } = useGSAP()
  const startIntro = contextSafe((controls: CameraControlsImpl) => {
    playIntro(controls)
  })

  // Until then, hold a far-off pose so the first frames don't flash a default view
  useEffect(() => {
    const c = ref.current
    c.rotateTo(HOME.azimuth - 1.4, 0.3, false)
    c.dollyTo(30, false)
    c.enabled = false
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey) return // shortcuts like Cmd+D aren't movement
      if (e.code in MOVE) held.current.add(e.code)
      else if (e.code === 'KeyQ') rotateQuarter(-1)
      else if (e.code === 'KeyE') rotateQuarter(1)
      else if (e.code === 'KeyR' && !itemInHand()) resetView() // in decorate mode R rotates the item instead
    }
    const up = (e: KeyboardEvent) => held.current.delete(e.code)
    const clear = () => held.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear) // otherwise alt-tabbing mid-press leaves a key "stuck"
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // Continuous input goes in the frame loop and is scaled by delta, so speed is the
  // same at 60Hz and 144Hz. GSAP is for discrete, authored moments instead.
  useFrame((_, delta) => {
    // A few rendered frames means the shader-compile stall is behind us
    if (framesRendered.current < 3 && ++framesRendered.current === 3) {
      startIntro(ref.current)
      markReady()
    }

    const controls = ref.current
    if (!controls.enabled || held.current.size === 0) return
    let x = 0
    let z = 0
    for (const code of held.current) {
      x += MOVE[code][0]
      z += MOVE[code][1]
    }
    const step = PAN_SPEED * Math.min(delta, 0.05)
    controls.truck(x * step, 0, true)
    controls.forward(z * step, true)
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={3.5}
      maxDistance={40}
      minPolarAngle={0.2}
      maxPolarAngle={1.35}
      smoothTime={0.3}
      draggingSmoothTime={0.12}
      dollySpeed={0.5}
      // Left-drag orbits; right/middle pans. Phase 3 will pause controls while an item is dragged.
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.TRUCK, right: ACTION.TRUCK, wheel: ACTION.DOLLY }}
    />
  )
}
