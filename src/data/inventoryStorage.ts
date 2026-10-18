import { sampleProducts } from './products'
import type { Product } from './products'

export const INVENTORY_STORAGE_KEY = 'northstar-react-dashboard:inventory:v1'

export interface InventoryLoadResult {
  inventory: Product[]
  warning: string
}

const MAX_NAME_LENGTH = 80
const MAX_SKU_LENGTH = 24
const MAX_PRODUCT_PRICE = 1_000_000
const MAX_PRODUCT_STOCK = 1_000_000

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength
}

function isValidProduct(value: unknown): value is Product {
  if (typeof value !== 'object' || value === null) return false
  const product = value as Record<string, unknown>

  return (
    typeof product.id === 'number' &&
    Number.isSafeInteger(product.id) &&
    product.id > 0 &&
    isNonEmptyString(product.name, MAX_NAME_LENGTH) &&
    isNonEmptyString(product.sku, MAX_SKU_LENGTH) &&
    isNonEmptyString(product.category, 80) &&
    isNonEmptyString(product.emoji, 16) &&
    isNonEmptyString(product.color, 32) &&
    typeof product.price === 'number' &&
    Number.isFinite(product.price) &&
    product.price > 0 &&
    product.price <= MAX_PRODUCT_PRICE &&
    typeof product.stock === 'number' &&
    Number.isSafeInteger(product.stock) &&
    product.stock >= 0 &&
    product.stock <= MAX_PRODUCT_STOCK
  )
}

function isValidInventory(value: unknown): value is Product[] {
  if (!Array.isArray(value)) return false

  const ids = new Set<number>()
  const skus = new Set<string>()
  for (const item of value) {
    if (!isValidProduct(item)) return false
    const sku = item.sku.trim().toUpperCase()
    if (ids.has(item.id) || skus.has(sku)) return false
    ids.add(item.id)
    skus.add(sku)
  }
  return true
}

// Falls back to sample data when nothing valid is saved. A valid saved [] is kept as-is.
export function loadInventory(): InventoryLoadResult {
  let saved: string | null
  try {
    saved = window.localStorage.getItem(INVENTORY_STORAGE_KEY)
  } catch {
    return {
      inventory: sampleProducts,
      warning: 'Saved inventory could not be read. Sample inventory is shown for this session and has not been saved.',
    }
  }

  if (saved === null) return { inventory: sampleProducts, warning: '' }

  let parsed: unknown
  try {
    parsed = JSON.parse(saved)
  } catch {
    return {
      inventory: sampleProducts,
      warning: 'Saved inventory data was invalid. Sample inventory is shown for this session and has not been saved.',
    }
  }

  if (isValidInventory(parsed)) return { inventory: parsed, warning: '' }
  return {
    inventory: sampleProducts,
    warning: 'Saved inventory data was invalid. Sample inventory is shown for this session and has not been saved.',
  }
}

export function saveInventory(inventory: Product[]): boolean {
  try {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory))
    return true
  } catch {
    return false
  }
}
