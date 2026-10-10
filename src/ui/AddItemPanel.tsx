import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { play } from '../audio/sound'
import { isUploadPage, MAX_BYTES, uploadItem, useMyItems } from '../backend/customItems'
import type { CatalogItem, CustomDef } from '../catalog/catalog'
import { measureModel } from '../catalog/models'
import { thumbnailOf } from '../catalog/thumbnails'
import { setMode } from '../scene/blueprintActions'
import { startPlacing } from '../scene/decorateActions'
import { useAuth } from '../store/authStore'
import { useUi } from '../store/uiStore'
import { QrCode } from './SharePanel'

// "Add your own": bring a real object in as a 3D model. Scan it with a phone app, export
// GLB, upload it here (or straight from the phone via the QR), set its real size, done.

const uploadUrl = () => `${location.origin}${import.meta.env.BASE_URL}?upload`

const close = () => useUi.setState({ addItemOpen: false })

const MOUNTS: { id: CustomDef['mount']; label: string; hint: string }[] = [
  { id: 'surface', label: 'Floor or furniture', hint: 'Mugs, plants, gadgets' },
  { id: 'floor', label: 'Floor only', hint: 'Chairs, big things' },
  { id: 'wall', label: 'Wall', hint: 'Frames, clocks' },
]

export default function AddItemPanel() {
  const open = useUi((s) => s.addItemOpen)
  const overlay = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.to(overlay.current, { autoAlpha: open ? 1 : 0, duration: open ? 0.3 : 0.2, overwrite: true })
      if (open) gsap.fromTo('.add-item', { y: 18, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out' })
    },
    { dependencies: [open], scope: overlay },
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
      {open && <AddItem />}
    </div>
  )
}

type Picked = { file: File; url: string; preview: string | null; raw: number }

let previews = 0

function AddItem() {
  const account = useAuth((s) => s.account)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [name, setName] = useState('')
  const [heightCm, setHeightCm] = useState(30)
  const [mount, setMount] = useState<CustomDef['mount']>('surface')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const phone = isUploadPage()

  // Free the preview's object URL when it's replaced or the panel closes
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked])

  const choose = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!/\.glb$/i.test(file.name)) return setError('Please choose a .glb file (scanning apps can export to GLB).')
    if (file.size > MAX_BYTES) return setError('That file is over 25 MB. Try exporting the scan at a lower quality.')
    setBusy(true)
    const url = URL.createObjectURL(file)
    try {
      // Scans usually come in metres, so the model's own height is a good first guess
      const size = await measureModel(url)
      const guess = size.y > 0.03 && size.y < 3.5 ? size.y : 0.3
      const item: CatalogItem = { id: `preview:${++previews}`, name: file.name, category: 'mine', mount: 'floor', model: { kind: 'url', url, height: guess } }
      const preview = await thumbnailOf(item).catch(() => null)
      setPicked({ file, url, preview, raw: size.y })
      setName(file.name.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ').slice(0, 40))
      setHeightCm(Math.round(guess * 100))
    } catch {
      URL.revokeObjectURL(url)
      setError("That file couldn't be read as a 3D model.")
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      const catalogId = await uploadItem(picked.file, { name: name || 'My item', height: heightCm / 100, mount })
      play('confirm')
      if (phone) {
        setSaved(name || 'Your item')
        setPicked(null)
      } else {
        // Straight into your hand, ready to place
        close()
        setMode('decorate')
        startPlacing(catalogId)
      }
    } catch (err) {
      setError((err as Error).message)
      play('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rooms add-item" role="dialog" aria-modal="true" aria-label="Add your own item">
      <header className="rooms-head">
        <div>
          <h2>Add your own item</h2>
          <p className="rooms-where">Scan something real and put it in your room.</p>
        </div>
        <button className="icon-btn small" onClick={close} aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      {!account ? (
        <div className="share-off">
          <p>Your items are stored in your account, so sign in first.</p>
          <button className="pill-btn primary" onClick={() => useUi.setState({ addItemOpen: false, authOpen: 'signin' })}>
            Sign in
          </button>
        </div>
      ) : saved ? (
        <div className="share-off">
          <p>
            <b>{saved}</b> is in your account. On your computer it appears under <b>My items</b> right away.
          </p>
          <button className="pill-btn primary" onClick={() => setSaved(null)}>
            Add another
          </button>
        </div>
      ) : !picked ? (
        <>
          <ol className="scan-steps">
            <li>
              Scan the object with a free phone app: <b>Polycam</b>, <b>Scaniverse</b> or <b>KIRI Engine</b>.
            </li>
            <li>
              Export it as <b>GLB</b> (under 25 MB).
            </li>
            <li>Upload it here and set its real size.</li>
          </ol>
          <label className={`drop${busy ? ' busy' : ''}`}>
            <input type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => void choose(e.target.files?.[0])} disabled={busy} />
            <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            {busy ? 'Reading the model…' : phone ? 'Choose the GLB file' : 'Choose a GLB file from this computer'}
          </label>
          {!phone && <QrCode url={uploadUrl()} name="upload" caption="Scanned on your phone? Scan this to upload straight from it." download={false} />}
        </>
      ) : (
        <div className="item-details">
          <div className="item-preview">{picked.preview ? <img src={picked.preview} alt="Your model" /> : <span className="shimmer" />}</div>
          <div className="auth-form">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </label>
            <label>
              Real height (cm)
              <input type="number" min={3} max={390} value={heightCm} onChange={(e) => setHeightCm(Math.min(390, Math.max(3, Number(e.target.value) || 3)))} />
              <span className="auth-hint">Measure the real thing: the model is scaled to match.</span>
            </label>
            <div className="mount-pick" role="radiogroup" aria-label="Where it goes">
              {MOUNTS.map((m) => (
                <button key={m.id} className={`mount-opt${mount === m.id ? ' active' : ''}`} role="radio" aria-checked={mount === m.id} data-sound="toggle" onClick={() => setMount(m.id)}>
                  <b>{m.label}</b>
                  <span>{m.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="share-actions item-actions">
            <button className="pill-btn" onClick={() => setPicked(null)} disabled={busy}>
              Choose another
            </button>
            <span className="spacer" />
            <button className="pill-btn primary" onClick={() => void save()} disabled={busy || !name.trim()}>
              {busy ? 'Uploading…' : phone ? 'Save to my items' : 'Save and place'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="rooms-error">{error}</p>}
    </section>
  )
}

/** An item uploaded from your phone just arrived: offer to place it. */
export function ArrivalToast() {
  const arrived = useMyItems((s) => s.arrived)
  const card = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const on = !!arrived && !isUploadPage()
      gsap.to(card.current, { autoAlpha: on ? 1 : 0, y: on ? 0 : 20, duration: on ? 0.5 : 0.25, ease: on ? 'back.out(1.6)' : 'power2.in', overwrite: true })
      if (on) play('confirm')
    },
    { dependencies: [arrived] },
  )

  const dismiss = () => useMyItems.setState({ arrived: null })
  return (
    <div className="import-offer" ref={card} role="status">
      <strong>📱 {arrived?.name} arrived from your phone</strong>
      <div className="import-actions">
        <button className="pill-btn" onClick={dismiss}>
          Later
        </button>
        <button
          className="pill-btn primary"
          onClick={() => {
            if (!arrived) return
            dismiss()
            setMode('decorate')
            startPlacing(arrived.catalogId)
          }}
        >
          Place it
        </button>
      </div>
    </div>
  )
}
