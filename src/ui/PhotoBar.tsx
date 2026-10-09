import { useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { captureFrame, useSaves } from '../persistence/saves'
import { exitPhoto, FILTERS, setBokeh, setFilter } from '../scene/photo'
import { useUi } from '../store/uiStore'

type Shot = { url: string; caption: string; file: string }

/** Photo mode's controls, the shutter flash, and the polaroid preview of the last shot. */
export default function PhotoBar() {
  const photo = useUi((s) => s.photo)
  const filter = useUi((s) => s.photoFilter)
  const bokeh = useUi((s) => s.photoBokeh)
  const roomName = useSaves((s) => s.name)
  const [shot, setShot] = useState<Shot | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.to('.photo-bar', { autoAlpha: photo ? 1 : 0, y: photo ? 0 : 24, duration: photo ? 0.5 : 0.25, ease: photo ? 'back.out(1.6)' : 'power2.in', overwrite: true, delay: photo ? 0.15 : 0 })
    },
    { dependencies: [photo], scope: root },
  )

  // The polaroid drops in at a jaunty angle and settles
  useGSAP(
    () => {
      if (shot) gsap.fromTo('.polaroid', { y: 80, rotate: -10, opacity: 0 }, { y: 0, rotate: -3, opacity: 1, duration: 0.7, ease: 'back.out(1.4)' })
    },
    { dependencies: [shot], scope: root },
  )

  const take = () => {
    const url = captureFrame()
    if (!url) return
    gsap.fromTo('.flash', { opacity: 0.9 }, { opacity: 0, duration: 0.6, ease: 'power2.out' })
    gsap.fromTo('.shutter', { scale: 0.85 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
    const date = new Date()
    setShot({
      url,
      caption: `${roomName} · ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      file: `${roomName.replace(/[^\w-]+/g, '-').toLowerCase() || 'room'}-${date.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`,
    })
  }

  const download = () => {
    if (!shot) return
    const a = document.createElement('a')
    a.href = shot.url
    a.download = shot.file
    a.click()
  }

  return (
    <div ref={root}>
      <div className="flash" />
      <div className="photo-bar" role="toolbar" aria-label="Photo mode">
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="blur-control" title="Depth of field: click the scene to choose what's sharp">
          Blur
          <input type="range" min={0} max={6} step={0.1} value={bokeh} onChange={(e) => setBokeh(Number(e.target.value))} />
        </label>
        <button className="shutter" onClick={take} aria-label="Take photo" title="Take photo">
          <span />
        </button>
        <button className="pill-btn" onClick={exitPhoto}>
          Done
        </button>
      </div>

      {shot && (
        <figure className="polaroid">
          <img src={shot.url} alt="Your photo" />
          <figcaption>{shot.caption}</figcaption>
          <div className="polaroid-actions">
            <button className="pill-btn primary" onClick={download}>
              Download
            </button>
            <button className="pill-btn" onClick={() => setShot(null)}>
              Close
            </button>
          </div>
        </figure>
      )}
    </div>
  )
}
