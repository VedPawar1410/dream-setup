import { CameraControlsImpl } from '@react-three/drei'
import { Box3, MathUtils, Vector3, type PerspectiveCamera } from 'three'
import { gsap, reducedMotion } from '../anim/gsap'
import { whoosh } from '../audio/sound'
import { HOME, homeDistance } from '../anim/intro'
import { useRoom } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { setMode } from './blueprintActions'
import { getControls } from './camera'
import { worldYaw } from './placementSolver'
import { itemObjects } from './sceneRefs'

// "Sit at your desk": the camera flies down an arc to eye height on a chair, then the
// orbit controls are reconfigured into look-around controls. Leaving reverses all of it.

// Where your eyes go on each kind of seat: height above the floor, and how far back from
// the seat's centre. A racing cockpit sits low and reclined; everything else is a chair.
const EYES: Record<string, { height: number; back: number }> = { simRig: { height: 0.98, back: 0.38 } }
const CHAIR_EYES = { height: 1.18, back: 0.12 }
const SEATS = ['chairDesk', 'simRig', 'chair', 'chairCushion', 'chairModernCushion', 'chairRounded', 'loungeChair', 'loungeChairRelax', 'loungeDesignChair', 'stoolBar', 'benchCushion']
const { ACTION } = CameraControlsImpl
// The dollhouse uses a narrow lens to look isometric; eyes see much wider than that
const ORBIT_FOV = 30
const SEATED_FOV = 62

let saved: { minDistance: number; maxDistance: number; minPolar: number; maxPolar: number; buttons: CameraControlsImpl['mouseButtons'] } | null = null
let flying = false

/** Where to put your eyes: on the first chair found (the office chair preferred), else standing by the far wall. */
function seat() {
  const { items, shell } = useRoom.getState().doc
  for (const catalogId of SEATS) {
    const chair = items.find((it) => it.catalogId === catalogId && !it.parentId && !it.wall)
    const obj = chair && itemObjects.get(chair.id)
    if (!obj) continue
    const base = obj.getWorldPosition(new Vector3())
    const yaw = worldYaw(obj)
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)) // models face +z
    const { height, back } = EYES[catalogId] ?? CHAIR_EYES
    const eye = base.add(new Vector3(0, height, 0)).addScaledVector(forward, -back) // seated eye height, head over the backrest
    return { eye, look: eye.clone().addScaledVector(forward, 2).add(new Vector3(0, -0.35, 0)) }
  }
  const eye = new Vector3(0, 1.6, shell.depth / 2 - 0.6)
  return { eye, look: new Vector3(0, 1.3, -shell.depth / 2) }
}

/** Fly the camera along a gentle arc (it lifts mid-flight) to a new position, target and lens. */
function fly(c: CameraControlsImpl, toPos: Vector3, toTarget: Vector3, toFov: number, duration: number, onComplete: () => void) {
  const camera = c.camera as PerspectiveCamera
  const fromFov = camera.fov
  const fromPos = c.getPosition(new Vector3())
  const fromTarget = c.getTarget(new Vector3())
  const pos = new Vector3()
  const target = new Vector3()
  const s = { k: 0 }
  flying = true
  c.enabled = false
  whoosh(duration * 0.8, toFov < camera.fov) // standing up rises, sitting down falls
  gsap.to(s, {
    k: 1,
    duration: reducedMotion ? duration * 0.5 : duration,
    ease: 'power3.inOut',
    onUpdate: () => {
      pos.lerpVectors(fromPos, toPos, s.k)
      if (!reducedMotion) pos.y += Math.sin(Math.PI * s.k) * 0.6
      target.lerpVectors(fromTarget, toTarget, s.k)
      camera.fov = MathUtils.lerp(fromFov, toFov, s.k)
      camera.updateProjectionMatrix()
      c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false)
    },
    onComplete: () => {
      flying = false
      c.enabled = true
      onComplete()
    },
  })
}

export function enterFirstPerson() {
  const c = getControls()
  if (!c || flying || useUi.getState().firstPerson) return
  setMode('view')
  useUi.setState({ firstPerson: true })
  saved = { minDistance: c.minDistance, maxDistance: c.maxDistance, minPolar: c.minPolarAngle, maxPolar: c.maxPolarAngle, buttons: { ...c.mouseButtons } }
  c.setBoundary() // the orbit boundary would clamp the target as we fly in
  c.minDistance = 0.001

  const { eye, look } = seat()
  fly(c, eye, look, SEATED_FOV, 1.7, () => {
    // Look-around: put the orbit target 1 cm ahead of your eyes, so "orbiting" it is
    // turning your head. Inverted speeds make dragging feel like grabbing the view.
    const dir = look.clone().sub(eye).normalize()
    c.minDistance = c.maxDistance = 0.01
    c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x * 0.01, eye.y + dir.y * 0.01, eye.z + dir.z * 0.01, false)
    c.azimuthRotateSpeed = -0.35
    c.polarRotateSpeed = -0.35
    c.minPolarAngle = 0.5
    c.maxPolarAngle = Math.PI - 0.5
    c.mouseButtons.right = ACTION.NONE
    c.mouseButtons.middle = ACTION.NONE
    c.mouseButtons.wheel = ACTION.NONE
  })
}

export function exitFirstPerson() {
  const c = getControls()
  if (!c || flying || !useUi.getState().firstPerson || !saved) return
  const restore = saved
  // Stretch the target back out to a normal distance before flying
  const eye = c.getPosition(new Vector3())
  const dir = c.getTarget(new Vector3()).sub(eye).normalize()
  c.maxDistance = restore.maxDistance
  c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x * 2, eye.y + dir.y * 2, eye.z + dir.z * 2, false)
  c.azimuthRotateSpeed = 1
  c.polarRotateSpeed = 1
  c.minPolarAngle = restore.minPolar
  c.maxPolarAngle = restore.maxPolar
  Object.assign(c.mouseButtons, restore.buttons)
  useUi.setState({ firstPerson: false })

  // The home distance depends on the lens, so measure it with the orbit lens
  const camera = c.camera as PerspectiveCamera
  camera.fov = ORBIT_FOV
  camera.updateProjectionMatrix()
  const d = homeDistance(c)
  camera.fov = SEATED_FOV
  camera.updateProjectionMatrix()
  const target = new Vector3(0, 0.6, 0)
  const home = new Vector3(
    target.x + d * Math.sin(HOME.polar) * Math.sin(HOME.azimuth),
    target.y + d * Math.cos(HOME.polar),
    target.z + d * Math.sin(HOME.polar) * Math.cos(HOME.azimuth),
  )
  fly(c, home, target, ORBIT_FOV, 1.6, () => {
    c.minDistance = restore.minDistance
    const { width, depth } = useRoom.getState().doc.shell
    c.setBoundary(new Box3(new Vector3(-width / 2, 0, -depth / 2), new Vector3(width / 2, 1.5, depth / 2)))
    saved = null
  })
}

export const toggleFirstPerson = () => (useUi.getState().firstPerson ? exitFirstPerson() : enterFirstPerson())
