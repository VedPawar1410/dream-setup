import { useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { play } from '../audio/sound'
import {
  deleteRoom,
  duplicateRoom,
  exportCurrentRoom,
  importRoomFile,
  newRoom,
  openRoom,
  renameRoom,
  useSaves,
  type SaveMeta,
} from '../persistence/saves'
import { useUi } from '../store/uiStore'

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 45) return 'just now'
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour')
  return rtf.format(-Math.round(s / 86400), 'day')
}

const close = () => {
  if (!useUi.getState().roomsOpen) return
  play('close')
  useUi.setState({ roomsOpen: false })
}

/** "My rooms": open, rename, duplicate, delete, create, import and export rooms. */
export default function RoomsPanel() {
  const open = useUi((s) => s.roomsOpen)
  const list = useSaves((s) => s.list)
  const currentId = useSaves((s) => s.currentId)
  const available = useSaves((s) => s.available)
  const [error, setError] = useState<string | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Fade the backdrop, lift the dialog, then cascade the cards
  useGSAP(
    () => {
      gsap.to(overlay.current, { autoAlpha: open ? 1 : 0, duration: open ? 0.3 : 0.2, overwrite: true })
      if (open) {
        gsap.fromTo('.rooms', { y: 18, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out' })
        gsap.from('.room-card', { y: 14, opacity: 0, duration: 0.4, ease: 'power3.out', stagger: 0.04, delay: 0.1 })
      }
    },
    { dependencies: [open], scope: overlay },
  )

  const run = (action: () => Promise<unknown>) => {
    setError(null)
    action().catch((err: Error) => setError(err.message))
  }

  return (
    <div
      className="rooms-overlay"
      ref={overlay}
      onPointerDown={(e) => e.target === overlay.current && close()}
      // Keys typed here (renaming, Esc) mustn't reach the 3D scene's shortcuts
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') close()
      }}
    >
      <section className="rooms" role="dialog" aria-modal="true" aria-label="My rooms">
        <header className="rooms-head">
          <h2>My rooms</h2>
          <button className="icon-btn small" data-sound="none" onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {!available && <p className="rooms-error">This browser is blocking storage, so rooms can't be saved here.</p>}

        <div className="rooms-tools">
          <button className="pill-btn primary" onClick={() => run(() => newRoom('starter'))} disabled={!available}>
            + New room
          </button>
          <button className="pill-btn" onClick={() => run(() => newRoom('empty'))} disabled={!available}>
            + Empty room
          </button>
          <span className="spacer" />
          <button className="pill-btn" onClick={() => fileInput.current?.click()} disabled={!available}>
            Import…
          </button>
          <button className="pill-btn" onClick={() => run(exportCurrentRoom)}>
            Export current
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = '' // so picking the same file again still triggers
              if (file) run(async () => {
                await importRoomFile(file)
                play('confirm')
                close()
              })
            }}
          />
        </div>
        {error && <p className="rooms-error">{error}</p>}

        <div className="room-grid">
          {list.map((m) => (
            <RoomCard key={m.id} meta={m} current={m.id === currentId} canDelete={list.length > 1} onError={setError} />
          ))}
        </div>
      </section>
    </div>
  )
}

function RoomCard({ meta, current, canDelete, onError }: { meta: SaveMeta; current: boolean; canDelete: boolean; onError: (msg: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const card = useRef<HTMLElement>(null)

  const fail = (err: Error) => onError(err.message)
  const commitName = (value: string) => {
    setEditing(false)
    if (value.trim() && value !== meta.name) renameRoom(meta.id, value).catch(fail)
  }
  // Animate the card away, then delete for real
  const remove = () => gsap.to(card.current, { scale: 0.9, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => void deleteRoom(meta.id).catch(fail) })

  return (
    <article className={`room-card${current ? ' current' : ''}`} ref={card}>
      <button
        className="room-thumb"
        onClick={() => {
          openRoom(meta.id).catch(fail)
          close()
        }}
        aria-label={`Open ${meta.name}`}
      >
        {meta.thumbnail ? <img src={meta.thumbnail} alt="" /> : <span className="room-thumb-empty" />}
        {current && <span className="badge">Open</span>}
      </button>
      <div className="room-meta">
        {editing ? (
          <input
            className="room-name-input"
            defaultValue={meta.name}
            autoFocus
            maxLength={40}
            onBlur={(e) => commitName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                e.stopPropagation() // cancel the rename, keep the panel open
                setEditing(false)
              }
            }}
          />
        ) : (
          <h3 onDoubleClick={() => setEditing(true)} title="Double-click to rename">
            {meta.name}
          </h3>
        )}
        <span className="room-time">Edited {ago(meta.updatedAt)}</span>
      </div>
      <div className="room-actions">
        {confirming ? (
          <>
            <span className="confirm-text">Delete?</span>
            <button className="mini-btn danger" onClick={remove}>
              Yes
            </button>
            <button className="mini-btn" onClick={() => setConfirming(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button className="mini-btn" onClick={() => setEditing(true)} title="Rename">
              Rename
            </button>
            <button className="mini-btn" onClick={() => duplicateRoom(meta.id).catch(fail)} title="Duplicate">
              Duplicate
            </button>
            {canDelete && (
              <button className="mini-btn danger" onClick={() => setConfirming(true)} title="Delete">
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}
