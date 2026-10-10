import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { play } from '../audio/sound'
import { answerImport, signOut } from '../backend/auth'
import { backendConfigured } from '../backend/supabase'
import { useAuth } from '../store/authStore'
import { useUi } from '../store/uiStore'

/** Next to the room name: "Sign in" for guests, your avatar and a small menu once signed in. */
export function AccountMenu() {
  const account = useAuth((s) => s.account)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!root.current) return // guests have no menu to animate
      gsap.to('.account-pop', { autoAlpha: open ? 1 : 0, y: open ? 0 : -6, duration: open ? 0.3 : 0.15, ease: open ? 'back.out(1.8)' : 'power2.in', overwrite: true })
    },
    { dependencies: [open], scope: root },
  )

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  if (!backendConfigured) return null // no backend set up: guest-only, nothing to show

  if (!account)
    return (
      <button className="account-btn" onClick={() => useUi.setState({ authOpen: 'signin' })} title="Sign in to save rooms to your account">
        Sign in
      </button>
    )

  return (
    <div className="account" ref={root}>
      <button className="account-btn signed" onClick={() => setOpen(!open)} aria-expanded={open} title={account.email}>
        <span className="avatar">{account.username[0]?.toUpperCase()}</span>
        {account.username}
      </button>
      <div className="account-pop" role="menu">
        <div className="account-email">{account.email}</div>
        <p className="settings-note">Your rooms save to your account, so they're on every device you sign in on.</p>
        <button
          className="pill-btn"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            void signOut()
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

/** After signing in: offer once to copy this browser's guest rooms into the account. */
export function ImportOffer() {
  const count = useUi((s) => s.importOffer)
  const card = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  useGSAP(
    () => {
      const on = count > 0
      gsap.to(card.current, { autoAlpha: on ? 1 : 0, y: on ? 0 : 20, duration: on ? 0.5 : 0.25, ease: on ? 'back.out(1.6)' : 'power2.in', overwrite: true })
    },
    { dependencies: [count > 0] },
  )

  const answer = async (accept: boolean) => {
    setBusy(true)
    const n = await answerImport(accept).catch(() => 0)
    setBusy(false)
    if (n) play('confirm')
  }

  return (
    <div className="import-offer" ref={card} role="dialog" aria-label="Bring your rooms">
      <strong>Bring your rooms along?</strong>
      <p>
        This browser has {count} room{count === 1 ? '' : 's'} from before you signed in. Copy {count === 1 ? 'it' : 'them'} into your account?
      </p>
      <div className="import-actions">
        <button className="pill-btn" onClick={() => answer(false)} disabled={busy}>
          Not now
        </button>
        <button className="pill-btn primary" onClick={() => answer(true)} disabled={busy}>
          {busy ? 'Copying…' : 'Copy them in'}
        </button>
      </div>
    </div>
  )
}
