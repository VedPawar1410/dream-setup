import type { CameraControlsImpl } from '@react-three/drei'
import { useRoom } from '../store/roomStore'
import { whoosh } from '../audio/sound'
import { gsap, reducedMotion } from './gsap'

/**
 * Intro progress lives in a plain object. GSAP writes to it and the scene reads it
 * every frame in useFrame. This is the bridge between GSAP's timeline and the render
 * loop: no React state, so no re-renders while the intro plays.
 */
export const intro = {
  room: { p: 0 },
  // One entry per wall, in the order north, east, south, west. 0 = flat, 1 = full height.
  walls: [{ h: 0 }, { h: 0 }, { h: 0 }, { h: 0 }],
  /** Camera moves that would fight the intro's swoop wait for this. */
  done: false,
}

export const HOME = { azimuth: Math.PI / 4, polar: 1.0 }

/**
 * Home distance depends on the screen: a portrait phone needs the camera much further
 * back than a wide monitor. Fitting the room's bounding sphere covers both FOVs and
 * every orbit angle. The extra 15% leaves breathing room for the HUD at the top and bottom.
 */
export function homeDistance(controls: CameraControlsImpl) {
  const { width, depth, height } = useRoom.getState().doc.shell
  const radius = Math.hypot(width, depth, height) / 2
  return controls.getDistanceToFitSphere(radius) * 1.15
}

// The first frames stall while the GPU compiles shaders. A timeline started on mount
// would play "through" that stall and you'd miss most of it, so every intro (3D and
// HUD) waits for this signal, fired once the scene has actually rendered.
let markReady!: () => void
export const sceneReady = new Promise<void>((resolve) => (markReady = resolve))
export { markReady }

/**
 * Switching rooms: the walls sink and the room drops away, `apply` swaps the document at
 * the low point, then the new room rises the same way it did on first load.
 */
export function playRoomSwap(apply: () => void) {
  whoosh(0.5, false, 0.16)
  return gsap
    .timeline()
    .to(intro.walls, { h: 0, duration: 0.35, ease: 'power2.in', stagger: 0.04 })
    .to(intro.room, { p: 0, duration: 0.35, ease: 'power2.in' }, 0.1)
    .add(apply)
    .add(() => whoosh(0.9, true, 0.16))
    .to(intro.room, { p: 1, duration: 0.9, ease: 'expo.out' })
    .to(intro.walls, { h: 1, duration: 0.8, ease: 'power3.out', stagger: 0.1 }, '-=0.65')
}

export function playIntro(controls: CameraControlsImpl) {
  const home = { ...HOME, distance: homeDistance(controls) }
  // With reduced motion the camera starts where it ends, and only the room rises into place
  const cam = reducedMotion ? { ...home } : { azimuth: HOME.azimuth - 1.4, polar: 0.3, distance: home.distance * 1.7 }
  const applyCam = () => {
    controls.rotateTo(cam.azimuth, cam.polar, false)
    controls.dollyTo(cam.distance, false)
  }
  applyCam()
  controls.enabled = false

  const tl = gsap.timeline({
    onComplete: () => {
      controls.enabled = true
      intro.done = true
    },
  })
  tl.to(intro.room, { p: 1, duration: 1.4, ease: 'expo.out' }, 0)
    .to(cam, { ...home, duration: 2.8, ease: 'power3.inOut', onUpdate: applyCam }, 0)
    .to(intro.walls, { h: 1, duration: 1.2, ease: 'power3.out', stagger: 0.14 }, 0.6)
  return tl
}
