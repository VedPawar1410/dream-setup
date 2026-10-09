import { Vector3 } from 'three'
import { gsap } from '../anim/gsap'
import { useUi } from '../store/uiStore'
import { setMode } from './blueprintActions'

// Photo filters are a handful of always-on post-processing effects whose values come
// from this object every frame. Switching filters tweens the numbers, so looks cross-fade.

export type Filter = 'natural' | 'warm' | 'cool' | 'mono' | 'vintage' | 'dreamy'

type Fx = { hue: number; saturation: number; brightness: number; contrast: number; sepia: number; vignette: number; grain: number }

const PRESETS: Record<Filter, Fx> = {
  natural: { hue: 0, saturation: 0, brightness: 0, contrast: 0, sepia: 0, vignette: 0.45, grain: 0 },
  warm: { hue: -0.04, saturation: 0.12, brightness: 0.03, contrast: 0.04, sepia: 0.22, vignette: 0.5, grain: 0 },
  cool: { hue: 0.1, saturation: -0.08, brightness: 0, contrast: 0.06, sepia: 0, vignette: 0.5, grain: 0 },
  mono: { hue: 0, saturation: -1, brightness: 0.02, contrast: 0.18, sepia: 0, vignette: 0.6, grain: 0.12 },
  vintage: { hue: 0, saturation: -0.2, brightness: 0.02, contrast: -0.08, sepia: 0.6, vignette: 0.85, grain: 0.3 },
  dreamy: { hue: 0.03, saturation: 0.18, brightness: 0.06, contrast: -0.15, sepia: 0.05, vignette: 0.55, grain: 0 },
}

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'mono', label: 'Mono' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'dreamy', label: 'Dreamy' },
]

/** Live values the post-processing reads every frame. `bokeh` is the depth-of-field strength. */
export const photoFx = { ...PRESETS.natural, bokeh: 0 }

/** The world point the depth of field keeps sharp; click the scene in photo mode to move it. */
export const focusPoint = new Vector3(0, 0.6, 0)

export function setFilter(filter: Filter) {
  useUi.setState({ photoFilter: filter })
  // overwrite: 'auto' only cancels tweens of the same properties, so blur keeps its own tween
  gsap.to(photoFx, { ...PRESETS[filter], duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
}

export function setBokeh(value: number) {
  useUi.setState({ photoBokeh: value })
  gsap.to(photoFx, { bokeh: value, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
}

export function enterPhoto() {
  if (useUi.getState().photo) return
  setMode('view')
  useUi.setState({ photo: true })
  setFilter(useUi.getState().photoFilter)
  setBokeh(useUi.getState().photoBokeh)
}

/** Leaving photo mode returns the normal view to its unfiltered look. */
export function exitPhoto() {
  if (!useUi.getState().photo) return
  useUi.setState({ photo: false })
  gsap.to(photoFx, { ...PRESETS.natural, bokeh: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
}

export const togglePhoto = () => (useUi.getState().photo ? exitPhoto() : enterPhoto())
