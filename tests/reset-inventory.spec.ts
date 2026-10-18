import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const CONFIRM_TEXT = 'Replace the current inventory with the original sample inventory?'

// Each Playwright test gets a fresh browser context, so localStorage starts empty and
// nothing from these tests leaks into other tests or into your normal browser profile.
async function addProduct(page: Page, name: string, sku: string, stock: string) {
  await page.getByRole('button', { name: 'Add product' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a product' })
  await dialog.getByLabel('Product name').fill(name)
  await dialog.getByLabel('SKU').fill(sku)
  await dialog.getByLabel('Unit price ($)').fill('10')
  await dialog.getByLabel('Stock quantity').fill(stock)
  await dialog.getByRole('button', { name: 'Save product' }).click()
}

function acceptNextConfirm(page: Page) {
  page.once('dialog', (dialog) => {
    expect(dialog.type()).toBe('confirm')
    expect(dialog.message()).toContain(CONFIRM_TEXT)
    void dialog.accept()
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText(
    'Showing 1–5 of 12 matching products',
  )
})

test('reset returns the stock filter to All stock', async ({ page }) => {
  const filter = page.getByLabel('Filter by stock status')
  await filter.selectOption({ label: 'Low stock' })
  await expect(filter).toHaveValue('low')

  acceptNextConfirm(page)
  await page.getByRole('button', { name: 'Reset inventory' }).click()

  await expect(filter).toHaveValue('all')
  await expect(filter.locator('option:checked')).toHaveText('All stock')
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText(
    'Showing 1–5 of 12 matching products',
  )
})

test('reset returns sorting to Name A–Z', async ({ page }) => {
  const sort = page.getByLabel('Sort products')
  await sort.selectOption({ label: 'Price: high to low' })
  await expect(sort).toHaveValue('price-desc')

  acceptNextConfirm(page)
  await page.getByRole('button', { name: 'Reset inventory' }).click()

  await expect(sort).toHaveValue('name-asc')
  await expect(page.locator('tbody tr').first()).toContainText('Ceramic Coffee Mug')
})

test('reset returns to page 1 with Previous disabled', async ({ page }) => {
  const previous = page.getByRole('button', { name: 'Previous page' })
  const next = page.getByRole('button', { name: 'Next page' })
  const footer = page.getByRole('status').filter({ hasText: 'Showing' })

  await next.click()
  await next.click()
  await expect(footer).toHaveText('Showing 11–12 of 12 matching products')
  await expect(previous).toBeEnabled()

  acceptNextConfirm(page)
  await page.getByRole('button', { name: 'Reset inventory' }).click()

  await expect(footer).toHaveText('Showing 1–5 of 12 matching products')
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()
})

test('reset removes added products and persists the sample inventory', async ({ page }) => {
  await addProduct(page, 'Temp Product', 'tmp-1', '0')
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText('of 13')

  acceptNextConfirm(page)
  await page.getByRole('button', { name: 'Reset inventory' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText('of 12')

  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText('of 12')
})

for (const viewport of [
  { name: 'tablet 768px', width: 768, height: 1024 },
  { name: 'mobile 375px', width: 375, height: 812 },
]) {
  test(`reset button is visible without overlap or horizontal overflow at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    const reset = page.getByRole('button', { name: 'Reset inventory' })
    const add = page.getByRole('button', { name: 'Add product' })
    await expect(reset).toBeVisible()
    await expect(add).toBeVisible()

    const resetBox = await reset.boundingBox()
    const addBox = await add.boundingBox()
    expect(resetBox).not.toBeNull()
    expect(addBox).not.toBeNull()
    if (!resetBox || !addBox) return

    // Fully inside the viewport horizontally.
    expect(resetBox.x).toBeGreaterThanOrEqual(0)
    expect(resetBox.x + resetBox.width).toBeLessThanOrEqual(viewport.width)

    // The two buttons must not intersect.
    const overlaps =
      resetBox.x < addBox.x + addBox.width &&
      resetBox.x + resetBox.width > addBox.x &&
      resetBox.y < addBox.y + addBox.height &&
      resetBox.y + resetBox.height > addBox.y
    expect(overlaps).toBe(false)

    // No horizontal page scrolling.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('reset button can be reached and activated by keyboard, and confirmation can be dismissed', async ({
  page,
}) => {
  await addProduct(page, 'Keep Me', 'keep-1', '3')
  const footer = page.getByRole('status').filter({ hasText: 'Showing' })
  await expect(footer).toContainText('of 13')

  const reset = page.getByRole('button', { name: 'Reset inventory' })

  // Tab from the top of the page until the Reset button has focus.
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  let focused = false
  for (let i = 0; i < 30 && !focused; i++) {
    await page.keyboard.press('Tab')
    focused = await reset.evaluate((el) => el === document.activeElement)
  }
  expect(focused).toBe(true)

  // Playwright drives native dialogs through its dialog event: dismiss() is the
  // equivalent of pressing Cancel/Escape. It cannot send real keystrokes to the OS dialog.
  let message = ''
  page.once('dialog', (dialog) => {
    message = dialog.message()
    void dialog.dismiss()
  })
  await page.keyboard.press('Enter')

  await expect.poll(() => message).toContain(CONFIRM_TEXT)
  await expect(footer).toContainText('of 13')
  await expect(reset).toBeFocused()

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('northstar-react-dashboard:inventory:v1') ?? '[]'),
  )
  expect(stored).toHaveLength(13)

  // Space also activates the button; dismissing again still changes nothing.
  message = ''
  page.once('dialog', (dialog) => {
    message = dialog.message()
    void dialog.dismiss()
  })
  await page.keyboard.press('Space')
  await expect.poll(() => message).toContain(CONFIRM_TEXT)
  await expect(footer).toContainText('of 13')
})
