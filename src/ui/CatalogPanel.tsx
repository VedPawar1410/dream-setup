import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { deleteItem, syncMyItems, useMyItems } from '../backend/customItems'
import { CATALOG, CATEGORIES, catalogById, type CatalogItem, type Category } from '../catalog/catalog'
import { requestThumbnail, useThumbs } from '../catalog/thumbnails'
import { cancelItemCarry, startPlacing } from '../scene/decorateActions'
import { useAuth } from '../store/authStore'
import { useUi } from '../store/uiStore'

export default function CatalogPanel() {
  const mode = useUi((s) => s.mode)
  const carry = useUi((s) => s.carryItem)
  const thumbs = useThumbs()
  const [category, setCategory] = useState<Category>('desk')
  const [query, setQuery] = useState('')
  const panel = useRef<HTMLElement>(null)

  const account = useAuth((s) => s.account)
  const mine = useMyItems((s) => s.items)
  const [mineError, setMineError] = useState<string | null>(null)
  const q = query.trim().toLowerCase()
  const items = useMemo(() => {
    const own = mine.map((m) => catalogById.get(m.catalogId)).filter((it): it is CatalogItem => !!it)
    if (q) return [...own, ...CATALOG].filter((it) => it.name.toLowerCase().includes(q))
    return category === 'mine' ? own : CATALOG.filter((it) => it.category === category)
  }, [q, category, mine])

  // Your uploads load the first time you open "My items"
  useEffect(() => {
    if (category === 'mine' && account) syncMyItems().catch((err: Error) => setMineError(err.message))
  }, [category, account])
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
            <button key={c.id} className={`chip${c.id === category ? ' active' : ''}`} data-sound="toggle" onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </nav>
      )}
      {placing && <p className="catalog-hint">Click to place · R rotates · Shift+click places another · Esc cancels</p>}
      <div className="cards">
        {category === 'mine' && !q && (
          <button className="card add-card" onClick={() => useUi.setState(account ? { addItemOpen: true } : { authOpen: 'signin' })}>
            <span className="thumb">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            {account ? 'Add your own' : 'Sign in to add your own'}
          </button>
        )}
        {category === 'mine' && mineError && <p className="catalog-empty">{mineError}</p>}
        {items.map((it) => (
          <button
            key={it.id}
            className={`card${placing === it.id ? ' active' : ''}`}
            onClick={() => (placing === it.id ? cancelItemCarry() : startPlacing(it.id))}
            aria-pressed={placing === it.id}
          >
            <span className="thumb">{thumbs[it.id] ? <img src={thumbs[it.id]} alt="" draggable={false} /> : <span className="shimmer" />}</span>
            {it.name}
            {it.category === 'mine' && (
              <span
                className="card-remove"
                role="button"
                aria-label={`Remove ${it.name} from my items`}
                title="Remove from my items"
                onClick={(e) => {
                  e.stopPropagation()
                  const own = mine.find((m) => m.catalogId === it.id)
                  if (own && window.confirm(`Remove "${own.name}" from your items? Rooms already using it will show a placeholder.`)) deleteItem(own).catch((err: Error) => setMineError(err.message))
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        {items.length === 0 && q && <p className="catalog-empty">Nothing matches "{query}"</p>}
        {items.length === 0 && !q && category === 'mine' && account && <p className="catalog-empty">Nothing here yet: add something you scanned.</p>}
      </div>
    </aside>
  )
}
