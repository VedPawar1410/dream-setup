import { useEffect } from 'react'
import { cancelItemCarry, rotateInHand } from '../scene/decorateActions'
import { useUi } from '../store/uiStore'

/**
 * Phones only (CSS hides it on wider screens): in decorate mode the catalog and the
 * inspector share one bottom sheet, so the room stays visible. These tabs pick which
 * panel it shows; tapping the open tab folds the sheet away.
 */
export default function SheetTabs() {
  const mode = useUi((s) => s.mode)
  const sheet = useUi((s) => s.sheet)
  const selectedItemId = useUi((s) => s.selectedItemId)
  const placing = useUi((s) => s.carryItem !== null)

  // Selecting something in the room is a request to edit it: show its panel
  useEffect(() => {
    if (selectedItemId) useUi.setState({ sheet: 'inspector' })
  }, [selectedItemId])

  if (mode !== 'decorate') return null
  // Touch screens have no Esc or R key, so placing gets its own small bar
  if (placing)
    return (
      <nav className="sheet-tabs placing" aria-label="Placing">
        <span className="sheet-note">Tap the room to place</span>
        <button className="seg-btn" onClick={() => rotateInHand(1)}>
          Rotate
        </button>
        <button className="seg-btn" onClick={cancelItemCarry}>
          Cancel
        </button>
      </nav>
    )
  const pick = (tab: 'catalog' | 'inspector') => useUi.setState({ sheet: sheet === tab ? null : tab })
  const tabs = [
    { id: 'catalog' as const, label: 'Catalog' },
    { id: 'inspector' as const, label: selectedItemId ? 'Item' : 'Room' },
  ]
  return (
    <nav className="sheet-tabs" aria-label="Decorate panels">
      {tabs.map((t) => (
        <button key={t.id} className={`seg-btn${sheet === t.id ? ' active' : ''}`} aria-pressed={sheet === t.id} onClick={() => pick(t.id)}>
          {t.label}
        </button>
      ))}
      <button className="sheet-fold" aria-label={sheet ? 'Hide panel' : 'Show panel'} onClick={() => useUi.setState({ sheet: sheet ? null : 'catalog' })}>
        <svg viewBox="0 0 24 24" style={{ transform: sheet ? 'none' : 'rotate(180deg)' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </nav>
  )
}
