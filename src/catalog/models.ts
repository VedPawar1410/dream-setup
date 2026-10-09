import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Material, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { CatalogItem } from './catalog'
import { buildProcedural } from './procedural'

/**
 * A ready-to-clone model: pivot at the bottom-centre, front facing +z, in metres.
 * Kenney's files put the pivot in different places (some at a corner, some centred),
 * so every model is normalised once here and the placement code never has to care.
 */
export type Prototype = { object: Object3D; size: Vector3 }

/** Real-world size per catalog id, filled in as models load. Collision rules read this. */
export const itemSizes = new Map<string, Vector3>()

const loader = new GLTFLoader()
const prototypes = new Map<string, Promise<Prototype>>()

/**
 * One cached promise per catalog item. React 19's `use()` suspends on it in the scene,
 * and the thumbnail renderer awaits the same promise, so each file is fetched and
 * parsed exactly once.
 */
export function loadPrototype(item: CatalogItem): Promise<Prototype> {
  let p = prototypes.get(item.id)
  if (!p) {
    const m = item.model
    const raw =
      m.kind === 'glb'
        ? loader.loadAsync(`${import.meta.env.BASE_URL}models/${m.file}`).then((gltf) => normalize(gltf.scene, m.scale, m.yaw))
        : Promise.resolve(normalize(buildProcedural(m.build), 1, 0))
    p = raw
      .catch((err) => {
        // A missing file shouldn't take the whole room down: show a placeholder box instead.
        console.error(`Failed to load ${item.id}`, err)
        return normalize(new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshStandardMaterial({ color: '#ff6b81' })), 1, 0)
      })
      .then((proto) => {
        itemSizes.set(item.id, proto.size)
        return proto
      })
    prototypes.set(item.id, p)
  }
  return p
}

function normalize(model: Object3D, scale: number, yaw: number): Prototype {
  model.scale.setScalar(scale)
  model.rotation.y = yaw
  const root = new Group()
  root.add(model)
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const center = box.getCenter(new Vector3())
  // Shift so the footprint is centred on the origin and the bottom rests on y = 0
  model.position.set(-center.x, -box.min.y, -center.z)
  model.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = !o.userData.noShadow
      o.receiveShadow = true
    }
  })
  return { object: root, size: box.getSize(new Vector3()) }
}

/** A placed copy with its own materials, so tinting or recolouring one never touches another. */
export function instantiate(proto: Prototype): Object3D {
  const clone = proto.object.clone(true)
  const copy = (mat: Material) => {
    const c = mat.clone() as MeshStandardMaterial
    // Remember what glowed originally (RGB, screens) before any highlight tints the emissive
    c.userData.glow = c.emissive && c.emissive.getHex() !== 0 ? c.emissive.clone() : null
    c.userData.glowIntensity = c.emissiveIntensity // full brightness, for power on/off
    return c
  }
  clone.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material)
  })
  return clone
}
