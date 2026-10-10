import { BoxGeometry, Group, Mesh, PlaneGeometry, TorusGeometry, type MeshStandardMaterial } from 'three'
import { box, mat, painted } from './build'
import type { ProceduralId } from './catalog'
import { aquarium, catTree, dogBed, pegboard, petBowls, simRig, toolbox, tripleMonitor, workbench } from './packs'

// Items built from code instead of loaded from a file: things with glowing or
// screen-like parts that the Kenney kit doesn't have. Convention matches the models:
// front faces +z, and named materials become recolour slots in Phase 4.

const ACCENT = '#b18cff'

const blade = mat('blade', { color: '#9d8fc4', roughness: 0.4, transparent: true, opacity: 0.6 })

/**
 * A glowing fan ring with three blades inside. The blades are their own group tagged
 * `spin`, so the scene can turn them while the PC is on (a lone ring looks the same at
 * every angle, so it can't show motion).
 */
function ring(parent: Group, radius: number, material: MeshStandardMaterial, x: number, y: number, z: number, faceX = false) {
  const fan = new Group()
  fan.position.set(x, y, z)
  if (faceX) fan.rotation.y = Math.PI / 2
  fan.add(new Mesh(new TorusGeometry(radius, radius * 0.11, 8, 36), material))
  const rotor = new Group()
  rotor.userData.spin = 22 // radians per second at full power
  for (let i = 0; i < 3; i++) {
    const b = new Mesh(new BoxGeometry(radius * 0.32, radius * 0.86, 0.003), blade)
    b.geometry.translate(0, radius * 0.45, 0)
    b.rotation.z = (i * Math.PI * 2) / 3
    b.rotation.y = 0.35 // pitched, like real fan blades
    rotor.add(b)
  }
  fan.add(rotor)
  parent.add(fan)
}

function pcTower() {
  const g = new Group()
  const W = 0.22, H = 0.46, D = 0.44, T = 0.012
  const body = mat('case', { color: '#1c1a22', roughness: 0.35, metalness: 0.4 })
  const board = mat('board', { color: '#26232e', roughness: 0.8 })
  // Emissive above 1 is what the bloom pass picks up
  const glow = mat('rgb', { color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.5 })
  const glass = mat('glass', { color: '#a9bad6', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false })

  // The glass side is +x: the side the default camera (front-right) looks at.
  // `s` mirrors the internals onto the solid side, behind the glass.
  const s = -1
  box(g, T, H, D, body, s * (W / 2 - T / 2), H / 2, 0) // solid side
  box(g, W, T, D, body, 0, H - T / 2, 0) // top
  box(g, W, T, D, body, 0, T / 2, 0) // bottom
  box(g, W, H, T, body, 0, H / 2, -D / 2 + T / 2) // back
  box(g, W, H, T * 1.5, body, 0, H / 2, D / 2 - T * 0.75) // front panel
  box(g, 0.004, H - 0.05, D - 0.05, board, s * (W / 2 - T - 0.002), H / 2, 0) // motherboard
  box(g, 0.13, 0.035, 0.3, mat('gpu', { color: '#2f2b38', roughness: 0.5, metalness: 0.3 }), s * (W / 2 - T - 0.07), 0.19, 0.02)
  box(g, 0.003, 0.008, 0.28, glow, s * (W / 2 - T - 0.137), 0.19, 0.02) // GPU light bar
  for (const z of [-0.035, -0.015]) box(g, 0.03, 0.05, 0.006, glow, s * (W / 2 - T - 0.017), 0.36, z) // RAM
  ring(g, 0.035, glow, s * (W / 2 - T - 0.03), 0.34, -0.1, true) // CPU cooler
  for (const y of [0.11, 0.23, 0.35]) ring(g, 0.05, glow, 0, y, D / 2 + 0.004) // fans, on the front panel
  const side = box(g, 0.004, H - 0.02, D - 0.02, glass, W / 2 - 0.002, H / 2, 0)
  side.userData.noShadow = true // light passes through the glass
  return g
}

function wallpaper() {
  return painted('wallpaper', 512, 214, paintWallpaper)
}

/** The default sunset wallpaper (also one of the live screen modes). */
export function paintWallpaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#2b1d4f')
  sky.addColorStop(0.55, '#c05a8a')
  sky.addColorStop(1, '#f2a65a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffe3a8'
  ctx.beginPath()
  ctx.arc(w * 0.62, h * 0.62, 34, 0, Math.PI * 2)
  ctx.fill()
  const hills = (base: number, amp: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x / 47 + base) * amp + Math.sin(x / 13) * amp * 0.25)
    ctx.lineTo(w, h)
    ctx.fill()
  }
  hills(h * 0.72, 12, '#5b2f63')
  hills(h * 0.85, 9, '#2c1a3d')
}

