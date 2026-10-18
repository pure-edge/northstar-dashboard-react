import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Each test gets a fresh browser context, so localStorage always starts empty.
const STORAGE_KEY = 'northstar-react-dashboard:inventory:v1'

const footer = (page: Page) => page.getByRole('status').filter({ hasText: 'Showing' })
const alerts = (page: Page) => page.getByRole('complementary', { name: 'Store activity' })
const metric = (page: Page, label: string) =>
  page
    .getByRole('region', { name: 'Store summary' })
    .locator('article')
    .filter({ hasText: label })
    .locator('.metric-value')

const storedInventory = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY)

// Registers a one-time handler for the native confirm() and returns its message.
function answerConfirm(page: Page, accept: boolean) {
  const message = new Promise<string>((resolve) => {
    page.once('dialog', async (dialog) => {
      resolve(dialog.message())
      if (accept) await dialog.accept()
      else await dialog.dismiss()
    })
  })
  return message
}

async function deleteProduct(page: Page, name: string, accept = true) {
  const message = answerConfirm(page, accept)
  await page.getByRole('button', { name: `Delete ${name}` }).click()
  return message
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
})

test('canceling deletion leaves the product and saved inventory unchanged', async ({ page }) => {
  // Delete one product first so there is saved data to compare against.
  await deleteProduct(page, 'Ceramic Coffee Mug')
  await expect(metric(page, 'Total products')).toHaveText('11')
  const before = await storedInventory(page)
  expect(before).toHaveLength(11)

  // Stock-ascending order keeps the hoodie on page 1.
  await page.getByRole('combobox', { name: 'Sort products' }).selectOption('stock-asc')
  const message = await deleteProduct(page, 'Relaxed Fit Hoodie', false)
  expect(message).toContain('Relaxed Fit Hoodie')
  expect(message).toContain('HDY-004')

  await expect(page.getByRole('row').filter({ hasText: 'HDY-004' })).toHaveCount(1)
  await expect(metric(page, 'Total products')).toHaveText('11')
  await expect(page.locator('.storage-warning')).toHaveCount(0)
  expect(await storedInventory(page)).toEqual(before)
})

test('confirming deletion removes only the selected product and updates metrics and alerts', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sort products' }).selectOption('stock-asc')
  await expect(page.getByRole('row').filter({ hasText: 'HDY-004' })).toHaveCount(1)

  await deleteProduct(page, 'Relaxed Fit Hoodie')

  await expect(page.getByRole('row').filter({ hasText: 'HDY-004' })).toHaveCount(0)
  await expect(metric(page, 'Total products')).toHaveText('11')
  await expect(metric(page, 'Low-stock items')).toHaveText('5')
  // 4,337 minus the hoodie's 58 x 3 = 174.
  await expect(metric(page, 'Inventory value')).toHaveText('$4,163.00')
  await expect(alerts(page).getByText('Relaxed Fit Hoodie')).toHaveCount(0)
  await expect(alerts(page).getByText('Weekend Duffle Bag')).toBeVisible()

  const stored = await storedInventory(page)
  expect(stored).toHaveLength(11)
  expect(stored.map((p: { id: number }) => p.id)).not.toContain(4)
  expect(stored.map((p: { id: number }) => p.id)).toContain(3)
})

test('a successful deletion persists across reload', async ({ page }) => {
  await deleteProduct(page, 'Ceramic Coffee Mug')
  await expect(metric(page, 'Total products')).toHaveText('11')

  await page.reload()
  await expect(metric(page, 'Total products')).toHaveText('11')
  await expect(page.getByText('Ceramic Coffee Mug')).toHaveCount(0)
  await expect(footer(page)).toHaveText('Showing 1–5 of 11 matching products')
})

test('deleting the last item on a later page keeps pagination valid', async ({ page }) => {
  const next = page.getByRole('button', { name: /next/i })
  await next.click()
  await next.click()
  await expect(footer(page)).toHaveText('Showing 11–12 of 12 matching products')

  await deleteProduct(page, 'Weekend Duffle Bag')
  await expect(footer(page)).toHaveText('Showing 11–11 of 11 matching products')
  await expect(page.getByRole('row')).toHaveCount(2) // header + one product

  await deleteProduct(page, 'Travel Packing Cubes')

  await expect(footer(page)).toHaveText('Showing 6–10 of 10 matching products')
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(next).toBeDisabled()
  await expect(page.getByRole('button', { name: /previous/i })).toBeEnabled()
})

test('deleting the final product keeps an empty inventory across reload', async ({ page }) => {
  for (let remaining = 12; remaining > 0; remaining--) {
    const message = answerConfirm(page, true)
    await page.getByRole('button', { name: /^Delete / }).first().click()
    await message
    await expect(metric(page, 'Total products')).toHaveText(String(remaining - 1))
  }

  expect(await storedInventory(page)).toEqual([])
  await expect(metric(page, 'Inventory value')).toHaveText('$0.00')

  await page.reload()
  await expect(metric(page, 'Total products')).toHaveText('0')
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
  await expect(footer(page)).toHaveText('Showing 0 products')
})

test('a failed storage write keeps the deletion visible and shows an honest warning', async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })

  await deleteProduct(page, 'Ceramic Coffee Mug')

  await expect(page.getByRole('row').filter({ hasText: 'HOM-003' })).toHaveCount(0)
  await expect(metric(page, 'Total products')).toHaveText('11')
  const warning = page.locator('.storage-warning')
  await expect(warning).toContainText('could not be saved')
  await expect(warning).toContainText('may be lost on refresh')
  await expect(warning).not.toContainText('saved successfully')

  await page.reload()
  await expect(metric(page, 'Total products')).toHaveText('12')
})
