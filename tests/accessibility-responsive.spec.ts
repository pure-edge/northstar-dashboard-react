import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const footer = (page: Page) => page.getByRole('status').filter({ hasText: 'Showing' })
const summaryMetric = (page: Page, name: string) =>
  page
    .getByRole('region', { name: 'Store summary' })
    .locator('article')
    .filter({ hasText: name })
    .locator('.metric-value')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
})

test('row actions have product-specific accessible names', async ({ page }) => {
  const row = page.getByRole('row').filter({ hasText: 'TEE-001' })
  await expect(row.getByRole('button', { name: 'Edit Classic Cotton Tee' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Delete Classic Cotton Tee' })).toBeVisible()
})

test('Add Product supports keyboard navigation, Escape, and focus restoration', async ({ page }) => {
  const add = page.getByRole('button', { name: 'Add product' })
  await add.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Add a product' })
  const name = dialog.getByLabel('Product name')
  await expect(name).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('SKU')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('Unit price ($)')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('Stock quantity')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(add).toBeFocused()
})

test('Edit Product opens from the keyboard and restores focus to its row action', async ({ page }) => {
  const edit = page.getByRole('button', { name: 'Edit Ceramic Coffee Mug' })
  await edit.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Edit product' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Product name')).toBeFocused()
  await expect(dialog.locator('form')).toHaveAttribute('aria-describedby', 'product-form-notice')

  await dialog.getByLabel('Product name').fill('Draft must not save')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(edit).toBeFocused()
  await expect(page.getByRole('row').filter({ hasText: 'HOM-003' })).toContainText('Ceramic Coffee Mug')
})

for (const viewport of [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`table actions and product dialog remain reachable at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize(viewport)

    const pageDimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(pageDimensions.scrollWidth).toBeLessThanOrEqual(pageDimensions.clientWidth)

    const results = page.getByRole('region', {
      name: 'Inventory results; scroll horizontally to view all columns',
    })
    const dimensions = await results.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth)

    await results.focus()
    await page.keyboard.press('Tab')
    const edit = page.getByRole('button', { name: 'Edit Ceramic Coffee Mug' })
    await expect(edit).toBeFocused()
    await page.keyboard.press('Tab')
    const deleteButton = page.getByRole('button', { name: 'Delete Ceramic Coffee Mug' })
    await expect(deleteButton).toBeFocused()
    const scrolledRegion = await results.evaluate((element) => element.scrollLeft)
    expect(scrolledRegion).toBeGreaterThan(0)
    await page.keyboard.press('Shift+Tab')
    await expect(edit).toBeFocused()
    const editBox = await edit.boundingBox()
    expect(editBox).not.toBeNull()
    if (!editBox) return
    expect(editBox.height).toBeGreaterThanOrEqual(36)

    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Edit product' })
    await expect(dialog).toBeVisible()
    const bounds = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        controls: [...element.querySelectorAll('input, button')].map((control) => {
          const controlRect = control.getBoundingClientRect()
          return {
            left: controlRect.left,
            right: controlRect.right,
            top: controlRect.top,
            bottom: controlRect.bottom,
          }
        }),
      }
    })
    expect(bounds.left).toBeGreaterThanOrEqual(0)
    expect(bounds.right).toBeLessThanOrEqual(viewport.width)
    expect(bounds.top).toBeGreaterThanOrEqual(0)
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height)
    for (const control of bounds.controls) {
      expect(control.left).toBeGreaterThanOrEqual(bounds.left)
      expect(control.right).toBeLessThanOrEqual(bounds.right)
      expect(control.top).toBeGreaterThanOrEqual(bounds.top)
      expect(control.bottom).toBeLessThanOrEqual(bounds.bottom)
    }

    const overlongName = 'x'.repeat(81)
    await dialog.getByLabel('Product name').fill(overlongName)
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    const error = dialog.getByRole('status')
    await expect(error).toHaveText('Product name must be 80 characters or fewer.')
    await expect(dialog.locator('form')).toHaveAttribute('aria-describedby', await error.getAttribute('id'))
    await expect(dialog.getByLabel('Product name')).toHaveValue(overlongName)
    const errorBounds = await error.boundingBox()
    const dialogBounds = await dialog.boundingBox()
    expect(errorBounds).not.toBeNull()
    expect(dialogBounds).not.toBeNull()
    if (errorBounds && dialogBounds) {
      expect(errorBounds.x).toBeGreaterThanOrEqual(dialogBounds.x)
      expect(errorBounds.x + errorBounds.width).toBeLessThanOrEqual(dialogBounds.x + dialogBounds.width)
    }

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
  })
}

test('row actions continue to work within search and stock-filter results', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search products or SKU' })
  await search.fill('BAG-002')

  const edit = page.getByRole('button', { name: 'Edit Everyday Canvas Tote' })
  await edit.click()
  const dialog = page.getByRole('dialog', { name: 'Edit product' })
  await dialog.getByLabel('Stock quantity').fill('8')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'BAG-002' })).toContainText('8 units')

  await search.fill('')
  await page.getByLabel('Filter by stock status').selectOption('low')
  const deleteButton = page.getByRole('button', { name: 'Delete Relaxed Fit Hoodie' })
  await expect(deleteButton).toBeVisible()
  page.once('dialog', (browserDialog) => {
    expect(browserDialog.message()).toContain('Relaxed Fit Hoodie')
    expect(browserDialog.message()).toContain('HDY-004')
    void browserDialog.accept()
  })
  await deleteButton.click()
  await expect(page.getByRole('row').filter({ hasText: 'HDY-004' })).toHaveCount(0)
  await expect(summaryMetric(page, 'Total products')).toHaveText('11')
  await expect(page.getByLabel('Filter by stock status')).toHaveValue('low')
})
