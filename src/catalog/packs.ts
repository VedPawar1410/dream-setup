import { Group, Mesh, PlaneGeometry, SphereGeometry, TorusGeometry, type MeshStandardMaterial } from 'three'
import { screenTexture } from '../scene/screens'
import { box, cyl, mat, painted } from './build'

// Code-built items for the themed packs (garage, sim racing, pets). Same conventions as
// procedural.ts: front faces +z, metres, named materials are the recolour slots.

// ---------- Garage ----------

export function workbench() {
  const g = new Group()
  const wood = mat('wood', { color: '#b98a5e', roughness: 0.75 })
  const metal = mat('metal', { color: '#4b505c', roughness: 0.4, metalness: 0.6 })
  box(g, 1.4, 0.05, 0.62, wood, 0, 0.885, 0) // top
  box(g, 1.3, 0.03, 0.52, wood, 0, 0.2, 0) // lower shelf
  for (const x of [-0.66, 0.66]) for (const z of [-0.27, 0.27]) box(g, 0.05, 0.86, 0.05, metal, x, 0.43, z)
  box(g, 0.16, 0.08, 0.1, metal, -0.55, 0.95, 0.24) // vice
  box(g, 0.04, 0.03, 0.16, metal, -0.55, 0.96, 0.36)
  return g
}

/** Pegboard holes, painted once into a shared texture. */
const pegHoles = () =>
  painted('pegboard', 256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#8a7a66'
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
  })

export function pegboard() {
  const g = new Group()
  const board = mat('board', { color: '#d8b48a', map: pegHoles(), roughness: 0.8 })
  const steel = mat('steel', { color: '#9aa1ad', roughness: 0.3, metalness: 0.7 })
  const handles = mat('handles', { color: '#e0533f', roughness: 0.5 })
  box(g, 1.0, 0.62, 0.02, board, 0, 0.31, 0)
  const z = 0.025
  // Hammer
  box(g, 0.03, 0.26, 0.02, handles, -0.36, 0.3, z)
  box(g, 0.12, 0.04, 0.03, steel, -0.36, 0.44, z)
  // Wrenches
  for (const [x, len] of [
    [-0.18, 0.24],
    [-0.1, 0.2],
  ])
    box(g, 0.018, len, 0.01, steel, x, 0.31, z)
  // Screwdrivers: coloured handle, steel shaft
  for (const [i, color] of ['#e0533f', '#3f7fe0', '#f2c14e'].entries()) {
    const x = 0.06 + i * 0.07
    box(g, 0.03, 0.09, 0.03, mat(`handle${i}`, { color, roughness: 0.5 }), x, 0.42, z)
    box(g, 0.008, 0.14, 0.008, steel, x, 0.3, z)
  }
  // Saw
  box(g, 0.2, 0.08, 0.004, steel, 0.36, 0.22, z)
  box(g, 0.06, 0.08, 0.02, handles, 0.27, 0.27, z)
  return g
}

export function toolbox() {
  const g = new Group()
  const paint = mat('paint', { color: '#d94b4b', roughness: 0.4, metalness: 0.3 })
  const steel = mat('steel', { color: '#3a3d44', roughness: 0.35, metalness: 0.7 })
  box(g, 0.46, 0.2, 0.22, paint, 0, 0.1, 0)
  box(g, 0.47, 0.012, 0.225, steel, 0, 0.14, 0) // lid seam
  const handle = new Mesh(new TorusGeometry(0.08, 0.012, 8, 24, Math.PI), steel)
  handle.position.set(0, 0.2, 0)
  g.add(handle)
  for (const x of [-0.15, 0.15]) box(g, 0.04, 0.03, 0.01, steel, x, 0.15, 0.115) // latches
  return g
}

// ---------- Sim racing ----------

