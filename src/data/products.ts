export interface Product {
  id: number
  name: string
  category: string
  sku: string
  price: number
  stock: number
  emoji: string
  color: string
}

export const sampleProducts: Product[] = [
  { id: 1, name: 'Classic Cotton Tee', category: 'Apparel', sku: 'TEE-001', price: 24, stock: 42, emoji: '👕', color: '#f0edff' },
  { id: 2, name: 'Everyday Canvas Tote', category: 'Accessories', sku: 'BAG-002', price: 18, stock: 4, emoji: '👜', color: '#fff0e5' },
  { id: 3, name: 'Ceramic Coffee Mug', category: 'Home goods', sku: 'HOM-003', price: 16, stock: 28, emoji: '☕', color: '#e9f5ed' },
  { id: 4, name: 'Relaxed Fit Hoodie', category: 'Apparel', sku: 'HDY-004', price: 58, stock: 3, emoji: '🧥', color: '#eaf2ff' },
  { id: 5, name: 'Minimalist Cap', category: 'Accessories', sku: 'CAP-005', price: 22, stock: 0, emoji: '🧢', color: '#fff1f1' },
  { id: 6, name: 'Insulated Water Bottle', category: 'Outdoor', sku: 'OUT-006', price: 32, stock: 19, emoji: '🧴', color: '#e9f7f5' },
  { id: 7, name: 'Weekend Duffle Bag', category: 'Accessories', sku: 'BAG-007', price: 64, stock: 2, emoji: '🎒', color: '#f3edff' },
  { id: 8, name: 'Linen Blend Shirt', category: 'Apparel', sku: 'SHR-008', price: 46, stock: 15, emoji: '👔', color: '#fff4df' },
  { id: 9, name: 'Desk Organizer', category: 'Home goods', sku: 'DSK-009', price: 27, stock: 0, emoji: '🗂️', color: '#edf1ff' },
  { id: 10, name: 'Soft Knit Beanie', category: 'Accessories', sku: 'HAT-010', price: 20, stock: 7, emoji: '🧶', color: '#fcecf3' },
  { id: 11, name: 'Travel Packing Cubes', category: 'Outdoor', sku: 'TRV-011', price: 25, stock: 1, emoji: '🧳', color: '#e9f5ed' },
  { id: 12, name: 'Stainless Lunch Box', category: 'Home goods', sku: 'LCH-012', price: 29, stock: 36, emoji: '🍱', color: '#fff0e5' },
]
