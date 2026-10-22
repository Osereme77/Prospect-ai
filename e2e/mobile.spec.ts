import { expect, test } from '@playwright/test'

test('mobile navigation supports keyboard dismissal without horizontal overflow', async ({ page }) => {
  await page.goto('/')

  const toggle = page.getByRole('button', { name: 'Open navigation' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0)

  await toggle.click()
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Overview' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0)

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(375)
})
