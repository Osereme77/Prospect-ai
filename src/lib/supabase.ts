import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(url && publishableKey)
let client: ReturnType<typeof createClient<Database>> | null = null
let initializationError = ''
if (supabaseConfigured) {
  try {
    const parsed = new URL(url!)
    const localHost = ['localhost','127.0.0.1','::1'].includes(parsed.hostname.toLowerCase())
    if (parsed.protocol !== 'https:' && !(localHost && parsed.protocol === 'http:')) throw new Error('Supabase must use HTTPS (HTTP is allowed for local development only).')
    client = createClient<Database>(url!, publishableKey!, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  } catch (cause) { initializationError = cause instanceof Error ? cause.message : 'Supabase configuration is invalid.' }
}
export const supabase = client
export const supabaseConfigError = initializationError

export function cloudModeError() {
  if (!url || !publishableKey) return 'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local environment to enable accounts and cloud sync. A legacy VITE_SUPABASE_ANON_KEY also works.'
  return null
}
