import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export const backendConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY

// Where supabase-js keeps the signed-in session (it refreshes it by itself)
const SESSION_KEY = 'dream-setup:auth'

let client: Promise<SupabaseClient> | null = null

/**
 * The Supabase client, loaded on first use. It's a separate chunk, so guests (and the
 * first frame for everyone) never wait for it.
 */
export function supabase(): Promise<SupabaseClient> {
  if (!backendConfigured) return Promise.reject(new Error('No backend configured'))
  return (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storageKey: SESSION_KEY, persistSession: true, autoRefreshToken: true } }),
  ))
}

/** Was someone signed in last time? Checked synchronously, without loading the client. */
export function hasStoredSession() {
  if (!backendConfigured) return false
  try {
    return localStorage.getItem(SESSION_KEY) !== null
  } catch {
    return false
  }
}
