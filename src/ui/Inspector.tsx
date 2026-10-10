import { Suspense, use, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { catalogById } from '../catalog/catalog'
import { loadPrototype } from '../catalog/models'
import { slotsOf } from '../scene/colors'
import { resetItemColors, resizeItem, setItemColor, setItemScreen, setPaintTarget } from '../scene/decorateActions'
import { SCREEN_MODES } from '../scene/screens'
import { FLOOR_MATERIALS, FLOOR_SWATCHES, floorPreview, WALL_PATTERNS, WALL_SWATCHES, wallPreview } from '../scene/surfaces'
import { SCALE_MAX, SCALE_MIN, type Scale } from '../store/itemRules'
import { WALL_LABELS, wallsOf } from '../store/layout'
import { useRoom, type WallSide } from '../store/roomStore'
import { useUi } from '../store/uiStore'
import ColorPicker from './ColorPicker'

const ITEM_SWATCHES = ['#f4efe8', '#d9cbbd', '#c8956a', '#7c5236', '#2b2433', '#5c5f66', '#e8a0a0', '#d98a7a', '#e8c46a', '#9fc29a', '#7fa8c9', '#b18cff']

/** Decorate mode's right-hand panel: the selected item's colours, or the room's finishes. */
export default function Inspector() {
  const mode = useUi((s) => s.mode)
  const selectedItemId = useUi((s) => s.selectedItemId)
  const placing = useUi((s) => s.carryItem !== null)
  const panel = useRef<HTMLElement>(null)
  const on = mode === 'decorate' && !placing

  useGSAP(
    () => {
      gsap.to(panel.current, { autoAlpha: on ? 1 : 0, x: on ? 0 : 32, duration: on ? 0.5 : 0.25, ease: on ? 'power3.out' : 'power2.in', overwrite: true })
    },
    { dependencies: [on], scope: panel },
  )

  // Swap animation when switching between an item and the room
  useGSAP(
    () => {
      if (on) gsap.from('.inspector-body', { y: 10, opacity: 0, duration: 0.35, ease: 'power3.out' })
    },
    { dependencies: [selectedItemId, on], scope: panel },
  )

  return (
    <aside className="panel inspector" ref={panel} aria-label="Inspector">
      <div className="inspector-body" key={selectedItemId ?? 'room'}>
        {selectedItemId ? (
          <Suspense fallback={<p className="panel-note">Loading…</p>}>
            <ItemColors id={selectedItemId} />
          </Suspense>
        ) : (
          <RoomStyle />
        )}
      </div>
    </aside>
  )
}

function ItemColors({ id }: { id: string }) {
  const item = useRoom((s) => s.doc.items.find((it) => it.id === id))
  const entry = item ? catalogById.get(item.catalogId) : undefined
  if (!item || !entry) return null
  return (
    <>
      <ItemSize id={id} catalogId={entry.id} name={entry.name} size={item.size} />
      {entry.screen && (
        <section className="panel-section">
          <h2>Screen</h2>
          <div className="chips screen-modes">
            {SCREEN_MODES.map((m) => (
              <button key={m.id} className={`chip${(item.screen ?? 'wallpaper') === m.id ? ' active' : ''}`} data-sound="toggle" onClick={() => setItemScreen(id, m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </section>
      )}
      <ItemColorSlots id={id} catalogId={entry.id} colors={item.colors} />
    </>
  )
}

const ONE: Scale = { w: 1, d: 1, h: 1 }
const AXES = [
  { key: 'w', label: 'Width', dim: 'x' },
  { key: 'd', label: 'Depth', dim: 'z' },
  { key: 'h', label: 'Height', dim: 'y' },
] as const

/** Width, depth and height in centimetres. Locked, all three change together. */
function ItemSize({ id, catalogId, name, size }: { id: string; catalogId: string; name: string; size?: Scale }) {
  const base = use(loadPrototype(catalogById.get(catalogId)!)).size
  const [locked, setLocked] = useState(true)
  const k = size ?? ONE

  const change = (axis: keyof Scale, cm: number, baseM: number) => {
    const ratio = cm / 100 / baseM
    if (!(ratio > 0)) return
    if (locked) {
      const f = ratio / k[axis]
      resizeItem(id, { w: k.w * f, d: k.d * f, h: k.h * f })
    } else resizeItem(id, { ...k, [axis]: ratio })
  }

  return (
    <section className="panel-section">
      <h2>{name}</h2>
      <div className="size-head">
        <span className="dim-title">Size</span>
        <button className={`lock-btn${locked ? ' on' : ''}`} onClick={() => setLocked(!locked)} aria-pressed={locked} title={locked ? 'Proportions locked' : 'Proportions unlocked'}>
          <svg viewBox="0 0 24 24">{locked ? <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /> : <path d="M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z" />}</svg>
          {locked ? 'Locked' : 'Free'}
        </button>
      </div>
      <div className="size-fields">
        {AXES.map((a) => {
          const baseM = base[a.dim]
          return (
            <ScrubField
              key={a.key}
              label={a.label}
              value={Math.round(baseM * k[a.key] * 100)}
              min={Math.ceil(baseM * SCALE_MIN * 100)}
              max={Math.floor(baseM * SCALE_MAX * 100)}
              onChange={(cm) => change(a.key, cm, baseM)}
            />
          )
        })}
      </div>
      {size ? (
        <button className="ghost-btn" onClick={() => resizeItem(id, ONE)}>
          Reset to original size
        </button>
      ) : (
        <p className="panel-note">Drag a label or type a size. Unlock to stretch one side (details stretch too).</p>
      )}
    </section>
  )
}

/**
 * A number field whose label you can drag sideways to scrub the value, like in design
 * tools. Typing commits on Enter or when you leave the field.
 */
function ScrubField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const clampCm = (v: number) => Math.min(max, Math.max(min, Math.round(v)))

  const startScrub = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const x0 = e.clientX
    const v0 = value
    let last = v0
    const move = (ev: PointerEvent) => {
      const next = clampCm(v0 + (ev.clientX - x0) * 0.5) // half a centimetre per pixel
      if (next !== last) onChange((last = next))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const commit = () => {
    if (draft !== null && draft.trim() !== '') onChange(clampCm(Number(draft)))
    setDraft(null)
  }

  return (
    <label className="size-field">
      <span className="scrub" onPointerDown={startScrub}>
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation() // typing digits mustn't trigger scene shortcuts
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <span className="unit">cm</span>
    </label>
  )
}

function ItemColorSlots({ id, catalogId, colors }: { id: string; catalogId: string; colors?: Record<string, string> }) {
  const proto = use(loadPrototype(catalogById.get(catalogId)!)) // suspends until the model is ready
  const slots = slotsOf(catalogId, proto.object)
  const [open, setOpen] = useState<string | null>(slots[0]?.name ?? null)

  return (
    <section className="panel-section">
      <h2>Colours</h2>
      {slots.length === 0 && <p className="panel-note">This item has no colours to change.</p>}
      <div className="slots">
        {slots.map((slot) => {
          const value = colors?.[slot.name] ?? slot.color
          const isOpen = open === slot.name
          return (
            <div key={slot.name} className={`slot${isOpen ? ' open' : ''}`}>
              <button className="slot-row" onClick={() => setOpen(isOpen ? null : slot.name)} aria-expanded={isOpen}>
                <span className="slot-swatch" style={{ backgroundColor: value }} />
                <span className="slot-label">{slot.label}</span>
                <span className="slot-hex">{value}</span>
              </button>
              {isOpen && <ColorPicker value={value} onChange={(hex) => setItemColor(id, slot.name, hex)} swatches={ITEM_SWATCHES} />}
            </div>
          )
        })}
      </div>
      {colors && Object.keys(colors).length > 0 && (
        <button className="ghost-btn" onClick={() => resetItemColors(id)}>
          Reset to original colours
        </button>
      )}
    </section>
  )
}


function RoomStyle() {
  const tab = useUi((s) => s.roomTab)
  const target = useUi((s) => s.paintTarget)
  const shell = useRoom((s) => s.doc.shell)
  const setWallFinish = useRoom((s) => s.setWallFinish)
  const setFloor = useRoom((s) => s.setFloor)
  // Every wall the room has (an L adds two inner walls, two rooms add the divider)
  const targets: { id: WallSide | 'all'; label: string }[] = [{ id: 'all', label: 'All walls' }, ...wallsOf(shell).map((w) => ({ id: w.id, label: WALL_LABELS[w.id] ?? w.id }))]
  // With "All walls" the controls show one wall's finish as the starting point
  const wall = shell.walls[target === 'all' ? 'north' : target] ?? shell.walls.north

  return (
    <section className="panel-section">
      <h2>Room</h2>
      <div className="seg" role="tablist">
        {(['walls', 'floor'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`seg-btn${tab === t ? ' active' : ''}`} onClick={() => useUi.setState({ roomTab: t })}>
            {t === 'walls' ? 'Walls' : 'Floor'}
          </button>
        ))}
      </div>

      {tab === 'walls' ? (
        <>
          <div className="targets" aria-label="Which walls">
            {targets.map((t) => (
              <button key={t.id} className={`chip${target === t.id ? ' active' : ''}`} onClick={() => setPaintTarget(t.id)} title={t.id === 'all' ? 'All walls' : `${t.id} wall`}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="panel-note">Tip: click a wall in the room to pick it.</p>
          <div className="patterns">
            {WALL_PATTERNS.map((p) => (
              <PatternTile key={p.id} label={p.label} image={wallPreview(p.id)} color={wall.color} active={wall.pattern === p.id} onClick={() => setWallFinish(target, { pattern: p.id })} />
            ))}
          </div>
          <ColorPicker value={wall.color} onChange={(color) => setWallFinish(target, { color })} swatches={WALL_SWATCHES} />
        </>
      ) : (
        <>
          <div className="patterns">
            {FLOOR_MATERIALS.map((m) => (
              <PatternTile key={m.id} label={m.label} image={floorPreview(m.id)} color={shell.floor.color} active={shell.floor.material === m.id} onClick={() => setFloor({ material: m.id })} />
            ))}
          </div>
          <ColorPicker value={shell.floor.color} onChange={(color) => setFloor({ color })} swatches={FLOOR_SWATCHES} />
        </>
      )}
    </section>
  )
}

/** A swatch tile tinted the same way the 3D material is: the colour multiplied over the pattern. */
function PatternTile({ label, image, color, active, onClick }: { label: string; image: string | null; color: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`pattern${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="pattern-img" style={{ backgroundColor: color, backgroundImage: image ? `url(${image})` : undefined }} />
      {label}
    </button>
  )
}
