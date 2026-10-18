import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { sampleProducts } from './data/products'
import type { Product } from './data/products'
import { loadInventory, saveInventory } from './data/inventoryStorage'
import {
  filterProducts,
  getInventorySummary,
  getStockStatus,
  paginateProducts,
  sortProducts,
  validateProductValues,
} from './data/inventoryUtils'
import type { ProductFormValues, ProductSortOption, StockFilter } from './data/inventoryUtils'
import './App.css'

type OrderStatus = 'Pending' | 'Processing' | 'Shipped'

interface Order {
  id: string
  customer: string
  date: string
  amount: number
  status: OrderStatus
  initials: string
}

const dashboardDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}).format(new Date())

const orders: Order[] = [
  { id: '#NS-2048', customer: 'Olivia Martin', date: 'Today, 10:42 AM', amount: 124, status: 'Pending', initials: 'OM' },
  { id: '#NS-2047', customer: 'Ethan Wilson', date: 'Today, 9:18 AM', amount: 86, status: 'Processing', initials: 'EW' },
  { id: '#NS-2046', customer: 'Sophia Chen', date: 'Yesterday', amount: 212, status: 'Shipped', initials: 'SC' },
  { id: '#NS-2045', customer: 'Noah Patel', date: 'Yesterday', amount: 58, status: 'Pending', initials: 'NP' },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <a className="brand" href="#overview" aria-label="Northstar Supply home">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span><strong>northstar</strong><small>SUPPLY CO.</small></span>
      </a>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Workspace">
        <a className="nav-link active" href="#overview" aria-current="page"><span aria-hidden="true">▦</span> Overview</a>
        <a className="nav-link" href="#inventory"><span aria-hidden="true">▤</span> Inventory</a>
        <a className="nav-link" href="#orders"><span aria-hidden="true">⇄</span> Orders</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <span className="help-icon" aria-hidden="true">?</span>
          <strong>Need a hand?</strong>
          <p>Review your stock and order workflow.</p>
          <a href="#inventory">View inventory →</a>
        </div>
        <div className="profile">
          <div className="avatar" aria-hidden="true">JD</div>
          <div><strong>Jamie Davis</strong><small>Store manager</small></div>
          <span className="profile-menu" aria-hidden="true">···</span>
        </div>
      </div>
    </aside>
  )
}

interface DashboardHeaderProps {
  onAddProduct: () => void
  onResetInventory: () => void
}

function DashboardHeader({ onAddProduct, onResetInventory }: DashboardHeaderProps) {
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">Workspace <span>/</span> Overview</div>
        <div className="topbar-right"><span>Local demo</span><span className="topbar-date">Sample orders · local inventory</span></div>
      </header>
      <section className="page-heading" id="overview">
        <div>
          <p className="eyebrow">{dashboardDate} · Operations overview</p>
          <h1>Good morning, Jamie <span aria-hidden="true">✳</span></h1>
          <p className="subtitle">Here's what's happening with your store today.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button" onClick={onResetInventory}>
            Reset inventory
          </button>
          <button className="button button-primary" type="button" onClick={onAddProduct}>
            <span aria-hidden="true">＋</span> Add product
          </button>
        </div>
      </section>
    </>
  )
}

interface ProductDialogProps {
  product: Product | null
  onClose: () => void
  onSubmit: (values: ProductFormValues) => string | null
}

