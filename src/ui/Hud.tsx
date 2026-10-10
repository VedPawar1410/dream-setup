import { SplitText } from 'gsap/SplitText'
import { useEffect, useRef } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { play } from '../audio/sound'
import { sceneReady } from '../anim/intro'
import { undoRedo } from '../scene/blueprintActions'
import { resetView, rotateQuarter } from '../scene/camera'
import { useHistory } from '../store/history'
import { useUi, type Mode } from '../store/uiStore'
import { refreshCurrentThumbnail, useSaves } from '../persistence/saves'
import { exitFirstPerson, toggleFirstPerson } from '../scene/firstPerson'
import { exitPhoto, togglePhoto } from '../scene/photo'
import BlueprintPanel from './BlueprintPanel'
import CatalogPanel from './CatalogPanel'
import Inspector from './Inspector'
import ModeSwitch from './ModeSwitch'
import PhotoBar from './PhotoBar'
import RoomsPanel from './RoomsPanel'
import SelectionBar from './SelectionBar'
import SettingsMenu from './SettingsMenu'
import Tour from './Tour'
import WeatherDock from './WeatherDock'

gsap.registerPlugin(SplitText)

const SEATED_HINTS = [
  { keys: ['Drag'], label: 'Look around' },
  { keys: ['Click lamp'], label: 'Switch' },
  { keys: ['P'], label: 'Photo' },
  { keys: ['F', 'Esc'], label: 'Stand up' },
]

