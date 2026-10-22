import { expect, test } from '@playwright/test'

test('creates, retrieves, and safely deletes a manual opportunity', async ({ page }) => {
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

  await page.getByRole('button', { name: /Opportunities/ }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  const cancelEvent = page.waitForEvent('dialog')
  await detail.getByRole('button', { name: 'Delete prospect' }).click()
  const cancelConfirmation = await cancelEvent
  await cancelConfirmation.dismiss()
  await expect(detail).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

  const confirmationEvent = page.waitForEvent('dialog')
  await detail.getByRole('button', { name: 'Delete prospect' }).click()
  const confirmation = await confirmationEvent
  expect(confirmation.message()).toContain('cannot be undone')
  await confirmation.accept()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
})