function monitorWide() {
  const g = new Group()
  const frame = mat('frame', { color: '#1d1b22', roughness: 0.35, metalness: 0.4 })
  box(g, 0.28, 0.012, 0.19, frame, 0, 0.006, 0) // base
  box(g, 0.04, 0.27, 0.025, frame, 0, 0.145, -0.06) // neck
  box(g, 0.86, 0.37, 0.03, frame, 0, 0.43, -0.03) // panel
  const screen = new Mesh(
    new PlaneGeometry(0.84, 0.35),
    mat('screen', { color: '#000000', emissive: '#ffffff', emissiveMap: wallpaper(), emissiveIntensity: 0.85, roughness: 0.25 }),
  )
  screen.position.set(0, 0.43, -0.03 + 0.0152)
  g.add(screen)
  return g
}

function deskMat() {
  const g = new Group()
  box(g, 0.8, 0.004, 0.34, mat('mat', { color: '#2b2433', roughness: 0.95 }), 0, 0.002, 0)
  return g
}

function wallShelf() {
  const g = new Group()
  const wood = mat('wood', { color: '#c8956a', roughness: 0.7 })
  const metal = mat('bracket', { color: '#2a2730', roughness: 0.4, metalness: 0.6 })
  box(g, 0.8, 0.03, 0.22, wood, 0, 0.185, 0)
  for (const x of [-0.28, 0.28]) {
    box(g, 0.02, 0.17, 0.02, metal, x, 0.085, -0.1)
    box(g, 0.02, 0.02, 0.18, metal, x, 0.16, -0.01)
  }
  return g
}

function ledStrip() {
  const g = new Group()
  // A slim aluminium channel with a diffuser that glows bright enough to bloom
  box(g, 1.2, 0.03, 0.02, mat('case', { color: '#2a2730', roughness: 0.4, metalness: 0.6 }), 0, 0.015, -0.004)
  box(g, 1.18, 0.012, 0.012, mat('rgb', { color: ACCENT, emissive: ACCENT, emissiveIntensity: 3.5 }), 0, 0.015, 0.008)
  return g
}

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function poster(key: string, draw: Draw) {
  const g = new Group()
  box(g, 0.5, 0.7, 0.025, mat('frame', { color: '#f3eee7', roughness: 0.6 }), 0, 0.35, 0)
  const art = new Mesh(new PlaneGeometry(0.44, 0.64), mat('art', { color: '#ffffff', map: painted(key, 256, 372, draw), roughness: 0.85 }))
  art.position.set(0, 0.35, 0.0127)
  g.add(art)
  return g
}

const drawSunset: Draw = (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#6b4c9a')
  sky.addColorStop(0.5, '#f2777d')
  sky.addColorStop(1, '#ffcf8a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff1c9'
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.58, 62, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3d2a5c'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, h * 0.72)
  ctx.lineTo(w * 0.35, h * 0.6)
  ctx.lineTo(w * 0.6, h * 0.74)
  ctx.lineTo(w * 0.8, h * 0.66)
  ctx.lineTo(w, h * 0.74)
  ctx.lineTo(w, h)
  ctx.fill()
}

const drawOcean: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#14284b'
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  for (let row = 0; row < 11; row++) {
    ctx.strokeStyle = row % 3 === 0 ? '#f4efe6' : row % 3 === 1 ? '#3fa7b5' : '#6fd0c4'
    ctx.beginPath()
    for (let x = -10; x <= w + 10; x += 6) ctx.lineTo(x, 40 + row * 30 + Math.sin(x / 22 + row) * 9)
    ctx.stroke()
  }
}

const drawShapes: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#f1e8da'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#d9643a'
  ctx.beginPath()
  ctx.arc(w * 0.38, h * 0.36, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#23305c'
  ctx.beginPath()
  ctx.arc(w * 0.62, h * 0.7, 62, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#e8b83e'
  ctx.fillRect(w * 0.14, h * 0.62, 70, 92)
  ctx.fillStyle = '#1b1b1b'
  ctx.fillRect(w * 0.12, h * 0.55, w * 0.76, 6)
}

export function buildProcedural(id: ProceduralId): Group {
  switch (id) {
    case 'pcTower':
      return pcTower()
    case 'monitorWide':
      return monitorWide()
    case 'deskMat':
      return deskMat()
    case 'wallShelf':
      return wallShelf()
    case 'posterSunset':
      return poster('sunset', drawSunset)
    case 'posterOcean':
      return poster('ocean', drawOcean)
    case 'posterShapes':
      return poster('shapes', drawShapes)
    case 'ledStrip':
      return ledStrip()
    case 'workbench':
      return workbench()
    case 'pegboard':
      return pegboard()
    case 'toolbox':
      return toolbox()
    case 'simRig':
      return simRig()
    case 'tripleMonitor':
      return tripleMonitor()
    case 'catTree':
      return catTree()
    case 'dogBed':
      return dogBed()
    case 'petBowls':
      return petBowls()
    case 'aquarium':
      return aquarium()
  }
}
