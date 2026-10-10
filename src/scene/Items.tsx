import { useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react'
import { Raycaster, type Group, type Mesh, type MeshStandardMaterial, type Object3D, type Plane, type PointLight } from 'three'
import { useShallow } from 'zustand/react/shallow'
import { gsap, useGSAP } from '../anim/gsap'
import { catalogById } from '../catalog/catalog'
import { instantiate, loadPrototype } from '../catalog/models'
import { scaled, type Scale } from '../store/itemRules'
import { useRoom, type PlacedItem } from '../store/roomStore'
import { useUi, type CarryItem } from '../store/uiStore'
import { setMode } from './blueprintActions'
import { setCameraLocked } from './camera'
import {
  cancelItemCarry,
  commitPlacement,
  duplicateSelected,
  nudgeSelectedSize,
  pressEnd,
  pressItem,
  pressMove,
  removeSelectedItem,
  rotateInHand,
  rotateSelected,
  selectItem,
  switchPower,
} from './decorateActions'
import { THICKNESS } from './dimensions'
import { applyColors } from './colors'
import { applyLook, type Look } from './looks'
import { candidateMatrix, placement, solvePlacement } from './placementSolver'
import { atmo } from './atmosphere'
import { clippedRaycast, itemAnims, itemObjects, rgbMaterials } from './sceneRefs'

const NONE: PlacedItem[] = []
const NO_SCALE: Scale = { w: 1, d: 1, h: 1 }

const canEdit = () => {
  const ui = useUi.getState()
  return ui.mode === 'decorate' && !ui.carryItem
}

/** Wall items share their wall's cutaway: clip their materials and their raycasts. */
function clipTo(object: Object3D, clip: Plane[]) {
  object.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mat.clippingPlanes = clip
    mesh.raycast = clippedRaycast(clip[0])
  })
}

/** Renders a list of items, each behind its own Suspense so one slow model never hides the rest. */
export function ItemList({ items, clip, ghost = false }: { items: PlacedItem[]; clip?: Plane[]; ghost?: boolean }) {
  return (
    <>
      {items
        .filter((it) => catalogById.has(it.catalogId))
        .map((it) => (
          <Suspense key={it.id} fallback={null}>
            <ItemNode item={it} clip={clip} ghost={ghost} />
          </Suspense>
        ))}
    </>
  )
}

