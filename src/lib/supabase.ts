import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(url && anonKey)
let client: ReturnType<typeof createClient> | null = null
let initializationError = ''
if (supabaseConfigured) {
  try {
    const parsed = new URL(url!)
    const localHost = ['localhost','127.0.0.1','::1'].includes(parsed.hostname.toLowerCase())
    if (parsed.protocol !== 'https:' && !(localHost && parsed.protocol === 'http:')) throw new Error('Supabase must use HTTPS (HTTP is allowed for local development only).')
    client = createClient(url!, anonKey!, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  } catch (cause) { initializationError = cause instanceof Error ? cause.message : 'Supabase configuration is invalid.' }
}
export const supabase = client
export const supabaseConfigError = initializationError

export function cloudModeError() {
  if (!url || !anonKey) return 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your local environment to enable accounts and cloud sync.'
  return null
}
