import { gsap } from '../anim/gsap'
import { boop, play, plop } from '../audio/sound'
import { sizeOfItem } from '../catalog/models'
import { batch } from '../store/history'
import { halfExtents, SCALE_MAX, SCALE_MIN, type Scale } from '../store/itemRules'
import { useRoom, type PlacedItem, type WallSide } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { setCameraLocked } from './camera'
import { candidateFields, candidateOf, isValid, placement, subtree, worldYaw } from './placementSolver'
import { itemAnims, itemObjects } from './sceneRefs'

// Decorate-mode editor actions. Plain functions over the stores, shared by the 3D scene,
// the HUD panels and the keyboard.

const STEP = Math.PI / 4 // R rotates by 45°

const findItem = (id: string | null) => (id ? useRoom.getState().doc.items.find((it) => it.id === id) : undefined)

export const selectItem = (id: string | null) => useUi.setState({ selectedItemId: id })

export function startPlacing(catalogId: string, rot = 0, colors?: Record<string, string>, size?: Scale) {
  placement.candidate = null
  useUi.setState({ carryItem: { catalogId, itemId: null, rot, colors, size }, selectedItemId: null })
}

export function startMovingItem(id: string) {
  const item = findItem(id)
  if (!item) return
  const obj = itemObjects.get(id)
  placement.candidate = null
  // Carry it at its current on-screen angle, even if it was sitting on a rotated parent
  useUi.setState({ carryItem: { catalogId: item.catalogId, itemId: id, rot: obj ? worldYaw(obj) : item.rot, colors: item.colors, size: item.size }, selectedItemId: id })
  setCameraLocked(true)
  boop()
}

export function cancelItemCarry() {
  placement.candidate = null
  useUi.setState({ carryItem: null })
  setCameraLocked(false)
}

/** Put the ghost down where it is. With `keep`, a new item stays in hand to place another. */
export function commitPlacement(keep = false): boolean {
  const { carryItem } = useUi.getState()
  const { candidate, valid } = placement
  if (!carryItem || !candidate) return false
  if (!valid) {
    play('error')
    return false
  }

  const room = useRoom.getState()
  const id = carryItem.itemId ?? crypto.randomUUID()
  const fields = candidateFields(candidate)
  const before = carryItem.itemId ? findItem(id) : undefined
  if (carryItem.itemId) room.updateItem(id, fields)
  else room.addItem({ id, catalogId: carryItem.catalogId, ...fields, colors: carryItem.colors, size: carryItem.size })
  plop()
  // A new item (or one moved onto another parent) remounts and plays its drop-in; one moved
  // within the same parent stays mounted, so give it the same squash-and-stretch landing
  if (before && before.parentId === fields.parentId && !!before.wall === !!fields.wall) squash(id)

  if (keep && !carryItem.itemId) return true // same item stays in hand
  placement.candidate = null
  useUi.setState({ carryItem: null, selectedItemId: id })
  setCameraLocked(false)
  return true
}

export function rotateInHand(dir: 1 | -1) {
  const { carryItem } = useUi.getState()
  if (!carryItem) return
  useUi.setState({ carryItem: { ...carryItem, rot: carryItem.rot + dir * STEP } })
  play('rotate')
}

export function rotateSelected(dir: 1 | -1) {
  const { selectedItemId } = useUi.getState()
  const item = findItem(selectedItemId)
  if (!item || item.wall) return
  const rot = item.rot + dir * STEP
  const turned = { ...candidateOf(item), rot } as ReturnType<typeof candidateOf>
  if (!isValid(turned, item, subtree(useRoom.getState().doc.items, item.id))) return shake(item.id)
  useRoom.getState().updateItem(item.id, { rot })
  play('rotate')
  // The frame snaps to the new angle; the inner group starts at the old one and eases over
  const anim = itemAnims.get(item.id)
  if (anim) gsap.fromTo(anim.rotation, { y: -dir * STEP }, { y: 0, duration: 0.45, ease: 'back.out(1.8)' })
}