// Mounted only while open, so the initial form values come from useState's initializer.
function ProductDialog({ product, onClose, onSubmit }: ProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [formValues, setFormValues] = useState<ProductFormValues>(() =>
    product
      ? { name: product.name, sku: product.sku, price: String(product.price), stock: String(product.stock) }
      : { name: '', sku: '', price: '', stock: '' },
  )
  const [submitNotice, setSubmitNotice] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLInputElement>('#product-name')?.focus()

    return () => {
      if (dialog.open) dialog.close()
      const returnTarget = returnFocusRef.current
      if (returnTarget?.isConnected) {
        returnTarget.focus()
      } else {
        document.querySelector<HTMLButtonElement>('.heading-actions .button-primary')?.focus()
      }
    }
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const error = onSubmit(formValues)
    if (error) {
      setSubmitNotice(error)
      return
    }

    setFormValues({ name: '', sku: '', price: '', stock: '' })
    setSubmitNotice('')
    onClose()
  }

  function updateField(field: keyof ProductFormValues, value: string) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }))
    setSubmitNotice('')
  }

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      aria-labelledby="product-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        data-product-id={product?.id}
        aria-describedby="product-form-notice"
      >
        <div className="dialog-heading">
          <div><p className="eyebrow">INVENTORY</p><h2 id="product-dialog-title">{product ? 'Edit product' : 'Add a product'}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <label htmlFor="product-name">Product name</label>
        <input
          id="product-name"
          name="name"
          value={formValues.name}
          onChange={(event) => updateField('name', event.target.value)}
          required
          placeholder="e.g. Everyday Tote Bag"
        />
        <label htmlFor="product-sku">SKU</label>
        <input
          id="product-sku"
          name="sku"
          value={formValues.sku}
          onChange={(event) => updateField('sku', event.target.value)}
          required
          placeholder="e.g. BAG-010"
        />
        <div className="form-row">
          <div>
            <label htmlFor="product-price">Unit price ($)</label>
            <input
              id="product-price"
              name="price"
              type="number"
              value={formValues.price}
              onChange={(event) => updateField('price', event.target.value)}
              min="0.01"
              max="1000000"
              step="0.01"
              required
            />
          </div>
          <div>
            <label htmlFor="product-stock">Stock quantity</label>
            <input
              id="product-stock"
              name="stock"
              type="number"
              value={formValues.stock}
              onChange={(event) => updateField('stock', event.target.value)}
              min="0"
              max="1000000"
              step="1"
              required
            />
          </div>
        </div>
        <p id="product-form-notice" className="form-notice" role="status" aria-live="polite">{submitNotice}</p>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button-primary" type="submit">{product ? 'Save changes' : 'Save product'}</button>
        </div>
      </form>
    </dialog>
  )
}

interface SummaryCardsProps {
  totalProducts: number
  pendingOrderCount: number
  lowStockCount: number
  inventoryValue: number
}

function SummaryCards({ totalProducts, pendingOrderCount, lowStockCount, inventoryValue }: SummaryCardsProps) {
  const metrics = [
    { label: 'Total products', value: String(totalProducts), badge: 'Inventory', note: 'Products listed', tone: 'purple' },
    { label: 'Pending orders', value: String(pendingOrderCount), badge: 'Needs attention', note: 'Awaiting processing', tone: 'blue' },
    { label: 'Low-stock items', value: String(lowStockCount), badge: 'Restock soon', note: 'At or below 5 units', tone: 'orange' },
    { label: 'Inventory value', value: formatCurrency(inventoryValue), badge: 'Estimated', note: 'Retail value at listed prices', tone: 'green' },
  ]

  return (
    <section className="metrics-grid" aria-label="Store summary">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <div className="metric-top">
            <span>{metric.label}</span>
            <span className={`metric-icon ${metric.tone}`} aria-hidden="true">
              {metric.tone === 'purple' ? '▤' : metric.tone === 'blue' ? '↗' : metric.tone === 'orange' ? '⌁' : '＄'}
            </span>
          </div>
          <div className="metric-value">{metric.value}</div>
          <div className="metric-foot"><span className={`trend ${metric.tone}`}>{metric.badge}</span><span>{metric.note}</span></div>
        </article>
      ))}
    </section>
  )
}

