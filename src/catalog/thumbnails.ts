import { AgXToneMapping, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { create } from 'zustand'
import type { CatalogItem } from './catalog'
import { loadPrototype } from './models'

// Catalog cards show real renders of each item, made in the browser: one small offscreen
// renderer draws each model once and keeps the PNG. No image files to keep in sync.

const SIZE = 192

/** catalogId → PNG data URL */
export const useThumbs = create<Record<string, string>>(() => ({}))

let renderer: WebGLRenderer | null = null
const scene = new Scene()
const camera = new PerspectiveCamera(28, 1, 0.01, 100)
scene.add(new HemisphereLight('#ffffff', '#6b5a72', 2.2))
const sun = new DirectionalLight('#fff4e6', 2.6)
sun.position.set(2, 4, 3)
scene.add(sun)

const queue: CatalogItem[] = []
const requested = new Set<string>()
let pumping = false

export function requestThumbnail(item: CatalogItem) {
  if (requested.has(item.id)) return
  requested.add(item.id)
  queue.push(item)
  void pump()
}

async function pump() {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const item = queue.shift()!
    try {
      useThumbs.setState({ [item.id]: await render(item) })
    } catch (err) {
      console.error(`Thumbnail failed for ${item.id}`, err)
    }
    // One thumbnail per frame, so opening the catalog never stalls the main scene
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  pumping = false
}

/** A one-off render (e.g. previewing an upload before it's saved). */
export const thumbnailOf = (item: CatalogItem) => render(item)

const viewDir = new Vector3(0.9, 0.75, 1.3).normalize() // from the front-right, slightly above

async function render(item: CatalogItem) {
  const proto = await loadPrototype(item)
  if (!renderer) {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(SIZE, SIZE)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = AgXToneMapping
  }
  const object = proto.object.clone(true)
  scene.add(object)

  // Fit the model's bounding sphere to the frame, so small and large items fill cards equally
  const target = new Vector3(0, proto.size.y / 2, 0)
  const distance = proto.size.length() / 2 / Math.sin((camera.fov * Math.PI) / 360)
  camera.position.copy(target).addScaledVector(viewDir, distance)
  camera.lookAt(target)

  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(object)
  return url
}
