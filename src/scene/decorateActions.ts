import { gsap } from '../anim/gsap'
import { useRoom } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import { setCameraLocked } from './camera'
import { candidateFields, candidateOf, isValid, placement, subtree, worldYaw } from './placementSolver'
import { itemAnims, itemObjects } from './sceneRefs'

// Decorate-mode editor actions. Plain functions over the stores, shared by the 3D scene,
// the HUD panels and the keyboard.

const STEP = Math.PI / 4 // R rotates by 45°

const findItem = (id: string | null) => (id ? useRoom.getState().doc.items.find((it) => it.id === id) : undefined)

export const selectItem = (id: string | null) => useUi.setState({ selectedItemId: id })

export function startPlacing(catalogId: string, rot = 0) {
  placement.candidate = null
  useUi.setState({ carryItem: { catalogId, itemId: null, rot }, selectedItemId: null })
}

export function startMovingItem(id: string) {
  const item = findItem(id)
  if (!item) return
  const obj = itemObjects.get(id)
  placement.candidate = null
  // Carry it at its current on-screen angle, even if it was sitting on a rotated parent
  useUi.setState({ carryItem: { catalogId: item.catalogId, itemId: id, rot: obj ? worldYaw(obj) : item.rot }, selectedItemId: id })
  setCameraLocked(true)
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
  if (!carryItem || !candidate || !valid) return false

  const room = useRoom.getState()
  const id = carryItem.itemId ?? crypto.randomUUID()
  const fields = candidateFields(candidate)
  if (carryItem.itemId) room.updateItem(id, fields)
  else room.addItem({ id, catalogId: carryItem.catalogId, ...fields })

  if (keep && !carryItem.itemId) return true // same item stays in hand
  placement.candidate = null
  useUi.setState({ carryItem: null, selectedItemId: id })
  setCameraLocked(false)
  return true
}

export function rotateInHand(dir: 1 | -1) {
  const { carryItem } = useUi.getState()
  if (carryItem) useUi.setState({ carryItem: { ...carryItem, rot: carryItem.rot + dir * STEP } })
}

export function rotateSelected(dir: 1 | -1) {
  const { selectedItemId } = useUi.getState()
  const item = findItem(selectedItemId)
  if (!item || item.wall) return
  const rot = item.rot + dir * STEP
  const turned = { ...candidateOf(item), rot } as ReturnType<typeof candidateOf>
  if (!isValid(turned, item.catalogId, subtree(useRoom.getState().doc.items, item.id))) return shake(item.id)
  useRoom.getState().updateItem(item.id, { rot })
  // The frame snaps to the new angle; the inner group starts at the old one and eases over
  const anim = itemAnims.get(item.id)
  if (anim) gsap.fromTo(anim.rotation, { y: -dir * STEP }, { y: 0, duration: 0.45, ease: 'back.out(1.8)' })
}

/** A little "nope" wiggle when an action is blocked. */
export function shake(id: string) {
  const anim = itemAnims.get(id)
  if (anim) gsap.fromTo(anim.position, { x: -0.05 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.2)' })
}

export function removeSelectedItem() {
  const { selectedItemId: id } = useUi.getState()
  if (!id) return
  useUi.setState({ selectedItemId: null })
  const remove = () => useRoom.getState().removeItem(id)
  const anim = itemAnims.get(id)
  if (!anim) return remove()
  gsap.to(anim.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3, ease: 'back.in(2)', onComplete: remove })
}

export function duplicateSelected() {
  const { selectedItemId } = useUi.getState()
  const item = findItem(selectedItemId)
  const obj = selectedItemId ? itemObjects.get(selectedItemId) : undefined
  if (item) startPlacing(item.catalogId, obj ? worldYaw(obj) : item.rot)
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
