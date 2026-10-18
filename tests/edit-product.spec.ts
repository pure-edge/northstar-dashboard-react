import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Each test gets a fresh browser context, so localStorage always starts empty.
const STORAGE_KEY = 'northstar-react-dashboard:inventory:v1'

const footer = (page: Page) => page.getByRole('status').filter({ hasText: 'Showing' })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Edit product' })
const row = (page: Page, sku: string) => page.getByRole('row').filter({ hasText: sku })
const alerts = (page: Page) => page.getByRole('complementary', { name: 'Store activity' })
const metric = (page: Page, label: string) =>
  page
    .getByRole('region', { name: 'Store summary' })
    .locator('article')
    .filter({ hasText: label })
    .locator('.metric-value')

async function openEdit(page: Page, productName: string) {
  await page.getByRole('button', { name: `Edit ${productName}` }).click()
  await expect(dialog(page)).toBeVisible()
}

async function fillEdit(page: Page, values: { name?: string; sku?: string; price?: string; stock?: string }) {
  const d = dialog(page)
  if (values.name !== undefined) await d.getByLabel('Product name').fill(values.name)
  if (values.sku !== undefined) await d.getByLabel('SKU').fill(values.sku)
  if (values.price !== undefined) await d.getByLabel('Unit price ($)').fill(values.price)
  if (values.stock !== undefined) await d.getByLabel('Stock quantity').fill(values.stock)
}

const storedInventory = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
})

test('edit action prefills the form for the selected product', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  const d = dialog(page)
  await expect(d.getByLabel('Product name')).toHaveValue('Classic Cotton Tee')
  await expect(d.getByLabel('SKU')).toHaveValue('TEE-001')
  await expect(d.getByLabel('Unit price ($)')).toHaveValue('24')
  await expect(d.getByLabel('Stock quantity')).toHaveValue('42')
  await expect(d.locator('form')).toHaveAttribute('data-product-id', '1')
  await expect(d.getByRole('button', { name: 'Save changes' })).toBeVisible()
})

test('editing updates displayed values without changing the product count', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  await fillEdit(page, { name: 'Alpha Premium Tee', price: '30.5', stock: '40' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  const updated = row(page, 'TEE-001')
  await expect(updated).toContainText('Alpha Premium Tee')
  await expect(updated).toContainText('$30.50')
  await expect(updated).toContainText('40 units')
  await expect(page.getByText('Classic Cotton Tee')).toHaveCount(0)
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
  await expect(metric(page, 'Total products')).toHaveText('12')
  await expect(page.getByRole('row').filter({ hasText: 'TEE-001' })).toHaveCount(1)

  const stored = await storedInventory(page)
  expect(stored).toHaveLength(12)
  expect(stored.filter((p: { id: number }) => p.id === 1)).toHaveLength(1)
})

test('keeping the same SKU is allowed, and a lowercase SKU is normalized', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  await fillEdit(page, { sku: 'tee-001', price: '25' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(row(page, 'TEE-001')).toContainText('$25.00')
})

test('a case-insensitive duplicate SKU of another product is rejected', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  await fillEdit(page, { name: 'Should Not Save', sku: 'bag-002' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()

  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByRole('status')).toHaveText('That SKU already exists. Use a unique SKU.')
  await expect(dialog(page).getByLabel('Product name')).toHaveValue('Should Not Save')
  await expect(dialog(page).getByLabel('SKU')).toHaveValue('bag-002')

  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, 'TEE-001')).toContainText('Classic Cotton Tee')
})

test('invalid values are rejected and entered values stay available for correction', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  const d = dialog(page)
  const save = d.getByRole('button', { name: 'Save changes' })

  await fillEdit(page, { name: 'x'.repeat(81) })
  await save.click()
  await expect(d.getByRole('status')).toHaveText('Product name must be 80 characters or fewer.')
  await expect(d.getByLabel('Product name')).toHaveValue('x'.repeat(81))

  await fillEdit(page, { name: 'Valid Name', sku: 'S'.repeat(25) })
  await save.click()
  await expect(d.getByRole('status')).toHaveText('SKU must be 24 characters or fewer.')
  await expect(d.getByLabel('SKU')).toHaveValue('S'.repeat(25))
  await expect(d.getByLabel('Product name')).toHaveValue('Valid Name')

  // Invalid numbers: bypass native constraint validation so the JavaScript rules are what is tested.
  await d.locator('form').evaluate((form) => form.setAttribute('novalidate', ''))
  await fillEdit(page, { sku: 'TEE-001', price: '0' })
  await save.click()
  await expect(d.getByRole('status')).toContainText('Enter a price greater than $0')

  await fillEdit(page, { price: '1000001' })
  await save.click()
  await expect(d.getByRole('status')).toContainText('Enter a price greater than $0')

  await fillEdit(page, { price: '24', stock: '1.5' })
  await save.click()
  await expect(d.getByRole('status')).toContainText('whole-number stock')

  await fillEdit(page, { stock: '-1' })
  await save.click()
  await expect(d.getByRole('status')).toContainText('whole-number stock')

  await fillEdit(page, { stock: '1000001' })
  await save.click()
  await expect(d.getByRole('status')).toContainText('whole-number stock')

  await fillEdit(page, { name: '   ' })
  await save.click()
  await expect(d.getByRole('status')).toHaveText('Enter a product name and SKU.')

  // Nothing was applied, and the user can correct the field and resubmit.
  await expect(d).toBeVisible()
  expect(await storedInventory(page)).toBeNull()
  await fillEdit(page, { name: 'Corrected Tee', stock: '10' })
  await save.click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(row(page, 'TEE-001')).toContainText('Corrected Tee')
})