export function simRig() {
  const g = new Group()
  const frame = mat('frame', { color: '#24232a', roughness: 0.35, metalness: 0.6 })
  const seat = mat('seat', { color: '#2e2b36', roughness: 0.8 })
  const accent = mat('accent', { color: '#e0533f', roughness: 0.5 })
  // Base rails
  for (const x of [-0.26, 0.26]) box(g, 0.05, 0.05, 1.35, frame, x, 0.025, 0)
  for (const z of [-0.6, 0.6]) box(g, 0.57, 0.05, 0.05, frame, 0, 0.025, z)
  // Bucket seat at the back, reclined, facing +z
  box(g, 0.46, 0.08, 0.46, seat, 0, 0.3, -0.3)
  const back = box(g, 0.46, 0.62, 0.08, seat, 0, 0.62, -0.53)
  back.rotation.x = -0.28
  for (const x of [-0.2, 0.2]) box(g, 0.05, 0.1, 0.44, accent, x, 0.36, -0.3) // bolsters
  box(g, 0.36, 0.06, 0.08, accent, 0, 0.88, -0.6) // headrest stripe
  box(g, 0.1, 0.26, 0.1, frame, 0, 0.13, -0.3) // seat post
  // Wheel column and wheel
  box(g, 0.06, 0.62, 0.06, frame, 0, 0.31, 0.38)
  const column = box(g, 0.06, 0.06, 0.26, frame, 0, 0.66, 0.27)
  column.rotation.x = 0.35
  const wheel = new Mesh(new TorusGeometry(0.15, 0.022, 10, 36), mat('wheel', { color: '#1b1a1f', roughness: 0.6 }))
  wheel.position.set(0, 0.72, 0.16)
  wheel.rotation.x = -0.35
  g.add(wheel)
  box(g, 0.08, 0.05, 0.03, accent, 0, 0.72, 0.17).rotation.x = -0.35 // hub
  // Pedals on a plate in front
  box(g, 0.32, 0.02, 0.16, frame, 0, 0.12, 0.5)
  for (const x of [-0.09, 0, 0.09]) {
    const p = box(g, 0.05, 0.12, 0.015, frame, x, 0.18, 0.52)
    p.rotation.x = -0.5
  }
  return g
}

export function tripleMonitor() {
  const g = new Group()
  const frame = mat('frame', { color: '#1d1b22', roughness: 0.35, metalness: 0.4 })
  // Floor stand: foot, pole, crossbar
  box(g, 0.7, 0.03, 0.45, frame, 0, 0.015, 0)
  box(g, 0.06, 1.0, 0.06, frame, 0, 0.5, -0.05)
  box(g, 1.6, 0.05, 0.05, frame, 0, 1.0, -0.05)
  // Three 27" panels: the side ones angle in to wrap around the driver
  for (const [x, yaw] of [
    [-0.66, 0.5],
    [0, 0],
    [0.66, -0.5],
  ]) {
    const panel = new Group()
    panel.position.set(x, 1.03, 0)
    panel.rotation.y = yaw
    box(panel, 0.63, 0.37, 0.03, frame, 0, 0, 0)
    const screen = new Mesh(
      new PlaneGeometry(0.61, 0.345),
      mat('screen', { color: '#000000', emissive: '#ffffff', emissiveMap: screenTexture('wallpaper', 16 / 9), emissiveIntensity: 0.85, roughness: 0.25 }),
    )
    screen.position.z = 0.0152
    panel.add(screen)
    g.add(panel)
  }
  return g
}

// ---------- Pets ----------

export function catTree() {
  const g = new Group()
  const sisal = mat('sisal', { color: '#d8c39a', roughness: 0.95 })
  const carpet = mat('carpet', { color: '#9b86c9', roughness: 0.95 })
  const toy = mat('toy', { color: '#ff8fb1', roughness: 0.6 })
  box(g, 0.55, 0.05, 0.55, carpet, 0, 0.025, 0)
  cyl(g, 0.05, 0.05, 0.6, sisal, -0.14, 0.33, -0.12)
  cyl(g, 0.05, 0.05, 1.05, sisal, 0.14, 0.55, 0.1)
  box(g, 0.36, 0.04, 0.32, carpet, -0.08, 0.64, -0.08) // middle platform
  // Top bed: a soft round nest
  cyl(g, 0.2, 0.2, 0.04, carpet, 0.08, 1.1, 0.04, 28)
  const rim = new Mesh(new TorusGeometry(0.19, 0.04, 10, 28), carpet)
  rim.rotation.x = Math.PI / 2
  rim.position.set(0.08, 1.14, 0.04)
  g.add(rim)
  // A dangling toy ball
  box(g, 0.004, 0.18, 0.004, sisal, -0.22, 0.53, 0.0)
  const ball = new Mesh(new SphereGeometry(0.035, 14, 10), toy)
  ball.position.set(-0.22, 0.42, 0)
  g.add(ball)
  return g
}