/** A jelly landing: squashed wide and short, then springing back. */
function squash(id: string) {
  const anim = itemAnims.get(id)
  if (anim) gsap.fromTo(anim.scale, { x: 1.12, y: 0.82, z: 1.12 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)', overwrite: true })
}

const lastShake = new Map<string, number>()

/** A little "nope" wiggle when an action is blocked. At most twice a second, so a scrub doesn't buzz. */
export function shake(id: string) {
  const now = performance.now()
  if (now - (lastShake.get(id) ?? 0) < 500) return
  lastShake.set(id, now)
  play('error')
  const anim = itemAnims.get(id)
  if (anim) gsap.fromTo(anim.position, { x: -0.05 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.2)' })
}

export function removeSelectedItem() {
  const { selectedItemId: id } = useUi.getState()
  if (!id) return
  useUi.setState({ selectedItemId: null })
  play('remove')
  const remove = () => useRoom.getState().removeItem(id)
  const anim = itemAnims.get(id)
  if (!anim) return remove()
  gsap.to(anim.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3, ease: 'back.in(2)', onComplete: remove })
}

export function duplicateSelected() {
  const { selectedItemId } = useUi.getState()
  const item = findItem(selectedItemId)
  const obj = selectedItemId ? itemObjects.get(selectedItemId) : undefined
  if (item) startPlacing(item.catalogId, obj ? worldYaw(obj) : item.rot, item.colors, item.size)
}

/** Flip a lamp, screen or RGB part on or off, with a satisfying click. */
export function switchPower(id: string) {
  useRoom.getState().togglePower(id)
  play('switch')
}

const clampScale = (v: number) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, v))
const isOne = (k: Scale) => Math.abs(k.w - 1) < 1e-3 && Math.abs(k.d - 1) < 1e-3 && Math.abs(k.h - 1) < 1e-3

/**
 * Resize an item (multipliers on its model's size). Refused, with a wiggle, if it would no
 * longer fit where it stands. Things on top slide inward so they stay on a shrinking top.
 * Returns whether it applied.
 */
export function resizeItem(id: string, next: Scale): boolean {
  const room = useRoom.getState()
  const item = findItem(id)
  if (!item) return false
  const size = { w: clampScale(next.w), d: clampScale(next.d), h: clampScale(next.h) }
  let resized = { ...item, size: isOne(size) ? undefined : size }
  const ignore = subtree(room.doc.items, id)
  if (!isValid(candidateOf(resized), resized, ignore)) {
    // Growing against a wall: push it back into the room, if that's all it needs
    const moved = intoRoom(resized)
    if (!moved || !isValid(candidateOf(moved), moved, ignore)) {
      shake(id)
      return false
    }
    resized = moved
  }
  // One undo step, even though things on top may shift too
  batch(`item:${id}:size`, () => {
    room.updateItem(id, { size: resized.size, x: resized.x, z: resized.z })
    const top = sizeOfItem(resized)
    if (!top) return
    for (const child of room.doc.items) {
      if (child.parentId !== id) continue
      const s = sizeOfItem(child)
      if (!s) continue
      const { hx, hz } = halfExtents(s, child.rot)
      const lx = Math.max(0, top.x / 2 - hx)
      const lz = Math.max(0, top.z / 2 - hz)
      const x = Math.min(lx, Math.max(-lx, child.x))
      const z = Math.min(lz, Math.max(-lz, child.z))
      if (x !== child.x || z !== child.z) useRoom.getState().updateItem(child.id, { x, z })
    }
  })
  return true
}

/** A floor item shifted just enough to keep its (new) footprint inside the walls. */
function intoRoom<T extends PlacedItem>(it: T): T | null {
  const s = sizeOfItem(it)
  if (!s || it.parentId || it.wall) return null
  const { width, depth } = useRoom.getState().doc.shell
  const { hx, hz } = halfExtents(s, it.rot)
  const lx = width / 2 - hx
  const lz = depth / 2 - hz
  if (lx < 0 || lz < 0) return null
  return { ...it, x: Math.min(lx, Math.max(-lx, it.x)), z: Math.min(lz, Math.max(-lz, it.z)) }
}

/** [ and ]: shrink or grow the selected item evenly by 10%. */
export function nudgeSelectedSize(dir: 1 | -1) {
  const item = findItem(useUi.getState().selectedItemId)
  if (!item) return
  const k = item.size ?? { w: 1, d: 1, h: 1 }
  const f = dir > 0 ? 1.1 : 1 / 1.1
  if (resizeItem(item.id, { w: k.w * f, d: k.d * f, h: k.h * f })) play('rotate')
}

export function setItemColor(id: string, slot: string, hex: string) {
  const item = findItem(id)
  if (item) useRoom.getState().updateItem(id, { colors: { ...item.colors, [slot]: hex } })
}

export function resetItemColors(id: string) {
  useRoom.getState().updateItem(id, { colors: undefined })
}

/** Choose which wall(s) the Room panel paints; selecting a wall also shows the walls tab. */
export function setPaintTarget(target: WallSide | 'all') {
  useUi.setState({ paintTarget: target, roomTab: 'walls', selectedItemId: null })
}

// Pressing on an item: release without moving selects it; moving first picks it up.
let press: { id: string; x: number; y: number } | null = null

export function pressItem(id: string, e: PointerEvent) {
  press = { id, x: e.clientX, y: e.clientY }
}

export function pressMove(e: PointerEvent) {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
    const { id } = press
    press = null
    startMovingItem(id)
  }
}

export function pressEnd() {
  if (press) selectItem(press.id)
  press = null
}
