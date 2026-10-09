import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// Wall and floor finishes, painted with the 2D canvas API in light greys. The material's
// colour multiplies over them, so one texture serves every colour you pick:
// "brick" + terracotta and "brick" + sage are the same image, tinted.

export type WallPattern = 'paint' | 'stripes' | 'floral' | 'brick' | 'panels' | 'tiles'
export type FloorMaterial = 'planks' | 'parquet' | 'tiles' | 'carpet' | 'concrete'

export const WALL_PATTERNS: { id: WallPattern; label: string; roughness: number }[] = [
  { id: 'paint', label: 'Paint', roughness: 0.9 },
  { id: 'stripes', label: 'Stripes', roughness: 0.85 },
  { id: 'floral', label: 'Floral', roughness: 0.85 },
  { id: 'brick', label: 'Brick', roughness: 0.95 },
  { id: 'panels', label: 'Panels', roughness: 0.7 },
  { id: 'tiles', label: 'Tiles', roughness: 0.35 },
]

export const FLOOR_MATERIALS: { id: FloorMaterial; label: string; roughness: number }[] = [
  { id: 'planks', label: 'Planks', roughness: 0.55 },
  { id: 'parquet', label: 'Parquet', roughness: 0.5 },
  { id: 'tiles', label: 'Tiles', roughness: 0.25 },
  { id: 'carpet', label: 'Carpet', roughness: 0.95 },
  { id: 'concrete', label: 'Concrete', roughness: 0.8 },
]

export const WALL_SWATCHES = ['#efe6dc', '#f4efe8', '#d9cbbd', '#c9d6c3', '#a7b8a0', '#c7d3df', '#8fa6bd', '#e8c8c0', '#d98a7a', '#b8a2c9', '#4b4a5c', '#2f3b33']
export const FLOOR_SWATCHES = ['#c8956a', '#a8754d', '#7c5236', '#e0c49b', '#d9d4cc', '#8a8f96', '#5c5f66', '#b88a8a', '#9fb3a0', '#3a3440']

/** Metres of floor covered by one texture tile (walls are always 1 m per tile). */
export const FLOOR_TILE = 2

const SIZE = 512
type Draw = (ctx: CanvasRenderingContext2D, s: number) => void

/** Seeded randomness, so every load paints exactly the same textures. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const grey = (v: number, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`

/** Draw something at (x, y) and its wrapped copies, so the texture tiles without seams. */
function wrapped(s: number, x: number, y: number, fn: (x: number, y: number) => void) {
  for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) fn(x + dx, y + dy)
}

