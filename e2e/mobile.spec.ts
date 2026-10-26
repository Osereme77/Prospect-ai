import { expect, test } from '@playwright/test'

test('mobile landing page stays usable without horizontal overflow', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })

  await expect(page.locator('.landing-hero h1')).toContainText('Find Better Opportunities', { timeout: 20000 })
  await expect(page.locator('.landing-nav-actions').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Get started free/ }).first()).toBeVisible()
  const navLinks = page.getByRole('navigation', { name: 'Landing page navigation' })
  await expect(navLinks.getByRole('link', { name: 'Features' })).toHaveCount(0)

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(375)
})
