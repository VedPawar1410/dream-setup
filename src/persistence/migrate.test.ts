import { describe, expect, it } from 'vitest'
import { SUPABASE_URL } from '../backend/config'
import { defaultRoom } from '../store/roomStore'
import { SCALE_MAX, SCALE_MIN } from '../store/itemRules'
import { ROOM } from '../store/rules'
import { migrate, NotARoomError, parseRoomFile } from './migrate'

// Every saved, imported and shared room goes through migrate() before it renders, so a
// bug here can lose people's rooms. These tests pin down what it keeps, fixes and drops.

const clone = <T>(v: T): T => structuredClone(v)
const room = (patch: Record<string, unknown> = {}) => ({ ...clone(defaultRoom), ...patch })

describe('migrate', () => {
  it('keeps a valid room exactly as it is', () => {
    expect(migrate(clone(defaultRoom))).toEqual(defaultRoom)
  })

  it('rejects things that are not rooms', () => {
    for (const bad of [null, 42, 'room', [], {}, { shell: {}, items: 'nope' }]) {
      expect(() => migrate(bad)).toThrow(NotARoomError)
    }
  })

  it('clamps room dimensions into the allowed range', () => {
    const doc = migrate(room({ shell: { ...clone(defaultRoom.shell), width: 999, depth: 0.1, height: -1 } }))
    expect(doc.shell.width).toBe(ROOM.max)
    expect(doc.shell.depth).toBe(ROOM.min)
    expect(doc.shell.height).toBe(ROOM.minHeight)
  })

  it('upgrades rooms saved before per-wall finishes and floor materials existed', () => {
    const shell = { width: 5, depth: 4, height: 2.6, wallColor: '#112233', floorColor: '#445566', openings: [] }
    const doc = migrate({ shell, items: [] })
    expect(doc.shell.walls.north).toEqual({ pattern: 'paint', color: '#112233' })
    expect(doc.shell.floor).toEqual({ material: 'planks', color: '#445566' })
  })

  it('drops malformed items but keeps the good ones', () => {
    const items = [
      { id: 'ok', catalogId: 'desk', x: 0, z: 0, rot: 0, parentId: null },
      { id: 'unknown', catalogId: 'not-a-real-item', x: 0, z: 0, rot: 0 },
      { id: 'nan', catalogId: 'desk', x: Number.NaN, z: 0, rot: 0 },
      { id: 'no-pos', catalogId: 'desk' },
    ]
    expect(migrate(room({ items })).items.map((it) => it.id)).toEqual(['ok'])
  })

  it('drops items whose parent was dropped, all the way down the chain', () => {
    const items = [
      { id: 'gone', catalogId: 'not-a-real-item', x: 0, z: 0, rot: 0 },
      { id: 'child', catalogId: 'deskMat', x: 0, z: 0, rot: 0, parentId: 'gone' },
      { id: 'grandchild', catalogId: 'computerMouse', x: 0, z: 0, rot: 0, parentId: 'child' },
      { id: 'free', catalogId: 'desk', x: 0, z: 0, rot: 0 },
    ]
    expect(migrate(room({ items })).items.map((it) => it.id)).toEqual(['free'])
  })

  it('clamps resize multipliers and drops invalid colours', () => {
    const items = [{ id: 'a', catalogId: 'desk', x: 0, z: 0, rot: 0, size: { w: 50, d: 0, h: 1 }, colors: { wood: '#abcdef', metal: 'red' } }]
    const [it] = migrate(room({ items })).items
    expect(it.size).toEqual({ w: SCALE_MAX, d: SCALE_MIN, h: 1 })
    expect(it.colors).toEqual({ wood: '#abcdef' })
  })

  it('drops openings and wall items on walls the room shape does not have', () => {
    const shell = { ...clone(defaultRoom.shell), openings: [{ id: 'w', kind: 'window', wall: 'divider', offset: 1, width: 1, height: 1, sill: 1 }] }
    const items = [{ id: 'poster', catalogId: 'desk', x: 0, z: 0, rot: 0, wall: { side: 'inner-h', along: 1, y: 1 } }]
    const doc = migrate(room({ shell, items }))
    expect(doc.shell.openings).toEqual([])
    expect(doc.items).toEqual([])
  })

  it('only accepts uploaded models from our own storage bucket', () => {
    const ours = `${SUPABASE_URL}/storage/v1/object/public/models/u/scan.glb`
    const custom = {
      'custom:ours': { name: 'My lamp', url: ours, height: 0.5, mount: 'surface' },
      'custom:evil': { name: 'Tracker', url: 'https://evil.example/scan.glb', height: 0.5, mount: 'floor' },
    }
    const doc = migrate(room({ custom }))
    expect(Object.keys(doc.custom ?? {})).toEqual(['custom:ours'])
  })

  it('falls back to sunny for unknown weather', () => {
    expect(migrate(room({ atmosphere: { weather: 'hurricane' } })).atmosphere.weather).toBe('sunny')
  })
})

describe('parseRoomFile', () => {
  it('reads the exported file format and its name', () => {
    const file = JSON.stringify({ app: 'dream-setup', version: 1, name: 'Studio', doc: defaultRoom })
    expect(parseRoomFile(file, 'fallback').name).toBe('Studio')
  })

  it('accepts a bare room document, named after the file', () => {
    expect(parseRoomFile(JSON.stringify(defaultRoom), 'my-room').name).toBe('my-room')
  })

  it('turns broken JSON into a friendly error', () => {
    expect(() => parseRoomFile('{not json', 'x')).toThrow(NotARoomError)
  })
})
