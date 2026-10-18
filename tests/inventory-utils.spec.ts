import { expect, test } from '@playwright/test'
import { sampleProducts } from '../src/data/products'
import {
  filterProducts,
  getInventorySummary,
  paginateProducts,
  sortProducts,
  validateProductValues,
} from '../src/data/inventoryUtils'

test('filtering trims and ignores case while combining search with stock status', () => {
  expect(filterProducts(sampleProducts, '  tee-001  ', 'all').map((product) => product.id)).toEqual([1])
  expect(filterProducts(sampleProducts, '', 'low').map((product) => product.id)).toEqual([2, 4, 7, 11])
  expect(filterProducts(sampleProducts, 'bag', 'low').map((product) => product.id)).toEqual([2, 7])
})

test('sorting returns a sorted copy without mutating inventory order', () => {
  const originalIds = sampleProducts.map((product) => product.id)
  const sorted = sortProducts(sampleProducts, 'price-desc')

  expect(sorted[0].id).toBe(7)
  expect(sampleProducts.map((product) => product.id)).toEqual(originalIds)
  expect(sorted).not.toBe(sampleProducts)
})

test('pagination clamps an invalid page and represents empty results as one page', () => {
  const finalPage = paginateProducts(sampleProducts, 9)
  expect(finalPage.currentPage).toBe(3)
  expect(finalPage.pageCount).toBe(3)
  expect(finalPage.products.map((product) => product.id)).toEqual([11, 12])
  expect(finalPage.displayedStart).toBe(11)
  expect(finalPage.displayedEnd).toBe(12)

  expect(paginateProducts([], 4)).toEqual({
    products: [],
    currentPage: 1,
    pageCount: 1,
    displayedStart: 0,
    displayedEnd: 0,
  })
})

test('validation normalizes SKUs and excludes the edited product from duplicate checks', () => {
  const sameSku = validateProductValues(
    { name: ' Tee ', sku: 'tee-001', price: '24', stock: '42' },
    sampleProducts,
    1,
  )
  expect(sameSku).toEqual({ name: 'Tee', sku: 'TEE-001', price: 24, stock: 42 })

  expect(validateProductValues(
    { name: 'New product', sku: 'tee-001', price: '24', stock: '1' },
    sampleProducts,
    null,
  )).toEqual({ error: 'That SKU already exists. Use a unique SKU.' })
})

test('inventory summary is derived from the complete inventory', () => {
  const summary = getInventorySummary(sampleProducts)
  expect(summary.lowStockCount).toBe(6)
  expect(summary.inventoryValue).toBe(4337)
  expect(summary.lowStockProducts.map((product) => product.id)).toEqual([9, 5, 11, 7, 4, 2])
})
