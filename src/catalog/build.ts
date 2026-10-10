import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, type MeshStandardMaterialParameters } from 'three'

// Shared building blocks for code-built items (procedural.ts, packs.ts).
// Convention matches the models: front faces +z, and named materials become recolour slots.

// Materials whose look comes from a picture or transparency, not a colour you'd pick
const FIXED = new Set(['glass', 'screen', 'art', 'water'])

export function mat(name: string, params: MeshStandardMaterialParameters) {
  const m = new MeshStandardMaterial({ roughness: 0.55, ...params })
  m.name = name
  if (FIXED.has(name)) m.userData.noRecolor = true
  return m
}

export function box(parent: Group, w: number, h: number, d: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0) {
  const m = new Mesh(new BoxGeometry(w, h, d), material)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}

const textures = new Map<string, CanvasTexture>()

/** Paint a texture once with the 2D canvas API, then share it between every instance. */
export function painted(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  let t = textures.get(key)
  if (!t) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    draw(canvas.getContext('2d')!, w, h)
    t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    textures.set(key, t)
  }
  return t
}

/** An upright cylinder (or a cone, with a different top radius). */
export function cyl(parent: Group, rTop: number, rBottom: number, h: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0, segments = 20) {
  const m = new Mesh(new CylinderGeometry(rTop, rBottom, h, segments), material)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}
