import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { CATALOG, CATEGORIES, type Category } from '../catalog/catalog'
import { requestThumbnail, useThumbs } from '../catalog/thumbnails'
import { cancelItemCarry, startPlacing } from '../scene/decorateActions'
import { useUi } from '../store/uiStore'

export default function CatalogPanel() {
  const mode = useUi((s) => s.mode)
  const carry = useUi((s) => s.carryItem)
  const thumbs = useThumbs()
  const [category, setCategory] = useState<Category>('desk')
  const [query, setQuery] = useState('')
  const panel = useRef<HTMLElement>(null)

  const q = query.trim().toLowerCase()
  const items = useMemo(() => (q ? CATALOG.filter((it) => it.name.toLowerCase().includes(q)) : CATALOG.filter((it) => it.category === category)), [q, category])
  const placing = carry && !carry.itemId ? carry.catalogId : null

  // Thumbnails render lazily: only what's on screen, one per frame
  useEffect(() => {
    if (mode === 'decorate') items.forEach(requestThumbnail)
  }, [mode, items])

  // Stays mounted; GSAP slides it so leaving can animate too
  useGSAP(
    () => {
      const on = mode === 'decorate'
      gsap.to(panel.current, { autoAlpha: on ? 1 : 0, x: on ? 0 : -32, duration: on ? 0.55 : 0.3, ease: on ? 'power3.out' : 'power2.in', overwrite: true })
    },
    { dependencies: [mode], scope: panel },
  )

  // Cards cascade in whenever the list changes
  useGSAP(
    () => {
      if (mode === 'decorate') gsap.from('.card', { y: 16, opacity: 0, duration: 0.45, ease: 'power3.out', stagger: 0.025, overwrite: true })
    },
    { dependencies: [mode, category, q], scope: panel },
  )

  return (
    <aside className="catalog" ref={panel} aria-label="Furniture catalog">
      <div className="catalog-head">
        <h2>Catalog</h2>
        <span className="catalog-count">{items.length} items</span>
      </div>
      <input className="search" type="search" placeholder="Search furniture…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!q && (
        <nav className="chips" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip${c.id === category ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </nav>
      )}
      {placing && <p className="catalog-hint">Click to place · R rotates · Shift+click places another · Esc cancels</p>}
      <div className="cards">
        {items.map((it) => (
          <button
            key={it.id}
            className={`card${placing === it.id ? ' active' : ''}`}
            onClick={() => (placing === it.id ? cancelItemCarry() : startPlacing(it.id))}
            aria-pressed={placing === it.id}
          >
            <span className="thumb">{thumbs[it.id] ? <img src={thumbs[it.id]} alt="" draggable={false} /> : <span className="shimmer" />}</span>
            {it.name}
          </button>
        ))}
        {items.length === 0 && <p className="catalog-empty">Nothing matches "{query}"</p>}
      </div>
    </aside>
  )
}
