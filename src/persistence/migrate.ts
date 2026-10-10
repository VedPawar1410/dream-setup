import { CATALOG } from '../catalog/catalog'
import type { Weather } from '../scene/atmosphere'
import { SCREEN_MODES } from '../scene/screens'
import { FLOOR_MATERIALS, WALL_PATTERNS } from '../scene/surfaces'
import { defaultRoom, type FloorFinish, type Opening, type PlacedItem, type RoomDoc, type WallFinish, type WallSide } from '../store/roomStore'
import { SCALE_MAX, SCALE_MIN } from '../store/itemRules'
import { ROOM } from '../store/rules'

// Everything that loads a room goes through here: saves from IndexedDB, imported files,
// and (later) rooms saved by older versions. It fills in anything missing, clamps sizes,
// and drops anything malformed, so a bad file shows an error instead of breaking the scene.

const SIDES: WallSide[] = ['north', 'east', 'south', 'west']
const WEATHERS: Weather[] = ['sunny', 'sunset', 'rain', 'snow', 'night']
const PATTERNS = new Set<string>(WALL_PATTERNS.map((p) => p.id))
const FLOORS = new Set<string>(FLOOR_MATERIALS.map((m) => m.id))
const CATALOG_IDS = new Set(CATALOG.map((c) => c.id))
const SCREENS = new Set<string>(SCREEN_MODES.map((m) => m.id))

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export class NotARoomError extends Error {
  constructor() {
    super("This file isn't a Dream Setup room.")
  }
}

function wallFinish(v: unknown, legacyColor: unknown, side: WallSide): WallFinish {
  if (isObj(v) && isStr(v.pattern) && PATTERNS.has(v.pattern) && isHex(v.color)) return { pattern: v.pattern as WallFinish['pattern'], color: v.color }
  if (isHex(legacyColor)) return { pattern: 'paint', color: legacyColor } // before per-wall finishes
  return defaultRoom.shell.walls[side]
}

function floorFinish(v: unknown, legacyColor: unknown): FloorFinish {
  if (isObj(v) && isStr(v.material) && FLOORS.has(v.material) && isHex(v.color)) return { material: v.material as FloorFinish['material'], color: v.color }
  if (isHex(legacyColor)) return { material: 'planks', color: legacyColor }
  return defaultRoom.shell.floor
}

function opening(v: unknown): Opening | null {
  if (!isObj(v) || !isStr(v.id) || (v.kind !== 'window' && v.kind !== 'door') || !SIDES.includes(v.wall as WallSide)) return null
  if (![v.offset, v.width, v.height, v.sill].every(isNum)) return null
  return { id: v.id, kind: v.kind, wall: v.wall as WallSide, offset: v.offset as number, width: v.width as number, height: v.height as number, sill: v.sill as number }
}

function item(v: unknown): PlacedItem | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.catalogId) || !CATALOG_IDS.has(v.catalogId)) return null
  if (![v.x, v.z, v.rot].every(isNum)) return null
  const out: PlacedItem = { id: v.id, catalogId: v.catalogId, x: v.x as number, z: v.z as number, rot: v.rot as number, parentId: isStr(v.parentId) ? v.parentId : null }
  if (isObj(v.wall)) {
    const w = v.wall
    if (!SIDES.includes(w.side as WallSide) || !isNum(w.along) || !isNum(w.y)) return null
    out.wall = { side: w.side as WallSide, along: w.along, y: w.y }
  }
  if (isObj(v.colors)) {
    const colors = Object.fromEntries(Object.entries(v.colors).filter(([, c]) => isHex(c))) as Record<string, string>
    if (Object.keys(colors).length) out.colors = colors
  }
  if (v.on === false) out.on = false
  if (typeof v.screen === 'string' && SCREENS.has(v.screen) && v.screen !== 'wallpaper') out.screen = v.screen as PlacedItem['screen']
  // Resized items: each multiplier clamped to the allowed range; nonsense is dropped
  if (isObj(v.size) && [v.size.w, v.size.d, v.size.h].every(isNum)) {
    const k = v.size as { w: number; d: number; h: number }
    out.size = { w: clamp(k.w, SCALE_MIN, SCALE_MAX), d: clamp(k.d, SCALE_MIN, SCALE_MAX), h: clamp(k.h, SCALE_MIN, SCALE_MAX) }
  }
  return out
}

/** Keep only items whose whole parent chain survived validation. */
function withoutOrphans(items: PlacedItem[]) {
  let kept = items
  for (;;) {
    const ids = new Set(kept.map((it) => it.id))
    const next = kept.filter((it) => !it.parentId || ids.has(it.parentId))
    if (next.length === kept.length) return kept
    kept = next
  }
}

export function migrate(raw: unknown): RoomDoc {
  if (!isObj(raw) || !isObj(raw.shell) || !Array.isArray(raw.items)) throw new NotARoomError()
  const s = raw.shell
  const d = defaultRoom.shell
  const walls = isObj(s.walls) ? s.walls : {}

  const atmosphere = isObj(raw.atmosphere) ? raw.atmosphere : {}
  return {
    version: 1,
    shell: {
      width: clamp(isNum(s.width) ? s.width : d.width, ROOM.min, ROOM.max),
      depth: clamp(isNum(s.depth) ? s.depth : d.depth, ROOM.min, ROOM.max),
      height: clamp(isNum(s.height) ? s.height : d.height, ROOM.minHeight, ROOM.maxHeight),
      walls: Object.fromEntries(SIDES.map((side) => [side, wallFinish(walls[side], s.wallColor, side)])) as Record<WallSide, WallFinish>,
      floor: floorFinish(s.floor, s.floorColor),
      openings: Array.isArray(s.openings) ? s.openings.map(opening).filter((o): o is Opening => !!o) : [],
    },
    items: withoutOrphans(raw.items.map(item).filter((it): it is PlacedItem => !!it)),
    atmosphere: {
      weather: WEATHERS.includes(atmosphere.weather as Weather) ? (atmosphere.weather as Weather) : 'sunny',
      rgbCycle: atmosphere.rgbCycle === true,
    },
  }
}

/** Exported files wrap the room so they're recognisable and can carry a name. */
export type RoomFile = { app: 'dream-setup'; version: 1; name: string; doc: RoomDoc }

export function parseRoomFile(text: string, fallbackName: string): { name: string; doc: RoomDoc } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new NotARoomError()
  }
  // Accept the wrapped export format, or a bare room document
  if (isObj(raw) && raw.app === 'dream-setup') return { name: isStr(raw.name) ? raw.name : fallbackName, doc: migrate(raw.doc) }
  return { name: fallbackName, doc: migrate(raw) }
}
