import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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
  const prospectSearch = page.getByPlaceholder('Search prospects…')
  await prospectSearch.fill(title)
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()
  await prospectSearch.fill('no matching prospect expected')
  await expect(page.getByText('No matching prospects. Add a new prospect or change your search.')).toBeVisible()
  await prospectSearch.clear()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('prospect-ai-opportunities.csv')
  const exportPath = await download.path()
  expect(exportPath).not.toBeNull()
  const csv = await readFile(exportPath!, 'utf8')
  expect(csv).toContain(title)
  expect(csv).toContain('https://example.com/jobs/e2e-prospect')

  await page.getByRole('button', { name: new RegExp(title) }).click()
  const detail = page.getByRole('dialog')
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { name: title })).toBeVisible()
  await expect(detail).toHaveAccessibleName(title)
  await expect(detail.getByText('Why this score')).toBeVisible()
  await expect(detail.getByText('Relevance', { exact: true })).toBeVisible()
  await expect(detail.getByText('Evidence of need', { exact: true })).toBeVisible()
  await expect(detail.getByText('Source confidence', { exact: true })).toBeVisible()
  await detail.getByLabel('Pipeline status').selectOption('Shortlisted')
  await expect(detail.getByLabel('Pipeline status')).toHaveValue('Shortlisted')
  await expect(detail).toBeVisible()
  await detail.getByLabel('Follow-up date').fill('2030-01-15')
  await expect(detail).toBeVisible()
  await detail.getByLabel('Notes').fill('E2E follow-up note')
  await detail.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByLabel(`Status for ${title}`)).toHaveValue('Shortlisted')
  await page.reload()
  await expect(page.getByLabel(`Status for ${title}`)).toHaveValue('Shortlisted')

  await page.getByRole('button', { name: new RegExp(title) }).click()
  const updatedDetail = page.getByRole('dialog')
  await expect(updatedDetail.getByLabel('Follow-up date')).toHaveValue('2030-01-15')
  await expect(updatedDetail.getByLabel('Notes')).toHaveValue('E2E follow-up note')

  let cancelMessage = ''
  page.once('dialog', async dialog => {
    cancelMessage = dialog.message()
    await dialog.dismiss()
  })
  await updatedDetail.getByRole('button', { name: 'Delete prospect' }).click()
  expect(cancelMessage).toContain('cannot be undone')
  await expect(updatedDetail).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

  let confirmationMessage = ''
  page.once('dialog', async dialog => {
    confirmationMessage = dialog.message()
    await dialog.accept()
  })
  await updatedDetail.getByRole('button', { name: 'Delete prospect' }).click()
  expect(confirmationMessage).toContain('cannot be undone')
  await expect(updatedDetail).toBeHidden()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
})
