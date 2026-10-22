import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'local-storage',
      testMatch: 'workspace.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'auth-gate',
      testMatch: 'auth.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4174' },
    },
    {
      name: 'mobile-workspace',
      testMatch: 'mobile.spec.ts',
      use: {
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_SUPABASE_URL: 'https://auth-gate-test.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        VITE_SUPABASE_ANON_KEY: '',
      },
    },
  ],
})
