import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { next, togglePlay, TRACKS, useMusic } from '../audio/music'
import { useSettings } from '../store/settingsStore'

/** The lo-fi player: a vinyl button in the dock that opens a small player card. */
export default function MusicPlayer() {
  const [open, setOpen] = useState(false)
  const playing = useMusic((s) => s.playing)
  const index = useMusic((s) => s.index)
  const volume = useSettings((s) => s.musicVolume)
  const track = TRACKS[index]
  const root = useRef<HTMLDivElement>(null)
  const spin = useRef<gsap.core.Tween | null>(null)

  useGSAP(
    () => {
      gsap.to('.music-pop', { autoAlpha: open ? 1 : 0, y: open ? 0 : 8, scale: open ? 1 : 0.96, duration: open ? 0.35 : 0.18, ease: open ? 'back.out(1.8)' : 'power2.in', overwrite: true })
    },
    { dependencies: [open], scope: root },
  )

  // The record turns while music plays and eases to a stop when paused, rather than
  // snapping back: one endless tween, sped up or slowed via its timeScale
  useGSAP(
    () => {
      spin.current ??= gsap.to('.vinyl', { rotation: 360, duration: 3, ease: 'none', repeat: -1, paused: true })
      const t = spin.current
      if (playing) t.play()
      gsap.to(t, { timeScale: playing ? 1 : 0, duration: playing ? 0.6 : 1.2, ease: 'power2.out', overwrite: true, onComplete: () => void (playing || t.pause()) })
    },
    { dependencies: [playing], scope: root },
  )

  // Track change: the title slides in
  useGSAP(
    () => {
      gsap.fromTo('.track-info', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
    },
    { dependencies: [index], scope: root },
  )

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className="music" ref={root}>
      <div className="music-pop" role="dialog" aria-label="Music player">
        <div className="music-head">
          <div className="vinyl" aria-hidden>
            <span />
          </div>
          <div className="track-info">
            <strong>{track.title}</strong>
            <span>{track.artist} · lo-fi</span>
          </div>
        </div>
        <div className="music-controls">
          <button className="round-btn" onClick={() => next(-1)} aria-label="Previous track">
            <svg viewBox="0 0 24 24"><path d="M6 5v14M19 5 9 12l10 7z" /></svg>
          </button>
          <button className="round-btn big" data-sound="none" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            <svg viewBox="0 0 24 24">{playing ? <path d="M8 5v14M16 5v14" /> : <path d="M7 4.5v15L19 12z" />}</svg>
          </button>
          <button className="round-btn" onClick={() => next(1)} aria-label="Next track">
            <svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z" /></svg>
          </button>
        </div>
        <label className="music-volume">
          <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6" /></svg>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => useSettings.setState({ musicVolume: Number(e.target.value) })} aria-label="Music volume" />
        </label>
        <p className="settings-note">Tip: click a radio in your room to play or pause.</p>
      </div>
      <button className={`icon-btn${playing ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-label="Music" aria-expanded={open} title="Lo-fi music">
        {playing ? (
          <span className="eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg>
        )}
      </button>
    </div>
  )
}