export function dogBed() {
  const g = new Group()
  const fabric = mat('fabric', { color: '#c98b6b', roughness: 0.9 })
  const cushion = mat('cushion', { color: '#f0dcc8', roughness: 0.95 })
  cyl(g, 0.36, 0.38, 0.06, fabric, 0, 0.03, 0, 32)
  const rim = new Mesh(new TorusGeometry(0.33, 0.07, 12, 36), fabric)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.1
  rim.scale.set(1, 1, 1.4) // the torus is flattened (rotated), so this makes the rim taller
  g.add(rim)
  cyl(g, 0.29, 0.29, 0.07, cushion, 0, 0.095, 0, 32)
  return g
}

export function petBowls() {
  const g = new Group()
  const bowl = mat('bowl', { color: '#7fa8c9', roughness: 0.35 })
  const food = mat('food', { color: '#a5683c', roughness: 0.9 })
  const water = mat('water', { color: '#9fd3ff', roughness: 0.05, transparent: true, opacity: 0.75 })
  for (const [x, fill] of [
    [-0.1, food],
    [0.1, water],
  ] as [number, MeshStandardMaterial][]) {
    cyl(g, 0.085, 0.065, 0.06, bowl, x, 0.03, 0, 24)
    cyl(g, 0.07, 0.07, 0.01, fill, x, 0.055, 0, 24)
  }
  return g
}

export function aquarium() {
  const g = new Group()
  const W = 0.6, H = 0.38, D = 0.3
  const frame = mat('frame', { color: '#1d1b22', roughness: 0.4, metalness: 0.4 })
  const glass = mat('glass', { color: '#cfe6ff', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false })
  // The water glows a little so the tank reads at night, and switches off with the power
  const water = mat('water', { color: '#2f7fb8', emissive: '#3aa0e0', emissiveIntensity: 0.55, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false })
  const gravel = mat('gravel', { color: '#d9c7a1', roughness: 1 })
  const plant = mat('plant', { color: '#4fae6b', roughness: 0.7 })
  box(g, W + 0.02, 0.03, D + 0.02, frame, 0, 0.015, 0)
  box(g, W + 0.02, 0.02, D + 0.02, frame, 0, H, 0)
  box(g, W, 0.04, D, gravel, 0, 0.05, 0)
  box(g, W - 0.01, H - 0.1, D - 0.01, water, 0, 0.07 + (H - 0.1) / 2, 0).userData.noShadow = true
  const glassBox = box(g, W, H - 0.03, D, glass, 0, 0.03 + (H - 0.03) / 2, 0)
  glassBox.userData.noShadow = true
  for (const [x, h] of [
    [-0.2, 0.2],
    [-0.16, 0.14],
    [0.21, 0.24],
  ])
    cyl(g, 0.0, 0.025, h, plant, x, 0.07 + h / 2, -0.06, 8)
  // A little school of fish swimming laps: the whole group turns, tagged `spin` about y.
  // The lap radius stays under half the tank's depth, so no fish swims through the glass.
  const school = new Group()
  school.position.set(0, 0.2, 0)
  school.userData.spin = 0.9
  school.userData.spinAxis = 'y'
  for (const [i, color] of ['#ff8a3d', '#ffd23d', '#ff5fa2'].entries()) {
    const fishMat = mat(`fish${i}`, { color, roughness: 0.5 })
    const fish = new Group()
    const a = (i * Math.PI * 2) / 3
    fish.position.set(Math.cos(a) * 0.1, (i - 1) * 0.05, Math.sin(a) * 0.1)
    fish.rotation.y = Math.PI - a // nose along the direction of the lap
    box(fish, 0.012, 0.035, 0.05, fishMat, 0, 0, 0)
    box(fish, 0.006, 0.03, 0.02, fishMat, 0, 0, -0.033).rotation.x = 0.6 // tail
    school.add(fish)
  }
  g.add(school)
  return g
}
