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
  let cancelMessage = ''
  page.once('dialog', async dialog => {
    cancelMessage = dialog.message()
    await dialog.dismiss()
  })
  await detail.getByRole('button', { name: 'Delete prospect' }).click()
  expect(cancelMessage).toContain('cannot be undone')
  await expect(detail).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

  let confirmationMessage = ''
  page.once('dialog', async dialog => {
    confirmationMessage = dialog.message()
    await dialog.accept()
  })
  await detail.getByRole('button', { name: 'Delete prospect' }).click()
  expect(confirmationMessage).toContain('cannot be undone')
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
})
