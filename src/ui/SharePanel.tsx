import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { play } from '../audio/sound'
import { leaveShared, saveSharedCopy, setSharing, shareUrl } from '../backend/share'
import { useSaves } from '../persistence/saves'
import { useUi, type Viewing } from '../store/uiStore'

const close = () => useUi.setState({ shareOpen: null })

/** Share sheet for one of your account's rooms: link on/off, copy, QR, phone share. */
export default function SharePanel() {
  const id = useUi((s) => s.shareOpen)
  const meta = useSaves((s) => s.list.find((m) => m.id === id))
  const overlay = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const open = id !== null
      gsap.to(overlay.current, { autoAlpha: open ? 1 : 0, duration: open ? 0.3 : 0.2, overwrite: true })
      if (open) gsap.fromTo('.share', { y: 18, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out' })
    },
    { dependencies: [id === null], scope: overlay },
  )

  return (
    <div
      className="rooms-overlay"
      ref={overlay}
      onPointerDown={(e) => e.target === overlay.current && close()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') close()
      }}
    >
      {meta && <ShareSheet key={meta.id} id={meta.id} name={meta.name} token={meta.shareToken ?? null} />}
    </div>
  )
}

function ShareSheet({ id, name, token }: { id: string; name: string; token: string | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const url = token ? shareUrl(token) : null

  const change = async (share: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await setSharing(id, share)
      play(share ? 'confirm' : 'close')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="rooms share" role="dialog" aria-modal="true" aria-label={`Share ${name}`}>
      <header className="rooms-head">
        <div>
          <h2>Share “{name}”</h2>
          <p className="rooms-where">Anyone with the link can look around, sit at the desk and take photos. They can't change anything.</p>
        </div>
        <button className="icon-btn small" onClick={close} aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      {url ? (
        <>
          <div className="share-link">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <button className="pill-btn primary" data-sound="none" onClick={() => void copy().then(() => play('confirm'))}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <QrCode url={url} name={name} />
          <div className="share-actions">
            {'share' in navigator && (
              <button className="pill-btn" onClick={() => void navigator.share({ title: `${name} · Dream Setup`, url }).catch(() => {})}>
                Share…
              </button>
            )}
            <span className="spacer" />
            <button className="pill-btn" onClick={() => change(true)} disabled={busy} title="Old links stop working">
              New link
            </button>
            <button className="pill-btn danger-pill" onClick={() => change(false)} disabled={busy}>
              Stop sharing
            </button>
          </div>
        </>
      ) : (
        <div className="share-off">
          <p>This room is private. Create a link to show it to someone; you can turn it off anytime.</p>
          <button className="pill-btn primary" onClick={() => change(true)} disabled={busy}>
            {busy ? 'One moment…' : 'Create share link'}
          </button>
        </div>
      )}
      {error && <p className="rooms-error">{error}</p>}
    </section>
  )
}

/**
 * The link as a QR code, drawn onto a canvas: rounded modules in the app's colours on a
 * light card (QR scanners need strong dark-on-light contrast). The library only does the
 * encoding, and it's loaded only when a QR is shown.
 */
function QrCode({ url, name }: { url: string; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let live = true
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const c = canvas.current
      if (!live || !c) return
      const qr = qrcode(0, 'M') // type 0 = smallest size that fits; M = ~15% error correction
      qr.addData(url)
      qr.make()
      const n = qr.getModuleCount()
      const quiet = 3 // the blank margin scanners need around the code
      const cell = 10
      const size = (n + quiet * 2) * cell
      c.width = c.height = size
      const g = c.getContext('2d')!
      g.fillStyle = '#f7f2fd'
      g.fillRect(0, 0, size, size)
      // The three corner "finder" squares are drawn whole, so they stay crisp and on-brand
      const finder = (r: number, col: number) => r < 7 && col < 7
      const isFinder = (r: number, col: number) => finder(r, col) || finder(r, n - 1 - col) || finder(n - 1 - r, col)
      g.fillStyle = '#2a2235'
      for (let r = 0; r < n; r++) {
        for (let col = 0; col < n; col++) {
          if (!qr.isDark(r, col) || isFinder(r, col)) continue
          g.beginPath()
          g.roundRect((col + quiet) * cell + 0.6, (r + quiet) * cell + 0.6, cell - 1.2, cell - 1.2, 3)
          g.fill()
        }
      }
      for (const [r, col] of [
        [0, 0],
        [0, n - 7],
        [n - 7, 0],
      ]) {
        const x = (col + quiet) * cell
        const y = (r + quiet) * cell
        g.fillStyle = '#7d5bd6'
        g.beginPath()
        g.roundRect(x, y, cell * 7, cell * 7, cell * 1.6)
        g.fill()
        g.fillStyle = '#f7f2fd'
        g.beginPath()
        g.roundRect(x + cell, y + cell, cell * 5, cell * 5, cell * 1.1)
        g.fill()
        g.fillStyle = '#2a2235'
        g.beginPath()
        g.roundRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * 0.8)
        g.fill()
      }
      gsap.fromTo(c, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' })
    })
    return () => {
      live = false
    }
  }, [url])

  const download = () => {
    const a = document.createElement('a')
    a.href = canvas.current!.toDataURL('image/png')
    a.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase() || 'room'}-qr.png`
    a.click()
  }

  return (
    <div className="share-qr">
      <canvas ref={canvas} aria-label="QR code for the share link" />
      <div>
        <p>Scan with a phone camera to open the room.</p>
        <button className="pill-btn" onClick={download}>
          Download QR
        </button>
      </div>
    </div>
  )
}

/** Top-left while viewing someone's shared room: whose it is, and a way out. */
export function ViewingBar({ viewing }: { viewing: Viewing }) {
  const [busy, setBusy] = useState(false)
  if ('missing' in viewing)
    return (
      <div className="viewing">
        <span>This share link doesn't work anymore.</span>
        <button className="pill-btn primary" onClick={leaveShared}>
          Open my rooms
        </button>
      </div>
    )
  return (
    <div className="viewing">
      <span>
        <b>{viewing.owner}</b>’s room · {viewing.name}
      </span>
      <span className="viewing-tag">View only</span>
      <button
        className="pill-btn primary"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void saveSharedCopy().catch(() => setBusy(false))
        }}
        title="Copy this room into your rooms, to edit it your way"
      >
        {busy ? 'Saving…' : 'Save a copy'}
      </button>
      <button className="pill-btn" onClick={leaveShared}>
        My rooms
      </button>
    </div>
  )
}