const HINTS: Record<Mode, { keys: string[]; label: string }[]> = {
  view: [
    { keys: ['Drag'], label: 'Orbit' },
    { keys: ['Right-drag'], label: 'Pan' },
    { keys: ['Scroll'], label: 'Zoom' },
    { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
    { keys: ['Q', 'E'], label: 'Turn' },
    { keys: ['Click lamp'], label: 'Switch' },
    { keys: ['F'], label: 'Sit' },
    { keys: ['P'], label: 'Photo' },
    { keys: ['C'], label: 'Decorate' },
    { keys: ['B'], label: 'Blueprint' },
  ],
  decorate: [
    { keys: ['Click'], label: 'Select' },
    { keys: ['Drag'], label: 'Move item' },
    { keys: ['R'], label: 'Rotate' },
    { keys: ['[', ']'], label: 'Resize' },
    { keys: ['Shift', 'Click'], label: 'Place more' },
    { keys: ['Del'], label: 'Delete' },
    { keys: ['⌘', 'Z'], label: 'Undo' },
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

const openRooms = () => {
  if (useUi.getState().roomsOpen) return
  void refreshCurrentThumbnail() // so the current room's card shows how it looks right now
  play('open')
  useUi.setState({ roomsOpen: true })
}

const STATUS = { saved: 'Saved', saving: 'Saving…', error: 'Not saved' }

export default function Hud() {
  const root = useRef<HTMLDivElement>(null)
  const mode = useUi((s) => s.mode)
  const roomName = useSaves((s) => s.name)
  const status = useSaves((s) => (s.available ? s.status : null))
  const firstPerson = useUi((s) => s.firstPerson)
  const photo = useUi((s) => s.photo)
  const hints = firstPerson ? SEATED_HINTS : HINTS[mode]
  const canUndo = useHistory((s) => s.canUndo)
  const canRedo = useHistory((s) => s.canRedo)
  const editing = mode !== 'view' && !firstPerson

  // M opens "My rooms"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.metaKey || e.ctrlKey) {
        if (e.code === 'KeyZ' || (e.code === 'KeyY' && e.ctrlKey)) {
          e.preventDefault()
          undoRedo(e.code === 'KeyY' || e.shiftKey ? 1 : -1)
        }
        return
      }
      if (e.code === 'KeyM') openRooms()
      else if (e.code === 'KeyF' && !useUi.getState().photo) toggleFirstPerson()
      else if (e.code === 'KeyP') togglePhoto()
      else if (e.key === 'Escape') {
        if (useUi.getState().photo) exitPhoto()
        else exitFirstPerson()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
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

  // Photo mode clears the screen: the HUD slides away, leaving only the photo bar
  useGSAP(
    () => {
      gsap.to('.topbar', { autoAlpha: photo ? 0 : 1, y: photo ? -16 : 0, duration: 0.4, ease: 'power2.inOut', overwrite: true })
      gsap.to('.dock', { autoAlpha: photo ? 0 : 1, y: photo ? 16 : 0, duration: 0.4, ease: 'power2.inOut', overwrite: true })
    },
    { dependencies: [photo], scope: root },
  )

  // Swap the hint chips with a quick stagger when the mode changes
  useGSAP(
    () => {
      if (introDone.current) gsap.from('.hint', { opacity: 0, y: 6, duration: 0.35, ease: 'power2.out', stagger: 0.03 })
    },
    { dependencies: [mode, firstPerson], scope: root },
  )

  return (
    <div className="hud" ref={root}>
      <header className="topbar">
        <div>
          <h1 className="title">Dream Setup</h1>
          <div className="subtitle">
            <button className="room-switch" data-sound="none" onClick={openRooms} title="My rooms (M)">
              {roomName}
              <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {status && <span className={`save-status ${status}`}>{STATUS[status]}</span>}
          </div>
        </div>
        <ModeSwitch />
        <WeatherDock />
      </header>

      <BlueprintPanel />
      <CatalogPanel />
      <Inspector />
      <SelectionBar />
      <RoomsPanel />
      <PhotoBar />
      <Tour />
      <div className="dock">
        <div className="hints">
          {hints.map((h) => (
            <span className="hint" key={mode + h.label}>
              {h.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
              <span>{h.label}</span>
            </span>
          ))}
        </div>
        <div className="cam-buttons">
          {editing && (
            <div className="history-buttons">
              <button className="icon-btn" data-sound="none" onClick={() => undoRedo(-1)} disabled={!canUndo} aria-label="Undo (Cmd/Ctrl+Z)" title="Undo (Cmd/Ctrl+Z)">
                <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
              </button>
              <button className="icon-btn" data-sound="none" onClick={() => undoRedo(1)} disabled={!canRedo} aria-label="Redo (Shift+Cmd/Ctrl+Z)" title="Redo (Shift+Cmd/Ctrl+Z)">
                <svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5m5 5H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
              </button>
            </div>
          )}
          <button className="icon-btn" onClick={() => rotateQuarter(-1)} aria-label="Turn left (Q)" title="Turn left (Q)">
            <svg viewBox="0 0 24 24"><path d="M9 6H4v5M4.5 10.5A8 8 0 1 1 6 17" /></svg>
          </button>
          <button className="icon-btn" onClick={resetView} aria-label="Reset view (R)" title="Reset view (R)">
            <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5" /></svg>
          </button>
          <button className="icon-btn" onClick={() => rotateQuarter(1)} aria-label="Turn right (E)" title="Turn right (E)">
            <svg viewBox="0 0 24 24"><path d="M15 6h5v5M19.5 10.5A8 8 0 1 0 18 17" /></svg>
          </button>
          <button className={`icon-btn${firstPerson ? ' on' : ''}`} data-sound="none" onClick={toggleFirstPerson} aria-label="Sit at your desk (F)" title={firstPerson ? 'Stand up (F)' : 'Sit at your desk (F)'}>
            <svg viewBox="0 0 24 24"><path d="M7 21v-4m10 4v-4M5 13h14v4H5zM7 13V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" /></svg>
          </button>
          <button className="icon-btn" data-sound="none" onClick={togglePhoto} aria-label="Photo mode (P)" title="Photo mode (P)">
            <svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
          </button>
          <SettingsMenu />
        </div>
      </div>
    </div>
  )
}
