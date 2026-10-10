import { useRef, useState, type FormEvent } from 'react'
import { gsap, useGSAP } from '../anim/gsap'
import { play } from '../audio/sound'
import { sendPasswordReset, setNewPassword, signIn, signUp, warmUp } from '../backend/auth'
import { useUi, type AuthView } from '../store/uiStore'

const TITLES: Record<AuthView, string> = {
  signin: 'Welcome back',
  signup: 'Create your account',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
}

const close = () => useUi.setState({ authOpen: null })

/** Sign in, sign up, and password reset, in one modal that switches between them. */
export default function AuthPanel() {
  const view = useUi((s) => s.authOpen)
  const overlay = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const open = view !== null
      gsap.to(overlay.current, { autoAlpha: open ? 1 : 0, duration: open ? 0.3 : 0.2, overwrite: true })
      if (open) {
        warmUp() // start loading the Supabase client while you type
        gsap.fromTo('.auth', { y: 18, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out' })
      }
    },
    { dependencies: [view === null], scope: overlay },
  )

  return (
    <div
      className="rooms-overlay"
      ref={overlay}
      onPointerDown={(e) => e.target === overlay.current && close()}
      // Typing here mustn't trigger the scene's keyboard shortcuts
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') close()
      }}
    >
      {view && <AuthForm key={view} view={view} />}
    </div>
  )
}

function AuthForm({ view }: { view: AuthView }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const go = (v: AuthView) => useUi.setState({ authOpen: v })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (view === 'signin') await signIn(email, password)
      else if (view === 'signup') {
        const { needsConfirm } = await signUp(email, password, username)
        if (needsConfirm) return setNotice(`Almost there: we sent a link to ${email.trim()}. Open it to finish signing up.`)
      } else if (view === 'forgot') {
        await sendPasswordReset(email)
        return setNotice('If that email has an account, a reset link is on its way.')
      } else {
        await setNewPassword(password)
        play('confirm')
        close()
      }
      // Signing in closes the panel by itself once the account's rooms open
    } catch (err) {
      setError((err as Error).message)
      play('error')
      gsap.fromTo('.auth', { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rooms auth" role="dialog" aria-modal="true" aria-label={TITLES[view]}>
      <header className="rooms-head">
        <h2>{TITLES[view]}</h2>
        <button className="icon-btn small" onClick={close} aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      {notice ? (
        <p className="auth-notice">{notice}</p>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          {view === 'signup' && (
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ved_builds" autoComplete="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" />
              <span className="auth-hint">Shown on rooms you share. Letters, numbers and _.</span>
            </label>
          )}
          {view !== 'reset' && (
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
            </label>
          )}
          {view !== 'forgot' && (
            <label>
              {view === 'reset' ? 'New password' : 'Password'}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                autoFocus={view === 'reset'}
              />
            </label>
          )}
          {error && <p className="rooms-error">{error}</p>}
          <button className="pill-btn primary auth-submit" disabled={busy}>
            {busy ? 'One moment…' : view === 'signin' ? 'Sign in' : view === 'signup' ? 'Create account' : view === 'forgot' ? 'Send reset link' : 'Save password'}
          </button>
        </form>
      )}

      <footer className="auth-links">
        {view === 'signin' && (
          <>
            <button onClick={() => go('signup')}>New here? Create an account</button>
            <button onClick={() => go('forgot')}>Forgot password?</button>
          </>
        )}
        {(view === 'signup' || view === 'forgot') && <button onClick={() => go('signin')}>Already have an account? Sign in</button>}
      </footer>
    </section>
  )
}
