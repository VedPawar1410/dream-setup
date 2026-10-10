import type { AuthError, AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { countLocalRooms, importLocalRooms, localRooms, switchBackend, type RoomBackend } from '../persistence/saves'
import { useAuth, type Account } from '../store/authStore'
import { useUi } from '../store/uiStore'
import { cloudRooms } from './cloudRooms'
import { syncMyItems } from './customItems'
import { backendConfigured, hasStoredSession, supabase } from './supabase'

const accountOf = (s: Session): Account => ({
  id: s.user.id,
  email: s.user.email ?? '',
  username: (s.user.user_metadata?.username as string | undefined) ?? s.user.email?.split('@')[0] ?? 'you',
})

// Links from Supabase emails (confirm address, reset password) land here with tokens in the hash
const authInUrl = () => /access_token|type=recovery|error_description/.test(location.hash)
const siteUrl = () => location.origin + import.meta.env.BASE_URL

/**
 * Before the first render: if someone is signed in on this browser, open their account's
 * rooms. Guests never load the Supabase client here.
 */
export async function startingBackend(): Promise<{ backend: RoomBackend; scope: string } | undefined> {
  if (!backendConfigured || !(hasStoredSession() || authInUrl())) return undefined
  try {
    const sb = await supabase()
    const { data } = await sb.auth.getSession() // also picks up tokens from an email link
    watch(sb)
    if (!data.session) return undefined
    useAuth.setState({ account: accountOf(data.session) })
    void syncMyItems().catch(() => {}) // your uploads, and live arrivals from your phone
    return { backend: cloudRooms(sb), scope: data.session.user.id }
  } catch (err) {
    console.warn('Could not restore your session', err)
    return undefined
  }
}

let watching = false
function watch(sb: SupabaseClient) {
  if (watching) return
  watching = true
  // Supabase calls this while holding its auth lock; awaiting another Supabase call in
  // here would deadlock, so the real work runs just after
  sb.auth.onAuthStateChange((event, session) => {
    setTimeout(() => void onAuthChange(sb, event, session))
  })
}

async function onAuthChange(sb: SupabaseClient, event: AuthChangeEvent, session: Session | null) {
  if (event === 'PASSWORD_RECOVERY') useUi.setState({ authOpen: 'reset' })
  const current = useAuth.getState().account
  if (session && session.user.id !== current?.id) {
    useAuth.setState({ account: accountOf(session) })
    useUi.setState((s) => ({ authOpen: s.authOpen === 'reset' ? 'reset' : null }))
    await switchBackend(cloudRooms(sb), session.user.id)
    void syncMyItems().catch(() => {})
    await offerImport(session.user.id)
  } else if (!session && current) {
    useAuth.setState({ account: null })
    await switchBackend(localRooms, 'local')
  }
}

// ---------- Bringing guest rooms into an account ----------

const importedKey = (uid: string) => `dream-setup:imported:${uid}`

async function offerImport(uid: string) {
  try {
    if (localStorage.getItem(importedKey(uid))) return
    const n = await countLocalRooms()
    if (n > 0) useUi.setState({ importOffer: n })
  } catch {
    // Storage blocked: nothing to offer
  }
}

/** Asked once per account per browser, whatever the answer. */
export async function answerImport(accept: boolean) {
  const uid = useAuth.getState().account?.id
  useUi.setState({ importOffer: 0 })
  if (!uid) return 0
  try {
    localStorage.setItem(importedKey(uid), '1')
  } catch {
    // fine: we may ask again next time
  }
  return accept ? importLocalRooms() : 0
}

// ---------- Account actions (each throws a readable Error) ----------

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Wrong email or password.'],
  [/email not confirmed/i, 'Confirm your email first: check your inbox for the link.'],
  [/already registered/i, 'There is already an account with this email. Sign in instead?'],
  [/rate limit/i, 'Too many attempts. Please wait a bit and try again.'],
  [/password should be at least/i, 'Passwords need at least 6 characters.'],
  [/fetch|network/i, "Couldn't reach the server. Are you online?"],
]
const friendly = (e: AuthError | Error) => new Error(MESSAGES.find(([re]) => re.test(e.message))?.[1] ?? e.message)

async function client() {
  const sb = await supabase()
  watch(sb)
  return sb
}

/** Start loading the client early, e.g. when the sign-in panel opens. */
export const warmUp = () => void client().catch(() => {})

export async function signIn(email: string, password: string) {
  const { error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw friendly(error)
}

/** Returns whether the account still needs its email confirmed before signing in. */
export async function signUp(email: string, password: string, username: string) {
  const name = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(name)) throw new Error('Usernames are 3–20 lowercase letters, numbers or _.')
  const sb = await client()
  const free = await sb.rpc('username_available', { name })
  if (free.error) throw friendly(free.error)
  if (!free.data) throw new Error('That username is taken. Try another?')
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { username: name }, emailRedirectTo: siteUrl() } })
  if (error) throw friendly(error)
  return { needsConfirm: !data.session }
}

/** Signs out this browser only; your other devices stay signed in. */
export async function signOut() {
  const { error } = await (await client()).auth.signOut({ scope: 'local' })
  if (error) throw friendly(error)
}

export async function sendPasswordReset(email: string) {
  const { error } = await (await client()).auth.resetPasswordForEmail(email.trim(), { redirectTo: siteUrl() })
  if (error) throw friendly(error)
}

export async function setNewPassword(password: string) {
  const { error } = await (await client()).auth.updateUser({ password })
  if (error) throw friendly(error)
}
