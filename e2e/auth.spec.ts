import { expect, test } from '@playwright/test'

test('keeps an unauthenticated visitor on the sign-in screen', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your prospecting command centre' })).toHaveCount(0)
})

test('resends email confirmation without revealing whether an account exists', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined
  let requestUrl = ''
  await page.route('https://auth-gate-test.supabase.co/auth/v1/resend**', async route => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    requestUrl = route.request().url()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')
  await page.getByLabel('Email address').fill('owner@example.test')
  await page.getByRole('button', { name: 'Resend confirmation' }).click()

  await expect(page.getByRole('status')).toHaveText('If an unconfirmed account matches that address, a confirmation email has been sent.')
  expect(requestBody).toMatchObject({ type: 'signup', email: 'owner@example.test' })
  expect(new URL(requestUrl).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4174')
})
