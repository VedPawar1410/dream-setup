import { gsap } from '../anim/gsap'
import { intro } from '../anim/intro'
import { play } from '../audio/sound'
import { itemSizes } from '../catalog/models'
import { openingHitsWallItems } from '../store/itemRules'
import { useRoom, type Opening, type WallSide } from '../store/roomStore'
import { isValidOpening, offsetLimit, OPENING_DEFAULTS } from '../store/rules'
import { useUi, type Mode } from '../store/uiStore'
import { setBlueprintView, setCameraLocked } from './camera'
import { cancelItemCarry } from './decorateActions'
import { openingObjects } from './sceneRefs'

// Editor actions shared by the 3D scene, the HUD and the keyboard. Plain functions
// over the stores (getState/setState) so any of them can call these without hooks.

const snap = (v: number, step: number) => Math.round(v / step) * step

export function setMode(mode: Mode) {
  const ui = useUi.getState()
  // Mode switches move the camera or open panels: not during the intro, while seated,
  // or while framing a photo
  if (ui.mode === mode || !intro.done || ui.firstPerson || ui.photo) return
  if (ui.carry) cancelCarry()
  if (ui.carryItem) cancelItemCarry()
  useUi.setState({ mode, selectedId: null, selectedItemId: null })
  // Only blueprint has its own camera angle; view ↔ decorate keeps yours
  if (mode === 'blueprint' || ui.mode === 'blueprint') setBlueprintView(mode === 'blueprint')
}

export const toggleBlueprint = () => setMode(useUi.getState().mode === 'blueprint' ? 'view' : 'blueprint')

export const select = (id: string | null) => useUi.setState({ selectedId: id })

export function startAdding(kind: Opening['kind']) {
  useUi.setState({
    carry: { item: { id: crypto.randomUUID(), kind, ...OPENING_DEFAULTS[kind] }, isNew: true },
    ghost: null,
    selectedId: null,
  })
}

export function startMoving(o: Opening) {
  const { wall, offset, ...item } = o
  useUi.setState({ carry: { item, isNew: false }, ghost: { wall, offset, valid: true }, selectedId: o.id })
  setCameraLocked(true)
  play('pickup')
}

/** The pointer is over `wall` at `rawOffset` along it: slide the ghost there, clamped to the wall. */
export function hoverWall(wall: WallSide, rawOffset: number, free: boolean) {
  const { carry } = useUi.getState()
  if (!carry) return
  const shell = useRoom.getState().doc.shell
  const limit = offsetLimit(shell, wall, carry.item.width)
  const offset = limit < 0 ? 0 : Math.min(limit, Math.max(-limit, free ? rawOffset : snap(rawOffset, 0.05)))
  const candidate = { ...carry.item, wall, offset }
  const valid =
    limit >= 0 &&
    isValidOpening(shell, candidate) &&
    !openingHitsWallItems(candidate, useRoom.getState().doc.items, (id) => itemSizes.get(id))
  useUi.setState({ ghost: { wall, offset, valid } })
}

export function drop() {
  const { carry, ghost } = useUi.getState()
  if (!carry) return
  if (ghost?.valid) {
    const room = useRoom.getState()
    const placed = carry.isNew
      ? room.addOpening({ ...carry.item, wall: ghost.wall, offset: ghost.offset })
      : room.updateOpening(carry.item.id, { wall: ghost.wall, offset: ghost.offset })
    if (placed) {
      play('place')
      useUi.setState({ carry: null, ghost: null, selectedId: carry.item.id })
      setCameraLocked(false)
      return
    }
  }
  // A new opening keeps waiting for a valid spot; a moved one goes back where it was.
  play('error')
  if (!carry.isNew) cancelCarry()
}

export function cancelCarry() {
  useUi.setState({ carry: null, ghost: null })
  setCameraLocked(false)
}

export function removeSelected() {
  const { selectedId } = useUi.getState()
  if (!selectedId) return
  useUi.setState({ selectedId: null })
  play('remove')
  const remove = () => useRoom.getState().removeOpening(selectedId)
  const obj = openingObjects.get(selectedId)
  if (!obj) return remove()
  // Shrink it away first, then actually remove it from the document
  gsap.to(obj.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.28, ease: 'back.in(2)', onComplete: remove })
}
