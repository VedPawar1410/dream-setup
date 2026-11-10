import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { ACCENT } from './dimensions'

export type Look = 'normal' | 'hover' | 'selected' | 'ghost' | 'ghost-bad'

// Highlights are an emissive tint (the material glows faintly), so they work on any
// model without an outline pass. Ghosts are see-through as well.
const TINT: Record<Exclude<Look, 'normal'>, Color> = {
  hover: new Color(ACCENT).multiplyScalar(0.14),
  selected: new Color(ACCENT).multiplyScalar(0.4),
  ghost: new Color(ACCENT).multiplyScalar(0.4),
  'ghost-bad': new Color('#ff6b81').multiplyScalar(0.55),
}

type Base = { emissive: Color; intensity: number; transparent: boolean; opacity: number; depthWrite: boolean }

const materialsOf = (m: Mesh): Material[] => (Array.isArray(m.material) ? m.material : [m.material])

// Materials of the selected item. Their glow "breathes" so the selection is easy to spot;
// only these few materials are touched each frame.
const pulsing = new Set<MeshStandardMaterial>()
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Called every frame: glow between 0.7x and 1.3x, one breath every ~1.6 s. */
export function pulseSelected(seconds: number) {
  if (calm || pulsing.size === 0) return
  const k = 1 + 0.3 * Math.sin(seconds * 4)
  for (const mat of pulsing) mat.emissiveIntensity = k
}

export function applyLook(root: Object3D, look: Look) {
  const ghost = look === 'ghost' || look === 'ghost-bad'
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const mat of materialsOf(mesh) as MeshStandardMaterial[]) {
      if (!mat.emissive) continue
      // Remember the material's own look the first time, so "normal" can restore it
      const base: Base = (mat.userData.base ??= {
        emissive: mat.emissive.clone(),
        intensity: mat.emissiveIntensity,
        transparent: mat.transparent,
        opacity: mat.opacity,
        depthWrite: mat.depthWrite,
      })
      // Parts that already glow (screens, RGB) keep their own light
      const glowing = base.emissive.getHex() !== 0
      pulsing.delete(mat)
      if (look === 'normal' || glowing) {
        mat.emissive.copy(base.emissive)
        mat.emissiveIntensity = base.intensity
      } else {
        mat.emissive.copy(TINT[look])
        mat.emissiveIntensity = 1
        if (look === 'selected') pulsing.add(mat)
      }
      mat.transparent = ghost || base.transparent
      mat.opacity = ghost ? Math.min(base.opacity, 0.6) : base.opacity
      mat.depthWrite = ghost ? false : base.depthWrite
    }
  })
}
