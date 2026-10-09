import type { CameraControlsImpl } from '@react-three/drei'
import { HOME, homeDistance } from '../anim/intro'

// The HUD lives outside <Canvas>, which is a separate React renderer, so React context
// can't reach across. A tiny module-level handle is the simplest bridge.
let controls: CameraControlsImpl | null = null

export function registerControls(c: CameraControlsImpl | null) {
  controls = c
}

const QUARTER = Math.PI / 2

/** Turn 90° and always land on a corner view (45° + k·90°), so two walls stay visible. */
export function rotateQuarter(dir: 1 | -1) {
  if (!controls) return
  const step = Math.round((controls.azimuthAngle - Math.PI / 4) / QUARTER) + dir
  controls.rotateAzimuthTo(Math.PI / 4 + step * QUARTER, true)
}

export function resetView() {
  if (!controls) return
  // Keep the azimuth's whole turns, so the camera doesn't spin back through every lap.
  const turns = Math.round((controls.azimuthAngle - HOME.azimuth) / (Math.PI * 2))
  controls.rotateTo(HOME.azimuth + turns * Math.PI * 2, HOME.polar, true)
  controls.dollyTo(homeDistance(controls), true)
  controls.moveTo(0, 0.6, 0, true)
}

/** Pause mouse orbiting, e.g. while the pointer is on something draggable. */
export function setCameraLocked(locked: boolean) {
  if (controls) controls.enabled = !locked
}

/**
 * Blueprint mode looks down more steeply, like a floor plan, and backs off a little so
 * the resize handles outside the walls stay in frame. Leaving it returns to the home framing.
 */
export function setBlueprintView(on: boolean) {
  if (!controls) return
  controls.rotatePolarTo(on ? 0.62 : HOME.polar, true)
  controls.dollyTo(homeDistance(controls) * (on ? 1.3 : 1), true)
  controls.moveTo(0, on ? 0 : 0.6, 0, true)
}
