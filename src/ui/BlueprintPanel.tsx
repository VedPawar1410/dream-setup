import { useRef, type ReactNode } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { cancelCarry, removeSelected, startAdding } from '../scene/blueprintActions'
import { useRoom, type Opening } from '../store/roomStore'
import { OPENING_LIMITS, ROOM } from '../store/rules'
import { useUi } from '../store/uiStore'

export default function BlueprintPanel() {
  const mode = useUi((s) => s.mode)
  const selectedId = useUi((s) => s.selectedId)
  const carry = useUi((s) => s.carry)
  const shell = useRoom((s) => s.doc.shell)
  const resize = useRoom((s) => s.resize)
  const updateOpening = useRoom((s) => s.updateOpening)
  const panel = useRef<HTMLElement>(null)

  const selected = shell.openings.find((o) => o.id === selectedId)
  const adding = carry?.isNew ? carry.item.kind : null

  // The panel stays mounted and GSAP slides it in and out, so the exit can animate
  // too (unmounting would remove it instantly).
  useGSAP(
    () => {
      const on = mode === 'blueprint'
      gsap.to(panel.current, { autoAlpha: on ? 1 : 0, x: on ? 0 : 32, duration: on ? 0.55 : 0.3, ease: on ? 'power3.out' : 'power2.in', overwrite: true })
      if (on) gsap.from('.panel-section', { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07, delay: 0.1 })
    },
    { dependencies: [mode], scope: panel },
  )

  useGSAP(
    () => {
      if (selectedId) gsap.from('.selected-section', { y: 10, opacity: 0, duration: 0.4, ease: 'power3.out' })
    },
    { dependencies: [selectedId], scope: panel },
  )

  const toggleTool = (kind: Opening['kind']) => (adding === kind ? cancelCarry() : startAdding(kind))

  return (
    <aside className="panel" ref={panel} aria-label="Blueprint tools">
      <section className="panel-section">
        <h2>Room</h2>
        <Slider label="Width" value={shell.width} min={ROOM.min} max={ROOM.max} step={0.1} onChange={(width) => resize({ width })} />
        <Slider label="Depth" value={shell.depth} min={ROOM.min} max={ROOM.max} step={0.1} onChange={(depth) => resize({ depth })} />
        <Slider label="Height" value={shell.height} min={ROOM.minHeight} max={ROOM.maxHeight} step={0.05} onChange={(height) => resize({ height })} />
      </section>

      <section className="panel-section">
        <h2>Add</h2>
        <div className="tool-row">
          <ToolButton label="Window" active={adding === 'window'} onClick={() => toggleTool('window')}>
            <path d="M4 4h16v16H4zM12 4v16M4 12h16" />
          </ToolButton>
          <ToolButton label="Door" active={adding === 'door'} onClick={() => toggleTool('door')}>
            <path d="M6 21V3h12v18M3 21h18M14.5 12.5h.01" />
          </ToolButton>
        </div>
        {adding && <p className="panel-hint">Click a wall to place it · Esc to cancel</p>}
      </section>

      {selected && (
        <section className="panel-section selected-section" key={selected.id}>
          <h2>{selected.kind === 'window' ? 'Window' : 'Door'}</h2>
          {/* The store rejects edits that don't fit, so a slider simply stops at the limit */}
          <Slider
            label="Width"
            value={selected.width}
            min={OPENING_LIMITS[selected.kind].width[0]}
            max={OPENING_LIMITS[selected.kind].width[1]}
            step={0.05}
            onChange={(width) => updateOpening(selected.id, { width })}
          />
          <Slider
            label="Height"
            value={selected.height}
            min={OPENING_LIMITS[selected.kind].height[0]}
            max={OPENING_LIMITS[selected.kind].height[1]}
            step={0.05}
            onChange={(height) => updateOpening(selected.id, { height })}
          />
          {selected.kind === 'window' && (
            <Slider
              label="Sill"
              value={selected.sill}
              min={OPENING_LIMITS.window.sill[0]}
              max={OPENING_LIMITS.window.sill[1]}
              step={0.05}
              onChange={(sill) => updateOpening(selected.id, { sill })}
            />
          )}
          <button className="danger-btn" onClick={removeSelected}>
            Delete {selected.kind}
          </button>
        </section>
      )}
    </aside>
  )
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <label className="slider">
      <span>{label}</span>
      <output>{value.toFixed(2)} m</output>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function ToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`tool-btn${active ? ' active' : ''}`} aria-pressed={active} onClick={onClick}>
      <svg viewBox="0 0 24 24">{children}</svg>
      {label}
    </button>
  )
}
