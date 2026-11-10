import { describe, expect, it } from 'vitest'
import { rectsOverlap } from './itemRules'
import { fitShape, wallsOf } from './layout'

describe('wallsOf', () => {
  it('gives a rectangle its four walls', () => {
    expect(wallsOf({ width: 5, depth: 4 }).map((w) => w.id)).toEqual(['north', 'east', 'south', 'west'])
  })

  it('gives an L-shape six walls, including the two around the cut-out', () => {
    const shape = fitShape({ kind: 'l', corner: 'ne', cutW: 1.5, cutD: 1.5 }, 5, 4)
    expect(wallsOf({ width: 5, depth: 4, shape }).map((w) => w.id)).toEqual(['north', 'east', 'south', 'west', 'inner-h', 'inner-v'])
  })

  it('adds a divider for a two-room layout', () => {
    const shape = fitShape({ kind: 'split', at: 0 }, 5, 4)
    expect(wallsOf({ width: 5, depth: 4, shape }).map((w) => w.id)).toContain('divider')
  })
})

describe('rectsOverlap', () => {
  const box = (x: number, z: number, rot = 0) => ({ x, z, hw: 0.5, hd: 0.5, rot })

  it('detects overlapping and separate footprints', () => {
    expect(rectsOverlap(box(0, 0), box(0.6, 0))).toBe(true)
    expect(rectsOverlap(box(0, 0), box(1.2, 0))).toBe(false)
  })

  it('treats touching edges as not overlapping, so items can sit flush', () => {
    expect(rectsOverlap(box(0, 0), box(1, 0))).toBe(false)
  })

  it('accounts for rotation', () => {
    // Rotated 45°, a 1 m box reaches ~0.71 m sideways, so these now collide
    expect(rectsOverlap(box(0, 0, Math.PI / 4), box(1.15, 0, Math.PI / 4))).toBe(true)
  })
})
