import { useRef } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { setMode } from '../scene/blueprintActions'
import { useUi, type Mode } from '../store/uiStore'

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'view',
    label: 'View',
    icon: <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  },
  {
    id: 'decorate',
    label: 'Decorate',
    icon: <path d="M4 18v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M6 11V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3M4 18h16M6 18v2m12-2v2" />,
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    icon: <path d="M3 3h18v18H3zM3 9h6m4 0h8M9 3v12m0 4v2m4-12v12" />,
  },
]

const KEYS: Record<Mode, string> = { view: '1', decorate: '2 or C', blueprint: '3 or B' }

export default function ModeSwitch() {
  const mode = useUi((s) => s.mode)
  const root = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  // The highlight pill slides to the active button. Measured from the DOM, so it
  // fits buttons of any width.
  useGSAP(
    () => {
      const btn = root.current!.querySelector<HTMLElement>(`[data-mode="${mode}"]`)!
      const to = { x: btn.offsetLeft, width: btn.offsetWidth }
      if (placed.current) gsap.to(pill.current, { ...to, duration: 0.45, ease: 'power3.out', overwrite: true })
      else gsap.set(pill.current, to)
      placed.current = true
    },
    { dependencies: [mode], scope: root },
  )

  return (
    <div className="mode-switch" ref={root} role="tablist" aria-label="Mode">
      <span className="mode-pill" ref={pill} />
      {MODES.map((m) => (
        <button
          key={m.id}
          className="mode-btn"
          data-mode={m.id}
          data-sound="toggle"
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => setMode(m.id)}
          title={`${m.label} (${KEYS[m.id]})`}
          aria-label={m.label}
        >
          <svg viewBox="0 0 24 24">{m.icon}</svg>
          <span className="mode-label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
