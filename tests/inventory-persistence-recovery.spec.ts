import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sampleProducts } from '../src/data/products'

const STORAGE_KEY = 'northstar-react-dashboard:inventory:v1'

const footer = (page: Page) => page.getByRole('status').filter({ hasText: 'Showing' })
const totalProducts = (page: Page) =>
  page
    .getByRole('region', { name: 'Store summary' })
    .locator('article')
    .filter({ hasText: 'Total products' })
    .locator('.metric-value')

const sampleCopy = JSON.parse(JSON.stringify(sampleProducts))

const invalidInventories: Array<{ name: string; value: string }> = [
  { name: 'malformed JSON', value: '{not valid json' },
  {
    name: 'an invalid product record',
    value: JSON.stringify([{ ...sampleCopy[0], price: -1 }]),
  },
  {
    name: 'duplicate product IDs',
    value: JSON.stringify([sampleCopy[0], { ...sampleCopy[1], id: sampleCopy[0].id }]),
  },
  {
    name: 'duplicate SKUs with different casing',
    value: JSON.stringify([sampleCopy[0], { ...sampleCopy[1], sku: sampleCopy[0].sku.toLowerCase() }]),
  },
]

for (const invalidInventory of invalidInventories) {
  test(`invalid saved data (${invalidInventory.name}) falls back safely and remains usable`, async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: STORAGE_KEY, value: invalidInventory.value },
    )
    await page.goto('/')

    await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
    await expect(totalProducts(page)).toHaveText('12')
    await expect(page.getByRole('row').filter({ hasText: 'TEE-001' })).toContainText('Classic Cotton Tee')
    await expect(page.locator('.storage-warning')).toContainText('Saved inventory data was invalid')
    await expect(page.locator('.storage-warning')).toContainText('has not been saved')
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(invalidInventory.value)

    await page.getByRole('searchbox', { name: 'Search products or SKU' }).fill('TEE-001')
    await expect(footer(page)).toHaveText('Showing 1–1 of 1 matching products')
    await expect(page.getByRole('row').filter({ hasText: 'TEE-001' })).toBeVisible()
  })
}

test('a valid saved empty inventory stays empty on startup', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '[]'), STORAGE_KEY)
  await page.goto('/')

  await expect(totalProducts(page)).toHaveText('0')
  await expect(footer(page)).toHaveText('Showing 0 products')
  await expect(page.getByRole('region', {
    name: 'Inventory results; scroll horizontally to view all columns',
  }).getByText('No products in inventory.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
  await expect(page.locator('.storage-warning')).toHaveCount(0)
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY)).toEqual([])
})

test('a localStorage read failure warns while sample inventory remains usable this session', async ({ page }) => {
  await page.addInitScript((key) => {
    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = function (requestedKey) {
      if (requestedKey === key) throw new DOMException('Storage unavailable', 'SecurityError')
      return originalGetItem.call(this, requestedKey)
    }
  }, STORAGE_KEY)
  await page.goto('/')

  await expect(totalProducts(page)).toHaveText('12')
  await expect(page.locator('.storage-warning')).toContainText('Saved inventory could not be read')
  await expect(page.locator('.storage-warning')).toContainText('has not been saved')
  await expect(footer(page)).toContainText('of 12')
  await expect(page.getByText(/inventory saved in this browser/i)).toHaveCount(0)

  await page.getByRole('button', { name: 'Add product' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a product' })
  await dialog.getByLabel('Product name').fill('Session Product')
  await dialog.getByLabel('SKU').fill('SESSION-1')
  await dialog.getByLabel('Unit price ($)').fill('12')
  await dialog.getByLabel('Stock quantity').fill('2')
  await dialog.getByRole('button', { name: 'Save product' }).click()

  await expect(totalProducts(page)).toHaveText('13')
  await page.getByRole('searchbox', { name: 'Search products or SKU' }).fill('SESSION-1')
  await expect(page.getByRole('row').filter({ hasText: 'SESSION-1' })).toContainText('Session Product')
  await expect(page.locator('.storage-warning')).toHaveCount(0)
})

test('a reset write failure reports that sample inventory was not saved', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add product' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a product' })
  await dialog.getByLabel('Product name').fill('Persisted Extra')
  await dialog.getByLabel('SKU').fill('PERSIST-1')
  await dialog.getByLabel('Unit price ($)').fill('10')
  await dialog.getByLabel('Stock quantity').fill('1')
  await dialog.getByRole('button', { name: 'Save product' }).click()

  await expect(totalProducts(page)).toHaveText('13')
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })

  page.once('dialog', (browserDialog) => {
    expect(browserDialog.type()).toBe('confirm')
    void browserDialog.accept()
  })
  await page.getByRole('button', { name: 'Reset inventory' }).click()

  await expect(totalProducts(page)).toHaveText('12')
  await expect(page.getByRole('row').filter({ hasText: 'PERSIST-1' })).toHaveCount(0)
  const warning = page.locator('.storage-warning')
  await expect(warning).toContainText('reset for this session')
  await expect(warning).toContainText('could not be saved')
  await expect(warning).toContainText('may revert on refresh')
  await expect(warning).not.toContainText('saved successfully')

  await page.reload()
  await expect(totalProducts(page)).toHaveText('13')
  await page.getByRole('searchbox', { name: 'Search products or SKU' }).fill('PERSIST-1')
  await expect(page.getByRole('row').filter({ hasText: 'PERSIST-1' })).toContainText('Persisted Extra')
})
