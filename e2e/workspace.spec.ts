import { expect, test } from '@playwright/test'

test('creates a manual opportunity and retrieves it after reload', async ({ page }) => {
  const title = `E2E prospect ${Date.now()}`

  await page.goto('/')
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
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
})
