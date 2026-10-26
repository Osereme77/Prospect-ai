import { expect, test, type Page } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const fakeJwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6NDEwMjQ0NDgwMH0.signature'

async function signInWithMockWorkspace(page: Page) {
  let leads: Record<string, unknown>[] = []
  await page.route('https://auth-gate-test.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname === '/auth/v1/token') return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ access_token: fakeJwt, token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh-token', user: { id: userId, email: 'owner@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z' } }) })
    if (url.pathname === '/rest/v1/rpc/sync_workspace') {
      const body = request.postDataJSON() as { p_leads?: Record<string, unknown>[] }
      leads = body.p_leads ?? []
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: 'true' })
    }
    if (url.pathname === '/rest/v1/leads' && request.method() === 'GET') {
      const rows = leads.map(lead => ({ ...lead, created_at: '2026-01-01T00:00:00Z', lead_evidence: [], lead_scores: [] }))
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(rows) })
    }
    if (url.pathname === '/rest/v1/user_roles' || url.pathname === '/rest/v1/profiles' || url.pathname === '/rest/v1/notifications' || url.pathname === '/rest/v1/search_runs' || url.pathname === '/rest/v1/discovery_sources' || url.pathname === '/rest/v1/lead_scores') {
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/', { waitUntil: 'commit' })
  await page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.locator('input[autocomplete="current-password"]').fill('valid-test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your opportunity command centre' })).toBeVisible({ timeout: 20000 })
}

test('authenticated visitor reaches the dashboard and can create, retrieve, and delete a lead', async ({ page }) => {
  const title = `E2E prospect ${Date.now()}`
  await signInWithMockWorkspace(page)
  await page.getByRole('button', { name: 'Add prospect' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a prospect' })
  await dialog.getByLabel('Prospect type').selectOption('Opportunity')
  await dialog.getByLabel('Title or need').fill(title)
  await dialog.getByLabel('Organization').fill('E2E Example Studio')
  await dialog.getByLabel('Public source URL').fill('https://example.com/jobs/e2e-prospect')
  await dialog.getByLabel('What did you find?').fill('A manually recorded role for browser workflow verification.')
  await dialog.getByRole('button', { name: 'Save prospect' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Saved to your pipeline' })).toBeVisible()
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your opportunity command centre' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Opportunities/ }).click()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(title) }).click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByRole('heading', { name: title })).toBeVisible()
  await expect(detail.getByText('Why this score')).toBeVisible()
  page.once('dialog', dialogPrompt => dialogPrompt.accept())
  await detail.getByRole('button', { name: 'Delete prospect' }).click()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.locator('.landing-hero h1')).toContainText('Find Better Opportunities')
})
