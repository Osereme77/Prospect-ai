import { spawnSync } from 'node:child_process'

// Build the local-storage/mobile E2E target as a production preview, explicitly
// without inheriting any developer Supabase project configuration.
const result = spawnSync('npm run build', {
  shell: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: '',
    VITE_SUPABASE_ANON_KEY: '',
  },
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
