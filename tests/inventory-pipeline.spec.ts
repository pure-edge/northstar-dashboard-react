import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const footer = (page: Page) => page.getByRole('status').filter({ hasText: 'Showing' })
const rows = (page: Page) => page.locator('tbody tr')
const productNames = (page: Page) => page.locator('tbody .product-name').allTextContents()

test('search, stock filter, sort, and pagination update together in sequence', async ({ page }) => {
  await page.goto('/')
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')

  const search = page.getByRole('searchbox', { name: 'Search products or SKU' })
  const stockFilter = page.getByLabel('Filter by stock status')
  const sort = page.getByLabel('Sort products')
  const next = page.getByRole('button', { name: 'Next page' })
  const previous = page.getByRole('button', { name: 'Previous page' })

  await search.fill('e')
  await expect(footer(page)).toHaveText('Showing 1–5 of 11 matching products')
  await expect(rows(page)).toHaveCount(5)
  expect(await productNames(page)).toEqual([
    'Ceramic Coffee Mug',
    'Classic Cotton Tee',
    'Desk Organizer',
    'Everyday Canvas Tote',
    'Insulated Water Bottle',
  ])
  await expect(page.getByRole('row').filter({ hasText: 'CAP-005' })).toHaveCount(0)

  await stockFilter.selectOption('healthy')
  await expect(footer(page)).toHaveText('Showing 1–5 of 6 matching products')
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()
  for (const row of await rows(page).all()) {
    const stock = Number((await row.locator('.stock-number').innerText()).split(' ')[0])
    expect(stock).toBeGreaterThan(5)
  }

  await sort.selectOption('stock-desc')
  await expect(footer(page)).toHaveText('Showing 1–5 of 6 matching products')
  expect(await productNames(page)).toEqual([
    'Classic Cotton Tee',
    'Stainless Lunch Box',
    'Ceramic Coffee Mug',
    'Insulated Water Bottle',
    'Linen Blend Shirt',
  ])

  await next.click()
  await expect(footer(page)).toHaveText('Showing 6–6 of 6 matching products')
  await expect(previous).toBeEnabled()
  await expect(next).toBeDisabled()
  expect(await productNames(page)).toEqual(['Soft Knit Beanie'])

  await search.fill('HOM-003')
  await expect(footer(page)).toHaveText('Showing 1–1 of 1 matching products')
  await expect(previous).toBeDisabled()
  await expect(next).toBeDisabled()
  expect(await productNames(page)).toEqual(['Ceramic Coffee Mug'])

  await search.fill('e')
  await expect(footer(page)).toHaveText('Showing 1–5 of 6 matching products')
  await next.click()
  await expect(footer(page)).toHaveText('Showing 6–6 of 6 matching products')
  expect(await productNames(page)).toEqual(['Soft Knit Beanie'])

  await stockFilter.selectOption('low')
  await expect(footer(page)).toHaveText('Showing 1–4 of 4 matching products')
  await expect(previous).toBeDisabled()
  await expect(next).toBeDisabled()
  expect(await productNames(page)).toEqual([
    'Everyday Canvas Tote',
    'Relaxed Fit Hoodie',
    'Weekend Duffle Bag',
    'Travel Packing Cubes',
  ])
  for (const row of await rows(page).all()) {
    const stock = Number((await row.locator('.stock-number').innerText()).split(' ')[0])
    expect(stock).toBeGreaterThanOrEqual(1)
    expect(stock).toBeLessThanOrEqual(5)
  }

  await stockFilter.selectOption('all')
  await expect(footer(page)).toHaveText('Showing 1–5 of 11 matching products')
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()

  await search.fill('')
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
  expect(await productNames(page)).toHaveLength(5)
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()

  await sort.selectOption('name-asc')
  await expect(footer(page)).toHaveText('Showing 1–5 of 12 matching products')
  expect(await productNames(page)).toEqual([
    'Ceramic Coffee Mug',
    'Classic Cotton Tee',
    'Desk Organizer',
    'Everyday Canvas Tote',
    'Insulated Water Bottle',
  ])

  await next.click()
  await expect(footer(page)).toHaveText('Showing 6–10 of 12 matching products')
  await expect(previous).toBeEnabled()
  expect(await productNames(page)).toEqual([
    'Linen Blend Shirt',
    'Minimalist Cap',
    'Relaxed Fit Hoodie',
    'Soft Knit Beanie',
    'Stainless Lunch Box',
  ])
})