const WALL_DRAW: Record<Exclude<WallPattern, 'paint'>, Draw> = {
  stripes: (ctx, s) => {
    ctx.fillStyle = grey(255)
    ctx.fillRect(0, 0, s, s)
    for (let x = 0; x < s; x += 128) {
      ctx.fillStyle = grey(228)
      ctx.fillRect(x, 0, 64, s)
      ctx.fillStyle = grey(212)
      ctx.fillRect(x + 62, 0, 3, s)
    }
  },
  floral: (ctx, s) => {
    ctx.fillStyle = grey(255)
    ctx.fillRect(0, 0, s, s)
    const flower = (x: number, y: number) => {
      ctx.fillStyle = grey(222)
      for (let i = 0; i < 2; i++) {
        ctx.beginPath()
        ctx.ellipse(x - 18 + i * 36, y + 22, 12, 5, i ? -0.6 : 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = grey(205)
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.ellipse(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 9, 6, a, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = grey(180)
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) wrapped(s, i * 128 + (j % 2) * 64 + 32, j * 128 + 48, flower)
  },
  brick: (ctx, s) => {
    ctx.fillStyle = grey(255) // mortar
    ctx.fillRect(0, 0, s, s)
    const rowH = 32
    const brickW = 128
    const gap = 5
    const perRow = s / brickW
    for (let row = 0; row < s / rowH; row++) {
      const offset = row % 2 ? brickW / 2 : 0
      for (let i = -1; i <= perRow; i++) {
        // Shade by the brick's wrapped index, so the half-bricks at both edges match
        const id = (((i % perRow) + perRow) % perRow) + row * perRow
        ctx.fillStyle = grey(196 + rng(id + 1)() * 44)
        ctx.fillRect(i * brickW + offset + gap / 2, row * rowH + gap / 2, brickW - gap, rowH - gap)
      }
    }
  },
  panels: (ctx, s) => {
    const n = 4
    const w = s / n
    const r = rng(5)
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = grey(228 + r() * 20)
      ctx.fillRect(i * w, 0, w, s)
      // Wavy grain lines
      for (let g = 0; g < 7; g++) {
        const gx = i * w + 8 + r() * (w - 16)
        ctx.strokeStyle = grey(200, 0.5)
        ctx.lineWidth = 1 + r()
        ctx.beginPath()
        for (let y = 0; y <= s; y += 16) ctx.lineTo(gx + Math.sin(y / 60 + g) * 3, y)
        ctx.stroke()
      }
      ctx.fillStyle = grey(170)
      ctx.fillRect(i * w, 0, 3, s) // groove
    }
  },
  tiles: (ctx, s) => {
    const t = 128
    for (let i = 0; i < s / t; i++) for (let j = 0; j < s / t; j++) {
      ctx.fillStyle = grey(240 + rng(i * 7 + j + 3)() * 15)
      ctx.fillRect(i * t, j * t, t, t)
    }
    ctx.fillStyle = grey(205) // grout, half on each edge so tiles meet seamlessly
    for (let k = 0; k <= s; k += t) {
      ctx.fillRect(k - 2, 0, 4, s)
      ctx.fillRect(0, k - 2, s, 4)
    }
  },
}

/** Per-pixel noise: independent pixels tile seamlessly by construction. */
function noise(ctx: CanvasRenderingContext2D, s: number, amount: number, seed: number) {
  const img = ctx.getImageData(0, 0, s, s)
  const r = rng(seed)
  for (let p = 0; p < img.data.length; p += 4) {
    const v = (r() - 0.5) * amount
    img.data[p] = Math.min(255, img.data[p] + v)
    img.data[p + 1] = Math.min(255, img.data[p + 1] + v)
    img.data[p + 2] = Math.min(255, img.data[p + 2] + v)
  }
  ctx.putImageData(img, 0, 0)
}

const FLOOR_DRAW: Record<FloorMaterial, Draw> = {
  // One tile = 2 m: eight 25 cm boards with staggered seams
  planks: (ctx, s) => {
    const n = 8
    const w = s / n
    const r = rng(9)
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = grey(215 + r() * 35)
      ctx.fillRect(i * w, 0, w, s)
      for (let g = 0; g < 5; g++) {
        const gx = i * w + 6 + r() * (w - 12)
        ctx.strokeStyle = grey(185, 0.45)
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let y = 0; y <= s; y += 16) ctx.lineTo(gx + Math.sin(y / 50 + g * 2) * 2, y)
        ctx.stroke()
      }
      ctx.fillStyle = grey(150)
      ctx.fillRect(i * w, 0, 2, s) // gap between boards
      const seam = r() * s
      ctx.fillRect(i * w, seam, w, 2) // board ends
      ctx.fillRect(i * w, (seam + s / 2) % s, w, 2)
    }
  },
  // Basket weave: 50 cm blocks of four strips, alternating direction
  parquet: (ctx, s) => {
    const b = 128
    const strip = b / 4
    for (let i = 0; i < s / b; i++) for (let j = 0; j < s / b; j++) {
      const vertical = (i + j) % 2 === 0
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = grey(205 + rng(i * 31 + j * 7 + k + 1)() * 45)
        if (vertical) ctx.fillRect(i * b + k * strip, j * b, strip, b)
        else ctx.fillRect(i * b, j * b + k * strip, b, strip)
        ctx.fillStyle = grey(160)
        if (vertical) ctx.fillRect(i * b + k * strip, j * b, 1.5, b)
        else ctx.fillRect(i * b, j * b + k * strip, b, 1.5)
      }
    }
  },
  // 50 cm checkerboard
  tiles: (ctx, s) => {
    const t = 128
    for (let i = 0; i < s / t; i++) for (let j = 0; j < s / t; j++) {
      ctx.fillStyle = (i + j) % 2 ? grey(212) : grey(248)
      ctx.fillRect(i * t, j * t, t, t)
    }
    ctx.fillStyle = grey(185)
    for (let k = 0; k <= s; k += t) {
      ctx.fillRect(k - 1.5, 0, 3, s)
      ctx.fillRect(0, k - 1.5, s, 3)
    }
  },
  carpet: (ctx, s) => {
    ctx.fillStyle = grey(232)
    ctx.fillRect(0, 0, s, s)
    noise(ctx, s, 46, 3)
  },
  concrete: (ctx, s) => {
    ctx.fillStyle = grey(225)
    ctx.fillRect(0, 0, s, s)
    const r = rng(17)
    for (let i = 0; i < 40; i++) {
      const [x, y, rad, v] = [r() * s, r() * s, 20 + r() * 70, 200 + r() * 45]
      wrapped(s, x, y, (cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
        g.addColorStop(0, grey(v, 0.35))
        g.addColorStop(1, grey(v, 0))
        ctx.fillStyle = g
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
      })
    }
    noise(ctx, s, 18, 23)
  },
}

const canvases = new Map<string, HTMLCanvasElement>()
const textures = new Map<string, CanvasTexture>()
const previews = new Map<string, string>()

function canvasFor(key: string, draw: Draw) {
  let c = canvases.get(key)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = SIZE
    draw(c.getContext('2d', { willReadFrequently: true })!, SIZE)
    canvases.set(key, c)
  }
  return c
}

function textureFor(key: string, draw: Draw) {
  let t = textures.get(key)
  if (!t) {
    t = new CanvasTexture(canvasFor(key, draw))
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    textures.set(key, t)
  }
  return t
}

function previewFor(key: string, draw: Draw) {
  let url = previews.get(key)
  if (!url) {
    url = canvasFor(key, draw).toDataURL('image/png')
    previews.set(key, url)
  }
  return url
}

/** Shared by every wall with this pattern. Wall UVs are in metres, so no repeat is needed. */
export const wallTexture = (p: WallPattern) => (p === 'paint' ? null : textureFor(`wall-${p}`, WALL_DRAW[p]))
export const floorTexture = (m: FloorMaterial) => textureFor(`floor-${m}`, FLOOR_DRAW[m])

/** Data URLs for the swatch tiles in the HUD (the same images, so previews match the room). */
export const wallPreview = (p: WallPattern) => (p === 'paint' ? null : previewFor(`wall-${p}`, WALL_DRAW[p]))
export const floorPreview = (m: FloorMaterial) => previewFor(`floor-${m}`, FLOOR_DRAW[m])
