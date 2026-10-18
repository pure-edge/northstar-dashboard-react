import type { Product } from './products'

export interface ProductFormValues {
  name: string
  sku: string
  price: string
  stock: string
}

export type StockStatus = 'out' | 'low' | 'healthy'
export type StockFilter = 'all' | StockStatus
export type ProductSortOption = 'name-asc' | 'stock-asc' | 'stock-desc' | 'price-desc'

export const LOW_STOCK_THRESHOLD = 5
export const PAGE_SIZE = 5
const MAX_PRODUCT_PRICE = 1_000_000
const MAX_PRODUCT_STOCK = 1_000_000

export type ProductValidationResult =
  | { error: string }
  | { name: string; sku: string; price: number; stock: number }

export interface InventoryPage {
  products: Product[]
  currentPage: number
  pageCount: number
  displayedStart: number
  displayedEnd: number
}

export function getStockStatus(stock: number): StockStatus {
  if (stock === 0) return 'out'
  if (stock <= LOW_STOCK_THRESHOLD) return 'low'
  return 'healthy'
}

export function validateProductValues(
  values: ProductFormValues,
  inventory: Product[],
  editingId: number | null,
): ProductValidationResult {
  const name = values.name.trim()
  const sku = values.sku.trim().toUpperCase()
  const price = Number(values.price)
  const stock = Number(values.stock)

  if (!name || !sku) {
    return { error: 'Enter a product name and SKU.' }
  }
  if (name.length > 80) {
    return { error: 'Product name must be 80 characters or fewer.' }
  }
  if (sku.length > 24) {
    return { error: 'SKU must be 24 characters or fewer.' }
  }
  if (inventory.some((product) => product.id !== editingId && product.sku.toLowerCase() === sku.toLowerCase())) {
    return { error: 'That SKU already exists. Use a unique SKU.' }
  }
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRODUCT_PRICE) {
    return { error: 'Enter a price greater than $0 and no more than $1,000,000.' }
  }
  if (values.stock.trim() === '' || !Number.isSafeInteger(stock) || stock < 0 || stock > MAX_PRODUCT_STOCK) {
    return { error: 'Enter a whole-number stock quantity from 0 to 1,000,000.' }
  }
  return { name, sku, price, stock }
}

export function filterProducts(
  inventory: Product[],
  query: string,
  stockFilter: StockFilter,
): Product[] {
  const normalizedQuery = query.trim().toLowerCase()
  return inventory.filter((product) => (
    (product.name.toLowerCase().includes(normalizedQuery)
      || product.sku.toLowerCase().includes(normalizedQuery))
    && (stockFilter === 'all' || getStockStatus(product.stock) === stockFilter)
  ))
}

export function sortProducts(products: Product[], sortOption: ProductSortOption): Product[] {
  return [...products].sort((a, b) => {
    switch (sortOption) {
      case 'stock-asc':
        return a.stock - b.stock || a.name.localeCompare(b.name)
      case 'stock-desc':
        return b.stock - a.stock || a.name.localeCompare(b.name)
      case 'price-desc':
        return b.price - a.price || a.name.localeCompare(b.name)
      default:
        return a.name.localeCompare(b.name)
    }
  })
}

export function paginateProducts(
  products: Product[],
  requestedPage: number,
  pageSize = PAGE_SIZE,
): InventoryPage {
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize))
  const currentPage = Math.min(requestedPage, pageCount)
  const startIndex = products.length ? (currentPage - 1) * pageSize : 0
  const pageProducts = products.slice(startIndex, startIndex + pageSize)

  return {
    products: pageProducts,
    currentPage,
    pageCount,
    displayedStart: products.length ? startIndex + 1 : 0,
    displayedEnd: Math.min(startIndex + pageProducts.length, products.length),
  }
}

export function getInventorySummary(inventory: Product[]) {
  const lowStockProducts = inventory
    .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))

  return {
    lowStockProducts,
    lowStockCount: lowStockProducts.length,
    inventoryValue: inventory.reduce((total, product) => total + product.price * product.stock, 0),
  }
}
