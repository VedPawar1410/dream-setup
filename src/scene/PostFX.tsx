import { useFrame } from '@react-three/fiber'
import { Bloom, BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, N8AO, Noise, Sepia, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import {
  BlendFunction,
  ToneMappingMode,
  type BrightnessContrastEffect,
  type DepthOfFieldEffect,
  type HueSaturationEffect,
  type NoiseEffect,
  type SepiaEffect,
  type VignetteEffect,
} from 'postprocessing'
import { useRef } from 'react'
import { useUi } from '../store/uiStore'
import { focusPoint, photoFx } from './photo'

// Order matters: lighting effects run in linear HDR, then tone mapping, then the
// display-space effects (colour grading, anti-aliasing, vignette, grain).
export default function PostFX() {
  const photo = useUi((s) => s.photo)
  const hueSat = useRef<HueSaturationEffect>(null)
  const brightCon = useRef<BrightnessContrastEffect>(null)
  const sepia = useRef<SepiaEffect>(null)
  const vignette = useRef<VignetteEffect>(null)
  const grain = useRef<NoiseEffect>(null)
  const dof = useRef<DepthOfFieldEffect>(null)

  // Photo filters live in a plain object that GSAP tweens; the effects follow it every frame.
  // At "natural" these effects are neutral, so normal play looks exactly as before.
  useFrame(() => {
    if (hueSat.current) {
      hueSat.current.hue = photoFx.hue
      hueSat.current.saturation = photoFx.saturation
    }
    if (brightCon.current) {
      brightCon.current.brightness = photoFx.brightness
      brightCon.current.contrast = photoFx.contrast
    }
    if (sepia.current) sepia.current.intensity = photoFx.sepia
    if (vignette.current) vignette.current.darkness = photoFx.vignette
    if (grain.current) grain.current.blendMode.opacity.value = photoFx.grain
    if (dof.current) {
      dof.current.bokehScale = photoFx.bokeh
      dof.current.target = focusPoint
    }
  })

  return (
    // MSAA off: N8AO reads the depth buffer, and SMAA handles edges after tone mapping.
    <EffectComposer multisampling={0}>
      {/* Ambient occlusion: the soft contact darkening in corners and under objects
          that makes a room look grounded */}
      <N8AO halfRes quality="medium" aoRadius={0.5} distanceFalloff={0.6} intensity={2.2} />
      {/* Depth of field is an expensive extra pass, so it only exists in photo mode */}
      {photo && <DepthOfField ref={dof} target={focusPoint} focalLength={0.03} bokehScale={0} />}
      {/* Threshold 1: only HDR emissives bloom (RGB strips, screens, lamps) */}
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.6} />
      {/* EffectComposer turns off the renderer's own tone mapping, so it must happen here.
          AgX keeps bright colours from going neon or flat. */}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation ref={hueSat} />
      <BrightnessContrast ref={brightCon} />
      <Sepia ref={sepia} intensity={0} />
      <SMAA />
      <Vignette ref={vignette} offset={0.3} darkness={0.45} />
      <Noise ref={grain} premultiply blendFunction={BlendFunction.OVERLAY} opacity={0} />
    </EffectComposer>
  )
}
