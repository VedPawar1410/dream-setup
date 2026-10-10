import { gsap } from '../anim/gsap'
import { intro } from '../anim/intro'
import { boop, play, plop } from '../audio/sound'
import { sizeOfItem } from '../catalog/models'
import { batch, redo, undo } from '../store/history'
import { fitShape, RECT, wallsOf, type RoomShape } from '../store/layout'
import { openingHitsWallItems, shellFits } from '../store/itemRules'
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
  // Someone else's shared room is view-only
  if (ui.mode === mode || !intro.done || ui.firstPerson || ui.photo || ui.viewing) return
  if (ui.carry) cancelCarry()
  if (ui.carryItem) cancelItemCarry()
  useUi.setState({ mode, selectedId: null, selectedItemId: null })
  // Only blueprint has its own camera angle; view ↔ decorate keeps yours
  if (mode === 'blueprint' || ui.mode === 'blueprint') setBlueprintView(mode === 'blueprint')
}

/**
 * Cmd+Z / Shift+Cmd+Z. Anything in hand is dropped back first, and a selection whose
 * item or opening no longer exists after the jump is cleared.
 */
export function undoRedo(dir: -1 | 1) {
  const ui = useUi.getState()
  if (!intro.done || ui.photo || ui.firstPerson) return
  if (ui.carry) cancelCarry()
  if (ui.carryItem) cancelItemCarry()
  if (!(dir < 0 ? undo() : redo())) return
  play('toggle')
  const { items, shell } = useRoom.getState().doc
  const { selectedItemId, selectedId } = useUi.getState()
  if (selectedItemId && !items.some((it) => it.id === selectedItemId)) useUi.setState({ selectedItemId: null })
  if (selectedId && !shell.openings.some((o) => o.id === selectedId)) useUi.setState({ selectedId: null })
}

/**
 * Switch the room between Rectangle, L-shape and Two rooms, as one undo step. Doors and
 * windows on walls that won't exist go with them; switching to two rooms adds a doorway
 * in the divider. Returns why it can't, if furniture is in the way.
 */
export function setRoomShape(kind: RoomShape['kind']): string | null {
  const room = useRoom.getState()
  const { shell, items } = room.doc
  if ((shell.shape ?? RECT).kind === kind) return null
  // An L tries each corner in turn and cuts the first one that's free of furniture
  const candidates: RoomShape[] =
    kind === 'l'
      ? (['ne', 'nw', 'se', 'sw'] as const).map((corner) => fitShape({ kind: 'l', corner, cutW: Math.min(1.6, shell.width / 2), cutD: Math.min(1.4, shell.depth / 2) }, shell.width, shell.depth))
      : [kind === 'split' ? { kind: 'split', at: 0 } : RECT]
  const withoutGoneWalls = (shape: RoomShape) => {
    const keep = new Set(wallsOf({ ...shell, shape }).map((w) => w.id))
    return { keep, openings: shell.openings.filter((o) => keep.has(o.wall)) }
  }
  // Check before touching anything, so a refusal leaves the room exactly as it was
  const shape = candidates.find((c) => shellFits({ ...shell, shape: c, openings: withoutGoneWalls(c).openings }, items, sizeOfItem))
  if (!shape) {
    play('error')
    return kind === 'rect'
      ? 'Something is hanging on a wall that would disappear. Move it first.'
      : kind === 'l'
        ? 'Every corner has furniture in it. Clear one corner, then try again.'
        : 'Some furniture is where the divider would go. Move it, then try again.'
  }
  const { keep } = withoutGoneWalls(shape)
  batch('shape', () => {
    for (const o of shell.openings) if (!keep.has(o.wall)) useRoom.getState().removeOpening(o.id)
    useRoom.getState().resize({ shape })
    if (kind === 'split') useRoom.getState().addOpening({ id: crypto.randomUUID(), kind: 'door', wall: 'divider', offset: 0, ...OPENING_DEFAULTS.door })
  })
  plop()
  return null
}

/** Reshape an existing L or divider (corner, cut-out size, divider position). */
export function updateRoomShape(shape: RoomShape) {
  if (!useRoom.getState().resize({ shape })) play('error')
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
  boop()
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
    !openingHitsWallItems(candidate, useRoom.getState().doc.items, sizeOfItem)
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
      plop()
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
