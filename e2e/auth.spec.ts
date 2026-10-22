import { expect, test } from '@playwright/test'

test('keeps an unauthenticated visitor on the sign-in screen', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your prospecting command centre' })).toHaveCount(0)
})
