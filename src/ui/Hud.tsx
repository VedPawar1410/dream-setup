import { SplitText } from 'gsap/SplitText'
import { useRef } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { sceneReady } from '../anim/intro'
import { resetView, rotateQuarter } from '../scene/camera'

gsap.registerPlugin(SplitText)

export default function Hud() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      // Each letter rises out of a mask; useGSAP reverts the split when the HUD unmounts.
      const split = SplitText.create('.title', { type: 'chars', mask: 'chars' })
      const tl = gsap
        .timeline({ paused: true, delay: 0.5 })
        .from(split.chars, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.035 })
        .from('.subtitle', { opacity: 0, y: 8, duration: 0.6, ease: 'power2.out' }, '-=0.5')
        // These land as the camera settles (the camera intro takes ~2.8s)
        .from('.dock > *', { opacity: 0, y: 20, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.08 }, 1.9)
      // Paused timelines still apply their "from" values, so the HUD stays hidden until then
      // Guard against StrictMode's dev double-mount: the first, reverted timeline must not play
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

  return (
    <div className="hud" ref={root}>
      <header>
        <h1 className="title">Dream Setup</h1>
        <p className="subtitle">Your room</p>
      </header>

      <div className="dock">
        <div className="hints">
          <Hint keys={['Drag']} label="Orbit" />
          <Hint keys={['Right-drag']} label="Pan" />
          <Hint keys={['Scroll']} label="Zoom" />
          <Hint keys={['W', 'A', 'S', 'D']} label="Move" />
          <Hint keys={['Q', 'E']} label="Turn" />
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

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="hint">
      {keys.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}
