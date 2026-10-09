import { useRef } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { catalogById } from '../catalog/catalog'
import { duplicateSelected, removeSelectedItem, rotateSelected } from '../scene/decorateActions'
import { useRoom } from '../store/roomStore'
import { useUi } from '../store/uiStore'

/** Floating actions for the selected item. */
export default function SelectionBar() {
  const id = useUi((s) => (s.mode === 'decorate' && !s.carryItem ? s.selectedItemId : null))
  const item = useRoom((s) => s.doc.items.find((it) => it.id === id))
  const bar = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const on = !!id
      gsap.to(bar.current, { autoAlpha: on ? 1 : 0, y: on ? 0 : 14, duration: on ? 0.45 : 0.25, ease: on ? 'back.out(2)' : 'power2.in', overwrite: true })
    },
    { dependencies: [id] },
  )

  return (
    <div className="selection-bar" ref={bar} role="toolbar" aria-label="Selected item">
      <span className="sel-name">{item ? catalogById.get(item.catalogId)?.name : ''}</span>
      <button className="sel-btn" onClick={() => rotateSelected(1)} disabled={!!item?.wall} title="Rotate (R, Shift+R back)">
        <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>
        Rotate
      </button>
      <button className="sel-btn" onClick={duplicateSelected} title="Duplicate (Cmd/Ctrl+D)">
        <svg viewBox="0 0 24 24"><path d="M8 8h12v12H8zM4 16V4h12" /></svg>
        Duplicate
      </button>
      <button className="sel-btn danger" onClick={removeSelectedItem} title="Delete (Del)">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
        Delete
      </button>
    </div>
  )
}
