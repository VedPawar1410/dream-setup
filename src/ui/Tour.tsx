import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { sceneReady } from '../anim/intro'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'

type Step = { target: string | null; title: string; body: string }

const STEPS: Step[] = [
  { target: null, title: 'Welcome to your room', body: 'Drag to look around, scroll to zoom and right-drag to pan. Q and E swing to the next corner.' },
  { target: '.mode-switch', title: 'Make it yours', body: 'Decorate to add furniture and recolour anything. Blueprint to resize the room and add doors and windows.' },
  { target: '.weather-dock', title: 'Set the mood', body: 'Five weathers, from sunny to night. Click a lamp or a screen to switch it on.' },
  { target: '.cam-buttons', title: 'Sit down, say cheese', body: 'Sit at your desk (F) or open photo mode (P). Everything you do saves by itself.' },
]

const PAD = 8 // spotlight breathing room around the target
const GAP = 14 // between the spotlight and the card
const MARGIN = 16 // keep the card off the screen edges

/** First-visit tour. Shows once, a moment after the intro; settings can replay it. */
export default function Tour() {
  const open = useUi((s) => s.tourOpen)
  useEffect(() => {
    let timer = 0
    sceneReady.then(() => {
      timer = window.setTimeout(() => {
        if (!useSettings.getState().tourDone) useUi.setState({ tourOpen: true })
      }, 3400)
    })
    return () => clearTimeout(timer)
  }, [])
  // Mounting fresh each time means a replay always starts from step one
  return open ? <TourSteps /> : null
}

/** Where the spotlight and card go for a step, measured from the live layout. */
function layout(step: Step, card: HTMLElement) {
  const W = window.innerWidth
  const H = window.innerHeight
  const cw = card.offsetWidth
  const ch = card.offsetHeight
  const el = step.target ? document.querySelector(step.target) : null
  if (!el) return { card: { x: (W - cw) / 2, y: H * 0.66 - ch / 2 }, spot: { x: W / 2, y: H * 0.66, width: 0, height: 0 }, lit: false }
  const r = el.getBoundingClientRect()
  // The card goes on whichever side of the target has more room
  const below = r.top + r.height / 2 < H / 2
  return {
    card: {
      x: Math.min(Math.max(r.left + r.width / 2 - cw / 2, MARGIN), W - cw - MARGIN),
      y: below ? r.bottom + PAD + GAP : r.top - PAD - GAP - ch,
    },
    spot: { x: r.left - PAD, y: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 },
    lit: true,
  }
}

function TourSteps() {
  const [index, setIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const spot = useRef<HTMLDivElement>(null)
  const shown = useRef(false)
  const leaving = useRef(false)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  // Glide the spotlight and the card to the new step. The first step pops in instead.
  const { contextSafe } = useGSAP(
    () => {
      const to = layout(step, card.current!)
      if (!shown.current) {
        shown.current = true
        gsap.set(spot.current, { ...to.spot, autoAlpha: 0 })
        gsap.fromTo(card.current, { ...to.card, y: to.card.y + 24, autoAlpha: 0 }, { y: to.card.y, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.6)' })
        return
      }
      gsap.to(card.current, { ...to.card, duration: 0.55, ease: 'power3.inOut' })
      gsap.to(spot.current, { ...to.spot, autoAlpha: to.lit ? 1 : 0, duration: 0.55, ease: 'power3.inOut' })
      gsap.fromTo('.tour-content', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3, delay: 0.3, ease: 'power2.out' })
    },
    { dependencies: [index], scope: root },
  )

  // contextSafe only wraps the callback; the refs are read later, in event handlers
  // oxlint-disable-next-line react/refs
  const finish = contextSafe(() => {
    if (leaving.current) return
    leaving.current = true
    useSettings.setState({ tourDone: true })
    gsap.to(spot.current, { autoAlpha: 0, duration: 0.3 })
    gsap.to(card.current, { autoAlpha: 0, y: '+=16', duration: 0.3, ease: 'power2.in', onComplete: () => useUi.setState({ tourOpen: false }) })
  })

  // Fade the words out, then change step; the layout effect above brings the next ones in
  const next = contextSafe(() => {
    if (last) return finish()
    gsap.to('.tour-content', { autoAlpha: 0, duration: 0.15, onComplete: () => setIndex(index + 1) })
  })

  // Esc skips (Next has focus, so Enter and Space advance). Resizing re-measures without animating.
  // Arrow keys are left alone: they move the camera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    const onResize = () => {
      const to = layout(step, card.current!)
      gsap.set(card.current, to.card)
      gsap.set(spot.current, to.spot)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [finish, step])

  return (
    <div className="tour" ref={root}>
      {/* A rounded hole in a dimmed screen: one element whose enormous box-shadow is the dimming */}
      <div className="tour-spot" ref={spot} />
      <div className="tour-card" ref={card} role="dialog" aria-label="Tour" aria-live="polite">
        <div className="tour-content">
          <div className="tour-count">
            {index + 1} / {STEPS.length}
          </div>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </div>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.title} className={i === index ? 'on' : ''} />
            ))}
          </div>
          {!last && (
            <button className="tour-skip" onClick={finish}>
              Skip
            </button>
          )}
          <button className="pill-btn primary" onClick={next} autoFocus>
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
