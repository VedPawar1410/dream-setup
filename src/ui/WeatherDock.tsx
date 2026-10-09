import { useRef } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import type { Weather } from '../scene/atmosphere'
import { useRoom } from '../store/roomStore'

const MOODS: { id: Weather; label: string; icon: React.ReactNode }[] = [
  { id: 'sunny', label: 'Sunny', icon: <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3m0 16v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M1 12h3m16 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /> },
  { id: 'sunset', label: 'Sunset', icon: <path d="M17 18a5 5 0 0 0-10 0M12 9V2m-7.8 8.2 1.4 1.4M1 18h2m18 0h2m-4.6-6.4 1.4-1.4M23 22H1M8 6l4-4 4 4" /> },
  { id: 'rain', label: 'Rain', icon: <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3M8 19v2m0-8v2m8 4v2m0-8v2m-4 6v2m0-8v2" /> },
  { id: 'snow', label: 'Snow', icon: <path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4" /> },
  { id: 'night', label: 'Night', icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /> },
]

/** Weather moods plus the RGB cycle toggle, top-right in every mode. */
export default function WeatherDock() {
  const weather = useRoom((s) => s.doc.atmosphere.weather)
  const rgbCycle = useRoom((s) => s.doc.atmosphere.rgbCycle)
  const setWeather = useRoom((s) => s.setWeather)
  const setRgbCycle = useRoom((s) => s.setRgbCycle)
  const root = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  // Same sliding-highlight technique as the mode switch
  useGSAP(
    () => {
      const btn = root.current!.querySelector<HTMLElement>(`[data-weather="${weather}"]`)!
      const to = { x: btn.offsetLeft, width: btn.offsetWidth }
      if (placed.current) gsap.to(pill.current, { ...to, duration: 0.45, ease: 'power3.out', overwrite: true })
      else gsap.set(pill.current, to)
      placed.current = true
    },
    { dependencies: [weather], scope: root },
  )

  return (
    <div className="weather-dock">
      <div className="weather-switch" ref={root} role="radiogroup" aria-label="Weather">
        <span className="mode-pill" ref={pill} />
        {MOODS.map((m) => (
          <button
            key={m.id}
            className="weather-btn"
            data-weather={m.id}
            data-sound="toggle"
            role="radio"
            aria-checked={weather === m.id}
            aria-label={m.label}
            title={m.label}
            onClick={() => setWeather(m.id)}
          >
            <svg viewBox="0 0 24 24">{m.icon}</svg>
          </button>
        ))}
      </div>
      <button
        className={`rgb-btn${rgbCycle ? ' on' : ''}`}
        data-sound="toggle"
        aria-pressed={rgbCycle}
        title={rgbCycle ? 'RGB cycle: on' : 'RGB cycle: off'}
        onClick={() => setRgbCycle(!rgbCycle)}
      >
        RGB
      </button>
    </div>
  )
}