interface InventoryTableProps {
  pageProducts: Product[]
  matchingProductCount: number
  displayedStart: number
  displayedEnd: number
  totalInventoryCount: number
  searchQuery: string
  onSearchChange: (query: string) => void
  stockFilter: StockFilter
  onStockFilterChange: (filter: StockFilter) => void
  sortOption: ProductSortOption
  onSortChange: (sortOption: ProductSortOption) => void
  currentPage: number
  pageCount: number
  onPageChange: (page: number) => void
  onEditProduct: (productId: number) => void
  onDeleteProduct: (productId: number) => void
}

function InventoryTable({
  pageProducts,
  matchingProductCount,
  displayedStart,
  displayedEnd,
  totalInventoryCount,
  searchQuery,
  onSearchChange,
  stockFilter,
  onStockFilterChange,
  sortOption,
  onSortChange,
  currentPage,
  pageCount,
  onPageChange,
  onEditProduct,
  onDeleteProduct,
}: InventoryTableProps) {
  return (
    <article className="panel inventory-panel" id="inventory">
      <div className="panel-heading">
        <div><h2>Inventory overview</h2><p>Keep track of your product availability.</p></div>
        <a className="text-link" href="#inventory">View inventory <span aria-hidden="true">→</span></a>
      </div>
      <div className="toolbar" aria-label="Inventory search, stock filter, and sorting">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search products or SKU..."
            aria-label="Search products or SKU"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="visually-hidden" htmlFor="stock-filter">Filter by stock status</label>
        <select
          id="stock-filter"
          className="filter-select"
          aria-label="Filter by stock status"
          value={stockFilter}
          onChange={(event) => onStockFilterChange(event.target.value as StockFilter)}
        >
          <option value="all">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="healthy">Healthy stock</option>
        </select>
        <label className="visually-hidden" htmlFor="sort-products">Sort products</label>
        <select
          id="sort-products"
          className="filter-select"
          aria-label="Sort products"
          value={sortOption}
          onChange={(event) => onSortChange(event.target.value as ProductSortOption)}
        >
          <option value="name-asc">Name A–Z</option>
          <option value="stock-asc">Stock: low to high</option>
          <option value="stock-desc">Stock: high to low</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <div
        className="table-wrap"
        role="region"
        aria-label="Inventory results; scroll horizontally to view all columns"
        tabIndex={matchingProductCount ? 0 : undefined}
      >
        {matchingProductCount ? (
          <table>
            <caption className="visually-hidden">Inventory product list</caption>
            <thead><tr><th scope="col">PRODUCT</th><th scope="col">SKU</th><th scope="col">PRICE</th><th scope="col">STOCK</th><th scope="col">STATUS</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {pageProducts.map((product) => {
                const status = getStockStatus(product.stock)
                const statusLabel = status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock'

                return (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb" style={{ backgroundColor: product.color }} aria-hidden="true">{product.emoji}</span>
                        <span><span className="product-name">{product.name}</span><span className="product-category">{product.category}</span></span>
                      </div>
                    </td>
                    <td><span className="sku">{product.sku}</span></td>
                    <td>{formatCurrency(product.price)}</td>
                    <td><span className="stock-number">{product.stock} units</span></td>
                    <td><span className={`status ${status}`}>{statusLabel}</span></td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => onEditProduct(product.id)}
                          aria-label={`Edit ${product.name}`}
                        >
                          Edit
                        </button>
                        <button
                          className="table-action table-action-danger"
                          type="button"
                          onClick={() => onDeleteProduct(product.id)}
                          aria-label={`Delete ${product.name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <strong>{totalInventoryCount ? 'No products match your search.' : 'No products in inventory.'}</strong>
            {totalInventoryCount > 0 && <p>Try a different product name or SKU.</p>}
          </div>
        )}
      </div>
      <div className="table-footer">
        <span role="status" aria-live="polite" aria-atomic="true">
          {matchingProductCount
            ? `Showing ${displayedStart}–${displayedEnd} of ${matchingProductCount} matching products`
            : totalInventoryCount
              ? 'Showing 0 matching products'
              : 'Showing 0 products'}
        </span>
        <div className="pagination" aria-label="Inventory pages">
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >←</button>
          <span>{currentPage} / {pageCount}</span>
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage === pageCount}
            onClick={() => onPageChange(currentPage + 1)}
          >→</button>
        </div>
      </div>
    </article>
  )
}

function LowStockAlerts({ lowStockProducts, totalProducts }: { lowStockProducts: Product[]; totalProducts: number }) {
  return (
    <article className="panel alerts-panel">
      <div className="panel-heading">
        <div><h2>Stock alerts</h2><p>Products that need attention.</p></div>
        <span className="alert-count" aria-label={`${lowStockProducts.length} low-stock products`}>{lowStockProducts.length}</span>
      </div>
      <div className="alert-list">
        {lowStockProducts.length ? lowStockProducts.map((product) => (
          <div className="alert-item" key={product.id}>
            <span className="alert-emoji" style={{ backgroundColor: product.color }} aria-hidden="true">{product.emoji}</span>
            <span className="alert-copy"><strong>{product.name}</strong><small>{product.sku}</small></span>
            <span className="alert-quantity">{product.stock === 0 ? 'Out' : `${product.stock} left`}</span>
          </div>
        )) : <p className="subtitle">{totalProducts ? 'All products have healthy stock.' : 'No products in inventory.'}</p>}
      </div>
      <a className="text-link alert-link" href="#inventory">Review inventory <span aria-hidden="true">→</span></a>
    </article>
  )
}

function RecentOrders({ recentOrders }: { recentOrders: Order[] }) {
  return (
    <article className="panel orders-panel" id="orders">
      <div className="panel-heading">
        <div><h2>Recent orders</h2><p>Your latest customer orders.</p></div>
        <a className="text-link" href="#orders">All <span aria-hidden="true">→</span></a>
      </div>
      <div className="order-list">
        {recentOrders.slice(0, 4).map((order) => (
          <div className="order-item" key={order.id}>
            <span className="order-icon" aria-hidden="true">{order.initials}</span>
            <span className="order-copy"><strong>{order.id}</strong><small>{order.customer} · {order.date}</small></span>
            <span className="order-amount"><strong>{formatCurrency(order.amount)}</strong><small className={order.status.toLowerCase()}>{order.status}</small></span>
          </div>
        ))}
      </div>
    </article>
  )
}

function App() {
  const [inventoryState, setInventoryState] = useState(loadInventory)
  const { inventory, warning: persistWarning } = inventoryState
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [sortOption, setSortOption] = useState<ProductSortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const editingProduct = inventory.find((product) => product.id === editingProductId) ?? null
  const totalProducts = inventory.length
  const filteredProducts = filterProducts(inventory, searchQuery, stockFilter)
  const sortedProducts = sortProducts(filteredProducts, sortOption)
  const inventoryPage = paginateProducts(sortedProducts, currentPage)
  const {
    products: pageProducts,
    currentPage: displayedPage,
    pageCount,
    displayedStart,
    displayedEnd,
  } = inventoryPage
  const { lowStockProducts, lowStockCount, inventoryValue } = getInventorySummary(inventory)

  function updateSearchQuery(query: string) {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  function updateStockFilter(filter: StockFilter) {
    setStockFilter(filter)
    setCurrentPage(1)
  }

  function updateSortOption(option: ProductSortOption) {
    setSortOption(option)
    setCurrentPage(1)
  }

  function updateInventory(nextInventory: Product[], saveFailureWarning: string) {
    setInventoryState({
      inventory: nextInventory,
      warning: saveInventory(nextInventory) ? '' : saveFailureWarning,
    })
  }

  function addProduct(values: ProductFormValues): string | null {
    const result = validateProductValues(values, inventory, null)
    if ('error' in result) return result.error

    const newProduct: Product = {
      id: inventory.reduce((maxId, product) => Math.max(maxId, product.id), 0) + 1,
      ...result,
      category: 'New product',
      emoji: '📦',
      color: '#f0edff',
    }

    const nextInventory = [...inventory, newProduct]
    updateInventory(
      nextInventory,
      'Product added for this session, but it could not be saved in this browser and may be lost on refresh.',
    )
    resetListView()
    return null
  }

  function editProduct(values: ProductFormValues): string | null {
    if (!editingProduct) return 'No product selected for editing.'

    const result = validateProductValues(values, inventory, editingProduct.id)
    if ('error' in result) return result.error

    // Replace only the matching product (by id); every other product keeps its identity.
    const nextInventory = inventory.map((product) =>
      product.id === editingProduct.id ? { ...product, ...result } : product,
    )
    updateInventory(
      nextInventory,
      'Changes were applied for this session, but could not be saved in this browser and may be lost on refresh.',
    )
    return null
  }

  function deleteProduct(productId: number) {
    const product = inventory.find((item) => item.id === productId)
    if (!product) return

    if (!window.confirm(`Delete "${product.name}" (SKU ${product.sku})? This cannot be undone.`)) return

    // filter builds a new array without the selected id; the old array is untouched.
    const nextInventory = inventory.filter((item) => item.id !== productId)
    updateInventory(
      nextInventory,
      'The product was deleted for this session, but the change could not be saved in this browser and may be lost on refresh.',
    )
  }

  function openAddDialog() {
    setEditingProductId(null)
    setIsProductDialogOpen(true)
  }

  function openEditDialog(productId: number) {
    setEditingProductId(productId)
    setIsProductDialogOpen(true)
  }

  function closeProductDialog() {
    setIsProductDialogOpen(false)
    setEditingProductId(null)
  }

  function resetListView() {
    setSearchQuery('')
    setStockFilter('all')
    setSortOption('name-asc')
    setCurrentPage(1)
  }

  function resetInventory() {
    const confirmed = window.confirm(
      'Replace the current inventory with the original sample inventory? Products you added will be removed.',
    )
    if (!confirmed) return

    updateInventory(
      sampleProducts,
      'Inventory was reset for this session, but it could not be saved in this browser and may revert on refresh.',
    )
    resetListView()
  }

  const pendingOrderCount = orders.filter((order) => order.status === 'Pending').length

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <DashboardHeader
          onAddProduct={openAddDialog}
          onResetInventory={resetInventory}
        />
        {persistWarning && <p className="storage-warning" role="status">{persistWarning}</p>}
        <SummaryCards
          totalProducts={totalProducts}
          pendingOrderCount={pendingOrderCount}
          lowStockCount={lowStockCount}
          inventoryValue={inventoryValue}
        />
        <section className="content-grid" aria-label="Inventory and store activity">
          <InventoryTable
            pageProducts={pageProducts}
            matchingProductCount={filteredProducts.length}
            displayedStart={displayedStart}
            displayedEnd={displayedEnd}
            totalInventoryCount={totalProducts}
            searchQuery={searchQuery}
            onSearchChange={updateSearchQuery}
            stockFilter={stockFilter}
            onStockFilterChange={updateStockFilter}
            sortOption={sortOption}
            onSortChange={updateSortOption}
            currentPage={displayedPage}
            pageCount={pageCount}
            onPageChange={setCurrentPage}
            onEditProduct={openEditDialog}
            onDeleteProduct={deleteProduct}
          />
          <aside className="right-column" aria-label="Store activity">
            <LowStockAlerts lowStockProducts={lowStockProducts} totalProducts={totalProducts} />
            <RecentOrders recentOrders={orders} />
          </aside>
        </section>
        <footer className="page-footer">
          <span>Northstar Supply Co.</span>
          <span>Local demo · Sample orders</span>
        </footer>
      </main>
      {isProductDialogOpen && (
        <ProductDialog
          key={editingProductId ?? 'new'}
          product={editingProduct}
          onClose={closeProductDialog}
          onSubmit={editingProduct ? editProduct : addProduct}
        />
      )}
    </div>
  )
}

export default App
