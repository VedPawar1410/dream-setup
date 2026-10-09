import { useRef, useState } from 'react'

type Hsv = { h: number; s: number; v: number }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

function hsvToHex({ h, s, v }: Hsv) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return `#${[f(5), f(3), f(1)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const HEX = /^#?([0-9a-f]{6})$/i

type Props = { value: string; onChange: (hex: string) => void; swatches?: string[] }

/**
 * Saturation/value square + hue slider + hex field + swatches, with no dependencies.
 * It keeps its own HSV state because a hex code can't remember the hue of a grey:
 * drag to white and back and you'd otherwise lose the hue you were on.
 */
export default function ColorPicker({ value, onChange, swatches = [] }: Props) {
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [seen, setSeen] = useState(value)
  const area = useRef<HTMLDivElement>(null)

  // Follow outside changes (colours reset, another wall picked) but not our own echoes.
  // Adjusting state during render when a prop changes is React's recommended pattern:
  // an effect would paint the stale colour for a frame first.
  if (value !== seen) {
    setSeen(value)
    if (hsvToHex(hsv) !== value.toLowerCase()) setHsv(hexToHsv(value))
  }
  const hex = hsvToHex(hsv)

  const commit = (next: Hsv) => {
    setHsv(next)
    onChange(hsvToHex(next))
  }

  const pick = (e: React.PointerEvent) => {
    const r = area.current!.getBoundingClientRect()
    commit({ ...hsv, s: clamp01((e.clientX - r.left) / r.width), v: 1 - clamp01((e.clientY - r.top) / r.height) })
  }

  return (
    <div className="picker">
      <div
        className="sv"
        ref={area}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId) // keep dragging even outside the square
          pick(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) pick(e)
        }}
      >
        <span className="sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }} />
      </div>
      <input
        className="hue"
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        onChange={(e) => commit({ ...hsv, h: Number(e.target.value) })}
      />
      <div className="picker-row">
        <span className="picker-chip" style={{ backgroundColor: hex }} />
        <HexField
          value={hex}
          onCommit={(h) => {
            setHsv(hexToHsv(h))
            onChange(h)
          }}
        />
      </div>
      {swatches.length > 0 && (
        <div className="swatches">
          {swatches.map((s) => (
            <button
              key={s}
              className={`swatch-btn${s === hex ? ' active' : ''}`}
              style={{ backgroundColor: s }}
              aria-label={s}
              onClick={() => {
                setHsv(hexToHsv(s))
                onChange(s)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A hex text field that only applies valid colours, on Enter or when it loses focus. */
function HexField({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(value)
  }
  const apply = () => {
    const m = HEX.exec(text.trim())
    if (m) onCommit(`#${m[1].toLowerCase()}`)
    else setText(value)
  }
  return (
    <input
      className="hex-field"
      value={text}
      spellCheck={false}
      aria-label="Hex colour"
      onChange={(e) => setText(e.target.value)}
      onBlur={apply}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        e.stopPropagation() // typing a hex code shouldn't move the camera or switch modes
      }}
    />
  )
}