test('canceling an edit leaves the product and localStorage unchanged', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  await fillEdit(page, { name: 'Discarded', stock: '1' })
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(row(page, 'TEE-001')).toContainText('Classic Cotton Tee')
  await expect(row(page, 'TEE-001')).toContainText('42 units')
  expect(await storedInventory(page)).toBeNull()

  // Reopening shows the original values, not the discarded draft.
  await openEdit(page, 'Classic Cotton Tee')
  await expect(dialog(page).getByLabel('Product name')).toHaveValue('Classic Cotton Tee')
  await expect(dialog(page).getByLabel('Stock quantity')).toHaveValue('42')
})

test('a successful edit persists across reload', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  // Names starting with "Alpha" keep the edited row on page 1 under the default Name A–Z sort.
  await fillEdit(page, { name: 'Alpha Persisted Tee', stock: '9' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(row(page, 'TEE-001')).toContainText('Alpha Persisted Tee')

  await page.reload()
  await expect(footer(page)).toContainText('of 12')
  await expect(row(page, 'TEE-001')).toContainText('Alpha Persisted Tee')
  await expect(row(page, 'TEE-001')).toContainText('9 units')
})

test('editing stock updates low-stock alerts and summary metrics', async ({ page }) => {
  await expect(metric(page, 'Low-stock items')).toHaveText('6')
  await expect(metric(page, 'Inventory value')).toHaveText('$4,337.00')
  await expect(page.getByLabel('6 low-stock products')).toBeVisible()

  // 42 -> 3 units at $24: now low stock, and value drops by 39 * 24 = $936.
  await openEdit(page, 'Classic Cotton Tee')
  await fillEdit(page, { stock: '3' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()

  await expect(metric(page, 'Low-stock items')).toHaveText('7')
  await expect(metric(page, 'Inventory value')).toHaveText('$3,401.00')
  await expect(metric(page, 'Total products')).toHaveText('12')
  await expect(page.getByLabel('7 low-stock products')).toBeVisible()
  await expect(alerts(page).getByText('Classic Cotton Tee')).toBeVisible()
  await expect(row(page, 'TEE-001')).toContainText('Low stock')

  // 4 -> 20 units for a low-stock item removes it from the alerts.
  await openEdit(page, 'Everyday Canvas Tote')
  await fillEdit(page, { stock: '20' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(metric(page, 'Low-stock items')).toHaveText('6')
  await expect(alerts(page).getByText('Everyday Canvas Tote')).toHaveCount(0)
})

test('a failed storage write keeps the edit visible and shows an honest warning', async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded')
    }
  })

  await openEdit(page, 'Classic Cotton Tee')
  await fillEdit(page, { name: 'Alpha Unsaved Tee' })
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()

  await expect(row(page, 'TEE-001')).toContainText('Alpha Unsaved Tee')
  const warning = page.locator('.storage-warning')
  await expect(warning).toContainText('could not be saved')
  await expect(warning).not.toContainText('Changes saved')
})

test('add product still works after the dialog was used for editing', async ({ page }) => {
  await openEdit(page, 'Classic Cotton Tee')
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Add product' }).click()
  const add = page.getByRole('dialog', { name: 'Add a product' })
  await expect(add.getByLabel('Product name')).toHaveValue('')
  await add.getByLabel('Product name').fill('Brand New')
  await add.getByLabel('SKU').fill('new-1')
  await add.getByLabel('Unit price ($)').fill('5')
  await add.getByLabel('Stock quantity').fill('2')
  await add.getByRole('button', { name: 'Save product' }).click()

  await expect(footer(page)).toContainText('of 13')
  await expect(row(page, 'TEE-001')).toContainText('Classic Cotton Tee')
})
