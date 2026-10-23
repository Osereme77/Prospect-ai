import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hasSupabaseUrl = Boolean(env.VITE_SUPABASE_URL?.trim())
  const hasSupabaseKey = Boolean(
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim(),
  )

  if (env.NETLIFY?.toLowerCase() === 'true' && (!hasSupabaseUrl || !hasSupabaseKey)) {
    throw new Error(
      'Netlify builds require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or the legacy VITE_SUPABASE_ANON_KEY). Configure both for the deploy context before deploying.',
    )
  }

  return { plugins: [react()] }
})