function ItemNode({ item, clip, ghost }: { item: PlacedItem; clip?: Plane[]; ghost: boolean }) {
  const entry = catalogById.get(item.catalogId)!
  const proto = use(loadPrototype(entry)) // suspends until the model is ready
  const height = useRoom((s) => s.doc.shell.height)
  const carriedId = useUi((s) => s.carryItem?.itemId ?? null)
  const children = useRoom(useShallow((s) => s.doc.items.filter((c) => c.parentId === item.id && c.id !== carriedId)))
  const selected = useUi((s) => s.selectedItemId === item.id)
  const [hovered, setHovered] = useState(false)
  const [pointing, setPointing] = useState(false) // view mode: hovering something switchable
  useCursor(hovered || pointing, hovered ? 'grab' : 'pointer')

  const outer = useRef<Group>(null!)
  const anim = useRef<Group>(null!)

  const object = useMemo(() => {
    const o = instantiate(proto)
    if (clip) clipTo(o, clip)
    return o
  }, [proto, clip])

  useEffect(() => applyColors(object, item.colors), [object, item.colors])

  // ---- Power: lamps light the room, electronics glow; both switch on and off ----
  const powered = !ghost && (!!entry.light || !!entry.glows)
  const isOn = item.on !== false
  const power = useRef({ p: isOn ? 1 : 0 })
  const light = useRef<PointLight>(null)
  const parts = useMemo(() => {
    const lamps: MeshStandardMaterial[] = []
    const glowing: MeshStandardMaterial[] = []
    const rgb: MeshStandardMaterial[] = []
    object.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[]) {
        if (mat.name === 'lamp') lamps.push(mat)
        else if (mat.userData.glow) glowing.push(mat)
        if (mat.name === 'rgb') rgb.push(mat)
      }
    })
    return { lamps, glowing, rgb }
  }, [object])

  // The frame loop reads parts through a ref: it mutates these materials every frame,
  // which is the renderer's business, not React's
  const partsRef = useRef(parts)
  useEffect(() => {
    partsRef.current = parts
  }, [parts])

  useEffect(() => {
    if (ghost) return
    for (const m of parts.rgb) rgbMaterials.add(m)
    return () => {
      for (const m of parts.rgb) rgbMaterials.delete(m)
    }
  }, [parts, ghost])

  // Switching on flickers like a real bulb; switching off fades. Skipped on first mount.
  const switched = useRef(false)
  useGSAP(
    () => {
      if (!powered) return
      if (!switched.current) {
        switched.current = true
        return
      }
      const p = power.current
      gsap.killTweensOf(p)
      if (isOn) gsap.timeline().to(p, { p: 0.7, duration: 0.05 }).to(p, { p: 0.1, duration: 0.06 }).to(p, { p: 1, duration: 0.5, ease: 'power2.out' })
      else gsap.to(p, { p: 0, duration: 0.35, ease: 'power2.in' })
    },
    { dependencies: [isOn] },
  )

  useFrame(() => {
    if (!powered) return
    const k = power.current.p
    // Lamps matter more as it gets darker outside
    if (light.current && entry.light) light.current.intensity = entry.light.intensity * k * (0.35 + atmo.lamps)
    const { lamps, glowing } = partsRef.current
    for (const m of lamps) m.emissive.setRGB(1, 0.78, 0.45).multiplyScalar(k * (0.25 + atmo.lamps * 0.9))
    // Per-frame mutation of three.js materials is how R3F works; the React-purity rule doesn't apply
    // oxlint-disable-next-line react/immutability
    for (const m of glowing) m.emissiveIntensity = (m.userData.glowIntensity ?? 1) * k
  })
  const look: Look = ghost ? 'ghost' : selected ? 'selected' : hovered ? 'hover' : 'normal'
  useEffect(() => applyLook(object, look), [object, look])

  useEffect(() => {
    if (ghost) return
    itemObjects.set(item.id, outer.current)
    itemAnims.set(item.id, anim.current)
    return () => {
      itemObjects.delete(item.id)
      itemAnims.delete(item.id)
    }
  }, [ghost, item.id])

  // Drop in and squash on landing. React owns the outer group's transform (from the
  // store), GSAP owns the inner one, so a re-render can never fight an animation.
  useGSAP(() => {
    if (ghost) return
    gsap
      .timeline()
      .from(anim.current.position, { y: 0.35, duration: 0.45, ease: 'power2.in' })
      .fromTo(anim.current.scale, { x: 1.08, y: 0.86, z: 1.08 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' })
  })

  // Resizing: only the model stretches (the `fit` group), so things on top aren't
  // distorted; they just ride up or down with the top surface. GSAP owns both transforms,
  // so the change eases in and a re-render can't fight it.
  const size = proto.size
  const k = item.size ?? NO_SCALE
  const fit = useRef<Group>(null!)
  const top = useRef<Group>(null!)
  const sized = useRef(false)
  useGSAP(
    () => {
      const scale = { x: k.w, y: k.h, z: k.d }
      const lift = { y: size.y * k.h }
      if (!sized.current) {
        sized.current = true
        gsap.set(fit.current.scale, scale)
        gsap.set(top.current.position, lift)
        return
      }
      gsap.to(fit.current.scale, { ...scale, duration: 0.45, ease: 'back.out(1.7)', overwrite: true })
      gsap.to(top.current.position, { ...lift, duration: 0.45, ease: 'back.out(1.7)', overwrite: true })
    },
    { dependencies: [k.w, k.h, k.d, size.y] },
  )

  const real = scaled(size, item.size)
  const position: [number, number, number] = item.wall
    ? [item.wall.along, item.wall.y, THICKNESS / 2 + real.z / 2] // back against the wall
    : [item.x, item.parentId ? 0 : entry.mount === 'ceiling' ? height - real.y : 0, item.z]

  const handlers = ghost
    ? {}
    : {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          if (powered && useUi.getState().mode === 'view') {
            e.stopPropagation()
            setPointing(true)
            return
          }
          if (!canEdit()) return
          e.stopPropagation() // the top-most item wins, not the desk under it
          setHovered(true)
          setCameraLocked(true) // pressing here should grab the item, not orbit
        },
        onPointerOut: () => {
          setHovered(false)
          setPointing(false)
          if (!useUi.getState().carryItem) setCameraLocked(false)
        },
        // In view mode, clicking a lamp or a screen flips its switch
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (!powered || useUi.getState().mode !== 'view' || e.delta > 6) return
          e.stopPropagation()
          switchPower(item.id)
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          if (!canEdit() || e.button !== 0) return
          e.stopPropagation()
          pressItem(item.id, e.nativeEvent)
        },
      }

  return (
    <group ref={outer} position={position} rotation-y={item.wall ? 0 : item.rot} userData={{ itemId: item.id }} {...handlers}>
      <group ref={anim}>
        <group ref={fit}>
          <primitive object={object} />
          {powered && entry.light && (
            <pointLight ref={light} position={[0, size.y * entry.light.y, 0]} color="#ffcf94" distance={entry.light.distance} decay={2} intensity={0} />
          )}
        </group>
        {/* Children sit on this item's top surface */}
        <group ref={top}>
          <ItemList items={children} clip={clip} ghost={ghost} />
        </group>
      </group>
    </group>
  )
}

