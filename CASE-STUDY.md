# Northstar Supply E-commerce Operations Dashboard

## Project Overview

Northstar is a React and TypeScript frontend prototype for reviewing and maintaining a small product inventory.

- **Live demo:** [northstar-dashboard-react.vercel.app](https://northstar-dashboard-react.vercel.app/)
- **Repository:** [pure-edge/northstar-dashboard-react](https://github.com/pure-edge/northstar-dashboard-react)
- **Stack:** React 19, TypeScript 6, Vite 8, Oxlint, and Playwright Test.

## Business Problem

Small store operators need a quick way to find products, spot stock that may need attention, and make routine catalog changes. This prototype demonstrates those workflows with sample inventory and order records; it does not represent a deployed store or claim actual customer or business results.

## Functional Requirements

- Summary cards show product count, pending sample orders, low-stock count, and estimated inventory retail value. Low stock means five units or fewer; the low-stock list is derived from the current inventory.
- Users can add, edit, delete, and reset products. Delete and reset use native browser confirmation dialogs.
- Search matches product names or SKUs without case sensitivity; stock filters, four sort choices, and five-item pagination work together. Changing search, filter, or sort returns the list to page one.
- Product forms validate required fields, name/SKU lengths, positive bounded prices, whole-number stock quantities, and case-insensitive SKU uniqueness. Empty inventory and no-match states are displayed.
- Inventory is persisted in browser `localStorage`. Persisted records are validated on load, and warnings distinguish invalid/unreadable saved data from changes that could not be written.
- The layout adapts to narrow screens with a horizontally scrollable inventory table. Dialog labels, product-specific row-action names, keyboard operation, focus restoration, and visible focus styles support accessibility.

## Architecture

The dashboard is a client-side React application, not a full-stack system:

- `src/App.tsx` composes the dashboard UI, keeps the active inventory and view controls in React state, handles product actions, and derives the visible table and metrics.
- `src/data/products.ts` defines the `Product` type and the sample inventory.
- `src/data/inventoryUtils.ts` contains pure functions for form validation, stock classification, search/filtering, sorting, pagination, and summary calculations.
- `src/data/inventoryStorage.ts` owns the localStorage key and read/write boundary. It validates saved records, keeps a valid empty array empty, and returns fallback inventory with a warning when saved data cannot be used.
- The app initializes React inventory state from the storage helper. UI actions create a new inventory array; derived utilities calculate the table and metrics from that state; the storage helper attempts to persist each inventory update.
- Order records are sample data defined in `src/App.tsx`; they are not fetched or updated through a service.

This version has **no backend API, server-side database, authentication, authorization, or external business-system integrations**.

## Key Technical Decisions

- Inventory rules are kept in pure utility functions instead of being mixed into table markup. This makes filtering, sorting, validation, and summary behavior independently testable.
- Both submitted form values and saved records are validated. Persisted inventories with malformed records or duplicate IDs/SKUs are rejected rather than partially trusted.
- The UI derives metrics and list results from the current inventory instead of separately maintaining potentially inconsistent copies.
- Storage failures are surfaced to the user. A failed write leaves the current session usable but warns that the change may be lost on refresh; the UI does not describe that write as successful.
- An explicitly saved `[]` is treated as an intentionally empty inventory, not as a request to restore sample products.

## Edge Cases and Error Handling

- **Malformed JSON or invalid saved records:** `loadInventory()` uses sample inventory and returns a warning. It does not silently replace the bad saved value at startup. Tests cover malformed JSON, an invalid product, duplicate IDs, and case-insensitive duplicate SKUs.
- **Empty saved inventory:** a valid `[]` remains empty after startup and reload.
- **Storage read failure:** sample inventory is available for the session with a warning that it was not saved. A later successful inventory write can persist the current state.
- **Storage write failure:** the current action is reflected in session state, with a warning that it could not be saved. Tests verify that a reload reads the previously saved state rather than implying the failed update persisted.
- **Empty results:** the table distinguishes an empty inventory from a search with no matching products. Pagination represents an empty result as one page and clamps requests beyond the final page; the UI resets to the first page when criteria change.
- **Reset:** the user must confirm before sample inventory replaces the current list. A failed reset write is reported as session-only and may revert after refresh.

## Testing

Install locked dependencies and run the project checks with:

```sh
npm ci
npm run build
npm run lint
npm run test:e2e
```

The Playwright suite uses Microsoft Edge and runs against a production build served by Vite Preview. It covers product workflows and validation, inventory utility functions, the combined search/filter/sort/pagination pipeline, storage recovery and persistence, reset behavior, responsive viewports, and keyboard/accessibility interactions. These checks provide regression coverage for the demonstrated flows; they are not exhaustive testing of browsers, assistive technologies, or production infrastructure.

## Demo and Screenshots

- **Live application:** [https://northstar-dashboard-react.vercel.app/](https://northstar-dashboard-react.vercel.app/)
- **GitHub repository:** [https://github.com/pure-edge/northstar-dashboard-react](https://github.com/pure-edge/northstar-dashboard-react)

### Desktop dashboard (1440 × 1000)

![Northstar dashboard at desktop size](screenshots/dashboard-desktop.png)

### Mobile dashboard (375 × 812)

![Northstar dashboard at mobile size](screenshots/dashboard-mobile.png)

### Add Product dialog

![Northstar dashboard with the Add Product dialog open](screenshots/dashboard-add-product-dialog.png)

## Limitations and Future Improvements

Inventory and orders are sample data; inventory changes are stored only in the current browser's `localStorage`. Data is not shared between users or devices and is not a shared database. There is no backend, database, authentication, or authorization. Consequently, server-side validation, concurrent update handling, and production operational concerns such as service monitoring are not implemented.

Reasonable next steps would be to add a backend API and database, repeat validation on the server, introduce authentication and authorization, define conflict handling for concurrent edits, add integration coverage around the API, and add production observability.

## Engineering Takeaway

This project demonstrates a typed React UI, separation of inventory rules into testable pure functions, explicit handling of browser-storage failure modes, and observable end-to-end regression tests. It intentionally keeps the scope at a frontend prototype rather than implying full-stack capabilities it does not have.
