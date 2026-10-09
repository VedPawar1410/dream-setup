import { Color, Vector3 } from 'three'
import { gsap } from '../anim/gsap'

export type Weather = 'sunny' | 'sunset' | 'rain' | 'snow' | 'night'

/** Everything a weather mood controls. Colours are sRGB hex in, linear inside three.js. */
type Values = {
  sunColor: Color
  sunIntensity: number
  sunPos: Vector3
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  fill: number // warm interior fill light
  env: number // reflection (environment) intensity
  bgInner: Color // backdrop gradient around the diorama
  bgOuter: Color
  skyTop: Color // the view through the windows
  skyBottom: Color
  hillsFar: Color
  hills: Color
  disc: Color // sun or moon in the window view
  discY: number
  stars: number
  rain: number
  snow: number
  viewGlow: number // brightness of the window view
  lamps: number // how strongly lamps glow and light the room
}

const c = (hex: string) => new Color(hex)
const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

export const PRESETS: Record<Weather, Values> = {
  sunny: {
    sunColor: c('#ffe2b8'), sunIntensity: 3.4, sunPos: v(3.5, 6.5, -7),
    hemiSky: c('#dfe8ff'), hemiGround: c('#7a5c48'), hemiIntensity: 0.9, fill: 2.5, env: 0.45,
    bgInner: c('#3d3352'), bgOuter: c('#17121f'),
    skyTop: c('#5ea8ff'), skyBottom: c('#cfe8ff'), hillsFar: c('#88b48f'), hills: c('#4f8a5b'),
    disc: c('#fff6d8'), discY: 0.82, stars: 0, rain: 0, snow: 0, viewGlow: 1.2, lamps: 0.35,
  },
  sunset: {
    sunColor: c('#ff9a5c'), sunIntensity: 2.6, sunPos: v(-5, 2.6, -7),
    hemiSky: c('#ffb98f'), hemiGround: c('#5a3f52'), hemiIntensity: 0.65, fill: 2.2, env: 0.35,
    bgInner: c('#5c3a57'), bgOuter: c('#1d1220'),
    skyTop: c('#4b3a8a'), skyBottom: c('#ff9e6b'), hillsFar: c('#7a4a6b'), hills: c('#3d2a4d'),
    disc: c('#ffd27a'), discY: 0.4, stars: 0.15, rain: 0, snow: 0, viewGlow: 1.1, lamps: 0.6,
  },
  rain: {
    sunColor: c('#b9c6d9'), sunIntensity: 0.7, sunPos: v(2, 7, -6),
    hemiSky: c('#a9b7c9'), hemiGround: c('#4a4f5a'), hemiIntensity: 0.75, fill: 2.0, env: 0.3,
    bgInner: c('#2e3746'), bgOuter: c('#10141b'),
    skyTop: c('#5d6b7e'), skyBottom: c('#9aa7b6'), hillsFar: c('#64716f'), hills: c('#3e4d48'),
    disc: c('#000000'), discY: 0.9, stars: 0, rain: 1, snow: 0, viewGlow: 0.9, lamps: 0.75,
  },
  snow: {
    sunColor: c('#e8f0ff'), sunIntensity: 1.6, sunPos: v(3, 6, -7),
    hemiSky: c('#eef4ff'), hemiGround: c('#8a94a6'), hemiIntensity: 1.0, fill: 2.0, env: 0.5,
    bgInner: c('#4b5568'), bgOuter: c('#161a24'),
    skyTop: c('#a9bbd6'), skyBottom: c('#e7eef8'), hillsFar: c('#d5deea'), hills: c('#f2f5fa'),
    disc: c('#ffffff'), discY: 0.75, stars: 0, rain: 0, snow: 1, viewGlow: 1.1, lamps: 0.55,
  },
  night: {
    sunColor: c('#7f93ff'), sunIntensity: 0.45, sunPos: v(-3, 7, -6),
    hemiSky: c('#2b3566'), hemiGround: c('#1b1424'), hemiIntensity: 0.35, fill: 0.5, env: 0.15,
    bgInner: c('#1a2140'), bgOuter: c('#06070d'),
    skyTop: c('#060a1f'), skyBottom: c('#1c2a5a'), hillsFar: c('#141c38'), hills: c('#0b0f1e'),
    disc: c('#e8ecff'), discY: 0.78, stars: 1, rain: 0, snow: 0, viewGlow: 1.0, lamps: 1.0,
  },
}

type Key = keyof Values

function clone(p: Values): Values {
  const out = {} as Record<Key, unknown>
  for (const k of Object.keys(p) as Key[]) {
    const val = p[k]
    out[k] = val instanceof Color || val instanceof Vector3 ? val.clone() : val
  }
  return out as Values
}

function blend(out: Values, a: Values, b: Values, t: number) {
  const o = out as Record<Key, unknown>
  for (const k of Object.keys(out) as Key[]) {
    const x = a[k]
    const y = b[k]
    if (x instanceof Color) (o[k] as Color).lerpColors(x, y as Color, t)
    else if (x instanceof Vector3) (o[k] as Vector3).lerpVectors(x, y as Vector3, t)
    else o[k] = (x as number) + ((y as number) - (x as number)) * t
  }
}

/**
 * The live atmosphere every system renders from: lights, backdrop, window view,
 * particles, lamps. One tween blends it between presets, so a weather change is a
 * single coordinated transition rather than a dozen tweens that could drift apart.
 */
export const atmo: Values = clone(PRESETS.sunny)

/** Bumped whenever `atmo` changes, so expensive consumers (the backdrop canvas) redraw only then. */
export const atmoVersion = { v: 0 }

const mix = { t: 1 }

export function setAtmosphere(weather: Weather, instant = false) {
  const to = PRESETS[weather]
  if (instant) {
    blend(atmo, to, to, 1)
    atmoVersion.v++
    return
  }
  // Start from wherever we are, even mid-transition
  const from = clone(atmo)
  gsap.fromTo(
    mix,
    { t: 0 },
    {
      t: 1,
      duration: 2,
      ease: 'power2.inOut',
      overwrite: true,
      onUpdate: () => {
        blend(atmo, from, to, mix.t)
        atmoVersion.v++
      },
    },
  )
}
