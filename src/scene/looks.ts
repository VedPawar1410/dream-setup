import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'

export type Look = 'normal' | 'hover' | 'selected' | 'ghost' | 'ghost-bad'

// Highlights are an emissive tint (the material glows faintly), so they work on any
// model without an outline pass. Ghosts are see-through as well.
const TINT: Record<Exclude<Look, 'normal'>, Color> = {
  hover: new Color('#b18cff').multiplyScalar(0.14),
  selected: new Color('#b18cff').multiplyScalar(0.32),
  ghost: new Color('#b18cff').multiplyScalar(0.4),
  'ghost-bad': new Color('#ff6b81').multiplyScalar(0.55),
}

type Base = { emissive: Color; intensity: number; transparent: boolean; opacity: number; depthWrite: boolean }

const materialsOf = (m: Mesh): Material[] => (Array.isArray(m.material) ? m.material : [m.material])

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
      if (look === 'normal' || glowing) {
        mat.emissive.copy(base.emissive)
        mat.emissiveIntensity = base.intensity
      } else {
        mat.emissive.copy(TINT[look])
        mat.emissiveIntensity = 1
      }
      mat.transparent = ghost || base.transparent
      mat.opacity = ghost ? Math.min(base.opacity, 0.6) : base.opacity
      mat.depthWrite = ghost ? false : base.depthWrite
    }
  })
}
