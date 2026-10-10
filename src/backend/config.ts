// The Supabase project this app talks to. Both values are public by design: they ship in
// the JavaScript bundle and anyone can read them. What keeps data safe is row-level
// security in the database (supabase/migrations), not secrecy of this key.
// Set both to '' and the app runs guest-only with local saves, as before.
// Never put the service_role key here: it bypasses all security.

// (Env vars override these, e.g. to point a local build at a test project.)

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://actysaapmpoxcjjwtdiz.supabase.co'
// The "publishable" key: the modern replacement for the anon key, rotatable on its own
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_zkuRjXmNiBy-VPhE9GZkoQ_FjWfHLz-'