/** The see-through preview of whatever is in hand, plus the input that places it. */
export function Placement() {
  const carry = useUi((s) => s.carryItem)
  usePlacementInput()
  if (!carry) return null
  return (
    <Suspense fallback={null}>
      <Ghost key={carry.itemId ?? `new:${carry.catalogId}`} carry={carry} />
    </Suspense>
  )
}

function Ghost({ carry }: { carry: CarryItem }) {
  const proto = use(loadPrototype(catalogById.get(carry.catalogId)!))
  const object = useMemo(() => instantiate(proto), [proto])
  // A moved or duplicated item keeps its colours in hand
  useEffect(() => applyColors(object, carry.colors), [object, carry.colors])
  const children = useRoom(useShallow((s) => (carry.itemId ? s.doc.items.filter((c) => c.parentId === carry.itemId) : NONE)))
  const root = useRef<Group>(null!)
  const shownValid = useRef<boolean | null>(null)
  const raycaster = useMemo(() => new Raycaster(), [])

  // Every frame: pointer → candidate spot → ghost transform. No React state involved.
  useFrame(({ camera, pointer }) => {
    raycaster.setFromCamera(pointer, camera)
    const result = solvePlacement(raycaster, carry)
    // Off any valid target (e.g. a wall item over a window hole) the ghost stays put
    if (result) Object.assign(placement, result)
    const g = root.current
    g.visible = !!placement.candidate && candidateMatrix(placement.candidate, scaled(proto.size, carry.size), g.matrix)
    g.matrixWorldNeedsUpdate = true
    if (shownValid.current !== placement.valid) {
      applyLook(g, placement.valid ? 'ghost' : 'ghost-bad')
      shownValid.current = placement.valid
    }
  })

  return (
    <group ref={root} matrixAutoUpdate={false} visible={false}>
      <group scale={carry.size ? [carry.size.w, carry.size.h, carry.size.d] : 1}>
        <primitive object={object} />
      </group>
      <group position-y={proto.size.y * (carry.size?.h ?? 1)}>
        <ItemList items={children} ghost />
      </group>
    </group>
  )
}

function usePlacementInput() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const canvas = gl.domElement
    let down: { x: number; y: number } | null = null

    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      const clicked = !!down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6
      down = null
      pressEnd() // a press on an item that never turned into a drag = select it
      const { carryItem } = useUi.getState()
      if (!carryItem) return
      if (carryItem.itemId) {
        // Dragging an existing item: drop it wherever the button comes up (or put it back)
        if (!commitPlacement()) cancelItemCarry()
      } else if (clicked && e.target === canvas) {
        // A new item is placed with a click; a drag in between just orbits the camera.
        // Shift keeps it in hand to place another.
        commitPlacement(e.shiftKey)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      const ui = useUi.getState()
      if (e.metaKey || e.ctrlKey) {
        if (e.code === 'KeyD' && ui.mode === 'decorate') {
          e.preventDefault() // not the browser's bookmark shortcut
          duplicateSelected()
        }
        return
      }
      if (e.code === 'Digit1') return setMode('view')
      if (e.code === 'Digit2') return setMode('decorate')
      if (e.code === 'Digit3') return setMode('blueprint')
      if (e.code === 'KeyC') return setMode(ui.mode === 'decorate' ? 'view' : 'decorate')
      if (ui.mode !== 'decorate') return
      if (e.code === 'KeyR') {
        if (ui.carryItem) rotateInHand(e.shiftKey ? -1 : 1)
        else if (ui.selectedItemId) rotateSelected(e.shiftKey ? -1 : 1)
      } else if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && !ui.carryItem) {
        nudgeSelectedSize(e.code === 'BracketRight' ? 1 : -1)
      } else if (e.key === 'Escape') {
        if (ui.carryItem) cancelItemCarry()
        else if (ui.selectedItemId) selectItem(null)
        else setMode('view')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelectedItem()
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', pressMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', pressMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl])
}
