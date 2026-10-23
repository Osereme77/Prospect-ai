import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const hasSupabaseUrl = Boolean(env.VITE_SUPABASE_URL?.trim())
  const hasSupabaseKey = Boolean(
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim(),
  )
  let supabaseUrlError = ''
  if (hasSupabaseUrl) {
    try {
      const parsed = new URL(env.VITE_SUPABASE_URL!.trim())
      if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '' && parsed.pathname !== '/')) {
        supabaseUrlError = 'The Supabase URL must be the project API origin, without a dashboard path, credentials, query, or fragment.'
      } else if (parsed.protocol !== 'https:') {
        supabaseUrlError = 'The Supabase project URL must use HTTPS.'
      }
    } catch {
      supabaseUrlError = 'VITE_SUPABASE_URL is not a valid URL. Use the Project URL from Supabase → Project Settings → API.'
    }
  }

  if (env.NETLIFY?.toLowerCase() === 'true' && (!hasSupabaseUrl || !hasSupabaseKey || supabaseUrlError)) {
    throw new Error(
      `Netlify requires a valid VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or the legacy VITE_SUPABASE_ANON_KEY). ${supabaseUrlError || 'Configure both for the deploy context before deploying.'}`,
    )
  }

  return { plugins: [react()] }
})
