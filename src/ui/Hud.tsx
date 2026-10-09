import { SplitText } from 'gsap/SplitText'
import { useRef } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { sceneReady } from '../anim/intro'
import { resetView, rotateQuarter } from '../scene/camera'
import { useUi, type Mode } from '../store/uiStore'
import BlueprintPanel from './BlueprintPanel'
import CatalogPanel from './CatalogPanel'
import Inspector from './Inspector'
import ModeSwitch from './ModeSwitch'
import SelectionBar from './SelectionBar'
import WeatherDock from './WeatherDock'

gsap.registerPlugin(SplitText)

const HINTS: Record<Mode, { keys: string[]; label: string }[]> = {
  view: [
    { keys: ['Drag'], label: 'Orbit' },
    { keys: ['Right-drag'], label: 'Pan' },
    { keys: ['Scroll'], label: 'Zoom' },
    { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
    { keys: ['Q', 'E'], label: 'Turn' },
    { keys: ['Click lamp'], label: 'Switch' },
    { keys: ['C'], label: 'Decorate' },
    { keys: ['B'], label: 'Blueprint' },
  ],
  decorate: [
    { keys: ['Click'], label: 'Select' },
    { keys: ['Drag'], label: 'Move item' },
    { keys: ['R'], label: 'Rotate' },
    { keys: ['Shift', 'Click'], label: 'Place more' },
    { keys: ['Del'], label: 'Delete' },
    { keys: ['Esc'], label: 'Back' },
  ],
  blueprint: [
    { keys: ['Drag handles'], label: 'Resize' },
    { keys: ['Click'], label: 'Select' },
    { keys: ['Drag'], label: 'Move opening' },
    { keys: ['Shift'], label: 'No snap' },
    { keys: ['Del'], label: 'Delete' },
    { keys: ['Esc'], label: 'Back' },
  ],
}

export default function Hud() {
  const root = useRef<HTMLDivElement>(null)
  const mode = useUi((s) => s.mode)
  const introDone = useRef(false)

  useGSAP(
    () => {
      // Each letter rises out of a mask; useGSAP reverts the split when the HUD unmounts.
      const split = SplitText.create('.title', { type: 'chars', mask: 'chars' })
      const tl = gsap
        .timeline({ paused: true, delay: 0.5, onComplete: () => void (introDone.current = true) })
        .from(split.chars, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.035 })
        .from('.subtitle', { opacity: 0, y: 8, duration: 0.6, ease: 'power2.out' }, '-=0.5')
        .from('.mode-switch, .weather-dock', { opacity: 0, y: -12, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, '-=0.4')
        // These land as the camera settles (the camera intro takes ~2.8s)
        .from('.dock > *', { opacity: 0, y: 20, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.08 }, 1.9)
      // Paused timelines still apply their "from" values, so the HUD stays hidden until then.
      // Guard against StrictMode's dev double-mount: the first, reverted timeline must not play.
      let live = true
      sceneReady.then(() => {
        if (live) tl.play()
      })
      return () => {
        live = false
      }
    },
    { scope: root },
  )

  // Swap the hint chips with a quick stagger when the mode changes
  useGSAP(
    () => {
      if (introDone.current) gsap.from('.hint', { opacity: 0, y: 6, duration: 0.35, ease: 'power2.out', stagger: 0.03 })
    },
    { dependencies: [mode], scope: root },
  )

  return (
    <div className="hud" ref={root}>
      <header className="topbar">
        <div>
          <h1 className="title">Dream Setup</h1>
          <p className="subtitle">Your room</p>
        </div>
        <ModeSwitch />
        <WeatherDock />
      </header>

      <BlueprintPanel />
      <CatalogPanel />
      <Inspector />
      <SelectionBar />
      <div className="dock">
        <div className="hints">
          {HINTS[mode].map((h) => (
            <span className="hint" key={mode + h.label}>
              {h.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
              <span>{h.label}</span>
            </span>
          ))}
        </div>
        <div className="cam-buttons">
          <button className="icon-btn" onClick={() => rotateQuarter(-1)} aria-label="Turn left (Q)" title="Turn left (Q)">
            <svg viewBox="0 0 24 24"><path d="M9 6H4v5M4.5 10.5A8 8 0 1 1 6 17" /></svg>
          </button>
          <button className="icon-btn" onClick={resetView} aria-label="Reset view (R)" title="Reset view (R)">
            <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5" /></svg>
          </button>
          <button className="icon-btn" onClick={() => rotateQuarter(1)} aria-label="Turn right (E)" title="Turn right (E)">
            <svg viewBox="0 0 24 24"><path d="M15 6h5v5M19.5 10.5A8 8 0 1 0 18 17" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
