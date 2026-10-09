import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// Order matters: lighting effects run in linear HDR, then tone mapping, then the
// display-space effects (anti-aliasing, vignette).
export default function PostFX() {
  return (
    // MSAA off: N8AO reads the depth buffer, and SMAA handles edges after tone mapping.
    <EffectComposer multisampling={0}>
      {/* Ambient occlusion: the soft contact darkening in corners and under objects
          that makes a room look grounded */}
      <N8AO halfRes quality="medium" aoRadius={0.5} distanceFalloff={0.6} intensity={2.2} />
      {/* Threshold 1: only HDR emissives bloom (RGB strips, screens and lamps in later phases) */}
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.6} />
      {/* EffectComposer turns off the renderer's own tone mapping, so it must happen here.
          AgX keeps bright colours from going neon or flat. */}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
  )
}
