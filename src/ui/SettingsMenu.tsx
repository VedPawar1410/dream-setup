import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { useSettings, type Quality } from '../store/settingsStore'
import { useUi } from '../store/uiStore'

const QUALITIES: { id: Quality; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'low', label: 'Low' },
]

/** The gear in the bottom-right: sound, graphics quality, and replaying the tour. */
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const sound = useSettings((s) => s.sound)
  const quality = useSettings((s) => s.quality)
  const autoTier = useSettings((s) => s.autoTier)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.to('.settings-pop', {
        autoAlpha: open ? 1 : 0,
        y: open ? 0 : 8,
        scale: open ? 1 : 0.96,
        duration: open ? 0.35 : 0.18,
        ease: open ? 'back.out(1.8)' : 'power2.in',
        overwrite: true,
      })
    },
    { dependencies: [open], scope: root },
  )

  // Click anywhere else, or Esc, to close
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="settings" ref={root}>
      <div className="settings-pop" role="dialog" aria-label="Settings">
        <div className="settings-row">
          <span>Sound</span>
          <button
            className={`switch${sound ? ' on' : ''}`}
            role="switch"
            aria-checked={sound}
            aria-label="Sound"
            onClick={() => useSettings.setState({ sound: !sound })}
          >
            <span />
          </button>
        </div>
        <div className="settings-block">
          <span>Graphics</span>
          <div className="seg three" role="radiogroup" aria-label="Graphics quality">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                className={`seg-btn${quality === q.id ? ' active' : ''}`}
                role="radio"
                aria-checked={quality === q.id}
                data-sound="toggle"
                onClick={() => useSettings.setState({ quality: q.id })}
              >
                {q.label}
              </button>
            ))}
          </div>
          <p className="settings-note">
            {quality === 'auto'
              ? `Adjusts to keep things smooth. Running on ${autoTier === 'high' ? 'High' : 'Low'} right now.`
              : quality === 'high'
                ? 'Sharp retina rendering, ambient occlusion, crisp shadows.'
                : 'Standard resolution, no ambient occlusion. Best for older laptops.'}
          </p>
        </div>
        <button
          className="pill-btn"
          onClick={() => {
            setOpen(false)
            useUi.setState({ tourOpen: true })
          }}
        >
          Show the tour again
        </button>
      </div>
      <button className={`icon-btn${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-label="Settings" aria-expanded={open} title="Settings">
        <svg viewBox="0 0 24 24">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
    </div>
  )
}
