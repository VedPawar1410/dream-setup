import { Suspense, use, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { catalogById } from '../catalog/catalog'
import { loadPrototype } from '../catalog/models'
import { slotsOf } from '../scene/colors'
import { resetItemColors, setItemColor, setPaintTarget } from '../scene/decorateActions'
import { FLOOR_MATERIALS, FLOOR_SWATCHES, floorPreview, WALL_PATTERNS, WALL_SWATCHES, wallPreview } from '../scene/surfaces'
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
  return <ItemColorSlots id={id} catalogId={entry.id} name={entry.name} colors={item.colors} />
}

function ItemColorSlots({ id, catalogId, name, colors }: { id: string; catalogId: string; name: string; colors?: Record<string, string> }) {
  const proto = use(loadPrototype(catalogById.get(catalogId)!)) // suspends until the model is ready
  const slots = slotsOf(catalogId, proto.object)
  const [open, setOpen] = useState<string | null>(slots[0]?.name ?? null)

  return (
    <section className="panel-section">
      <h2>{name}</h2>
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

const TARGETS: { id: WallSide | 'all'; label: string }[] = [
  { id: 'all', label: 'All walls' },
  { id: 'north', label: 'N' },
  { id: 'east', label: 'E' },
  { id: 'south', label: 'S' },
  { id: 'west', label: 'W' },
]

function RoomStyle() {
  const tab = useUi((s) => s.roomTab)
  const target = useUi((s) => s.paintTarget)
  const shell = useRoom((s) => s.doc.shell)
  const setWallFinish = useRoom((s) => s.setWallFinish)
  const setFloor = useRoom((s) => s.setFloor)
  // With "All walls" the controls show one wall's finish as the starting point
  const wall = shell.walls[target === 'all' ? 'north' : target]

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
            {TARGETS.map((t) => (
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
