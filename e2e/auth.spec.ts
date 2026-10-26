import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://auth-gate-test.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
})

test('shows the public Remy Scout landing page before authentication', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })

  await expect(page.getByRole('heading', { name: /Find Better Opportunities\. Let AI Do the Research\./ })).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get started free', exact: false }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your prospecting command centre' })).toHaveCount(0)
})

test('landing actions open the existing sign in and sign up forms', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })
  await page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByRole('button', { name: /Create account/ }).click()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await expect(page.getByLabel('Confirm password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show confirmation password' })).toBeVisible()
})

test('resends email confirmation without revealing whether an account exists', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined
  let requestUrl = ''
  await page.route('https://auth-gate-test.supabase.co/auth/v1/resend**', async route => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    requestUrl = route.request().url()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/', { waitUntil: 'commit' })
  await page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByRole('button', { name: 'Resend confirmation' }).click()

  await expect(page.getByRole('status')).toHaveText('If an unconfirmed account matches that address, a confirmation email has been sent.')
  expect(requestBody).toMatchObject({ type: 'signup', email: 'owner@example.test' })
  expect(new URL(requestUrl).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4175')
})

test('handles confirmation email rate limits without echoing the email address', async ({ page }) => {
  await page.route('https://auth-gate-test.supabase.co/auth/v1/resend**', async route => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }),
    })
  })

  await page.goto('/', { waitUntil: 'commit' })
  await page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email address').fill('private-address@example.test')
  await page.getByRole('button', { name: 'Resend confirmation' }).click()

  const error = page.getByRole('alert')
  await expect(error).toHaveText('Could not send a confirmation email. Check Auth email setup and wait for any sending limit to clear before trying again.')
  await expect(error).not.toContainText('private-address@example.test')
})

test('returns password reset emails to a protected password update screen', async ({ page }) => {
  let redirectTo = ''
  await page.route('https://auth-gate-test.supabase.co/auth/v1/recover**', async route => {
    redirectTo = new URL(route.request().url()).searchParams.get('redirect_to') ?? ''
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/', { waitUntil: 'commit' })
  await page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()

  await expect(page.getByRole('status')).toHaveText('If the address belongs to an account, a password reset link is on its way.')
  const recoveryUrl = new URL(redirectTo)
  expect(recoveryUrl.origin).toBe('http://127.0.0.1:4175')
  expect(recoveryUrl.searchParams.get('auth')).toBe('recovery')

  await page.goto('/?auth=recovery', { waitUntil: 'commit' })
  await expect(page.getByRole('heading', { name: 'Password reset link unavailable' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('heading', { name: 'Your prospecting command centre' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Request a new link' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()

  await page.goto('/?callback=error#error_code=otp_expired', { waitUntil: 'commit' })
  await expect(page.getByRole('heading', { name: 'Password reset link unavailable' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Your prospecting command centre' })).toHaveCount(0)
})
