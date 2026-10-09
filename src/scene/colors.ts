import { Color, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'

// Recolouring is by material *name*: Kenney names its materials by what they are
// ("wood", "carpet", "metalDark"), and every mesh sharing a name shares a colour slot.

const LABELS: Record<string, string> = {
  wood: 'Wood',
  woodDark: 'Dark wood',
  metal: 'Metal',
  metalDark: 'Dark metal',
  metalMedium: 'Grey metal',
  metalLight: 'Light metal',
  carpet: 'Fabric',
  carpetWhite: 'Light fabric',
  carpetDarker: 'Dark fabric',
  carpetBlue: 'Blue fabric',
  plant: 'Leaves',
  lamp: 'Lampshade',
  fur: 'Fur',
  glass: 'Glass',
  _defaultMat: 'Handles',
  // Code-built items
  case: 'Case',
  board: 'Motherboard',
  gpu: 'Graphics card',
  rgb: 'RGB lighting',
  frame: 'Frame',
  mat: 'Mat',
  bracket: 'Brackets',
}

export type Slot = { name: string; label: string; color: string }

const pretty = (name: string) => name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

function eachMaterial(root: Object3D, fn: (mat: MeshStandardMaterial) => void) {
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) fn(mat as MeshStandardMaterial)
  })
}

const slotCache = new Map<string, Slot[]>()

/** The recolourable slots of a catalog item, with their default colours. */
export function slotsOf(catalogId: string, prototype: Object3D): Slot[] {
  let slots = slotCache.get(catalogId)
  if (!slots) {
    const seen = new Map<string, Slot>()
    eachMaterial(prototype, (mat) => {
      if (!mat.name || !mat.color || mat.userData.noRecolor || seen.has(mat.name)) return
      const glowing = mat.emissive && mat.emissive.getHex() !== 0
      seen.set(mat.name, { name: mat.name, label: LABELS[mat.name] ?? pretty(mat.name), color: `#${(glowing ? mat.emissive : mat.color).getHexString()}` })
    })
    slots = [...seen.values()]
    slotCache.set(catalogId, slots)
  }
  return slots
}

const tmp = new Color()

/**
 * Apply an item's colour overrides; slots without one go back to the model's own colour.
 * Glowing parts (the PC's RGB) recolour their light, not just their base colour.
 */
export function applyColors(root: Object3D, colors: Record<string, string> | undefined) {
  eachMaterial(root, (mat) => {
    if (!mat.color || mat.userData.noRecolor) return
    mat.userData.baseColor ??= mat.color.clone()
    const hex = colors?.[mat.name]
    const glow: Color | null = mat.userData.glow ?? null
    if (glow) {
      const light = hex ? tmp.set(hex) : glow
      mat.emissive.copy(light)
      // looks.ts restores emissive from its own snapshot, so keep that in step, and the
      // RGB cycle returns here when it stops
      mat.userData.base?.emissive.copy(light)
      mat.userData.rgbRest = light.clone()
    } else {
      mat.color.copy(hex ? tmp.set(hex) : mat.userData.baseColor)
    }
  })
}
