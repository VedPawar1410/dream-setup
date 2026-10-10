import { create } from 'zustand'
import { useRoom, type RoomDoc } from './roomStore'

// Undo/redo. Room docs are immutable (every edit makes a new object), so a snapshot is
// just a reference to the previous doc: no copying, and 100 steps cost almost nothing.

const LIMIT = 100
const MERGE_MS = 400 // edits with the same key closer together than this are one step

let past: RoomDoc[] = []
let future: RoomDoc[] = []
let lastKey = ''
let lastAt = 0
let batching = false

/** For the undo/redo buttons. */
export const useHistory = create(() => ({ canUndo: false, canRedo: false }))
const sync = () => useHistory.setState({ canUndo: past.length > 0, canRedo: future.length > 0 })

/**
 * Called by the room store just before an edit lands, with the doc as it was. A burst of
 * edits under one key (dragging a colour, scrubbing a size) merges into a single step.
 */
export function record(prev: RoomDoc, key: string) {
  if (batching) return
  const now = performance.now()
  const merge = key === lastKey && now - lastAt < MERGE_MS
  lastKey = key
  lastAt = now
  if (merge) return
  past.push(prev)
  if (past.length > LIMIT) past.shift()
  future = []
  sync()
}

/** Run several store edits as one undo step. */
export function batch(key: string, edits: () => void) {
  record(useRoom.getState().doc, key)
  batching = true
  try {
    edits()
  } finally {
    batching = false
  }
}

function step(from: RoomDoc[], to: RoomDoc[]) {
  const target = from.pop()
  if (!target) return false
  const now = useRoom.getState().doc
  to.push(now)
  // Weather and on/off switches aren't edits: going back in time keeps them as they are now
  const on = new Map(now.items.map((it) => [it.id, it.on]))
  const items = target.items.map((it) => (on.has(it.id) && on.get(it.id) !== it.on ? { ...it, on: on.get(it.id) } : it))
  lastKey = '' // the next edit always starts a fresh step
  useRoom.setState({ doc: { ...target, items, atmosphere: now.atmosphere } })
  sync()
  return true
}

export const undo = () => step(past, future)
export const redo = () => step(future, past)

/** A different room was loaded: its history starts empty. */
export function clearHistory() {
  past = []
  future = []
  lastKey = ''
  sync()
}
