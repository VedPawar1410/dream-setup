import type { CameraControlsImpl } from '@react-three/drei'
import type { PerspectiveCamera } from 'three'
import { useRoom } from '../store/roomStore'
import { gsap } from './gsap'

/**
 * Intro progress lives in a plain object. GSAP writes to it and the scene reads it
 * every frame in useFrame. This is the bridge between GSAP's timeline and the render
 * loop: no React state, so no re-renders while the intro plays.
 */
export const intro = {
  room: { p: 0 },
  // One entry per wall, in the order north, east, south, west. 0 = flat, 1 = full height.
  walls: [{ h: 0 }, { h: 0 }, { h: 0 }, { h: 0 }],
}

export const HOME = { azimuth: Math.PI / 4, polar: 1.0 }

/**
 * Home distance depends on the screen: a portrait phone needs the camera much further
 * back than a wide monitor. Fitting the room's bounding sphere covers both FOVs and
 * every orbit angle. On landscape screens we trim the sphere's slack (the room's corners
 * never all touch the screen edges at once); on portrait the room's diagonal spans the
 * narrow width, so it needs the full fit.
 */
export function homeDistance(controls: CameraControlsImpl) {
  const { width, depth, height } = useRoom.getState().doc.shell
  const radius = Math.hypot(width, depth, height) / 2
  const camera = controls.camera as PerspectiveCamera
  return controls.getDistanceToFitSphere(radius) * (camera.aspect < 1 ? 1 : 0.85)
}

// The first frames stall while the GPU compiles shaders. A timeline started on mount
// would play "through" that stall and you'd miss most of it, so every intro (3D and
// HUD) waits for this signal, fired once the scene has actually rendered.
let markReady!: () => void
export const sceneReady = new Promise<void>((resolve) => (markReady = resolve))
export { markReady }

export function playIntro(controls: CameraControlsImpl) {
  const home = { ...HOME, distance: homeDistance(controls) }
  const cam = { azimuth: HOME.azimuth - 1.4, polar: 0.3, distance: home.distance * 1.7 }
  const applyCam = () => {
    controls.rotateTo(cam.azimuth, cam.polar, false)
    controls.dollyTo(cam.distance, false)
  }
  applyCam()
  controls.enabled = false

  const tl = gsap.timeline({ paused: true, onComplete: () => void (controls.enabled = true) })
  tl.to(intro.room, { p: 1, duration: 1.4, ease: 'expo.out' }, 0)
    .to(cam, { ...home, duration: 2.8, ease: 'power3.inOut', onUpdate: applyCam }, 0)
    .to(intro.walls, { h: 1, duration: 1.2, ease: 'power3.out', stagger: 0.14 }, 0.6)
  return tl
}
