# Module 3 — Grocery & Cleaning Inventory

**Status:** frontend + permissions only (author: Nasreen, branch `feature/giveaways-inventory`; AAS-307).
**There is no backend** — no model, repository, service, controller, validator or route. The page
calls `/inventory/*` and gets 404s. Build the backend with the checklist in `backend-foundation.md`;
the frontend below defines the contract it currently expects.

## Permissions (already seeded, `constants/permissions.js`)

`inventory.read`, `inventory.create`, `inventory.update`, `inventory.delete`, `inventory.purchase`.
Manager: all but delete. Staff: read.

## Frontend (exists)

| Piece | File |
|---|---|
| Page | `pages/inventory/InventoryPage.jsx` (grocery/cleaning type switch, stat cards, `FilterBar`, `Table`, modals) |
| Forms | `components/forms/InventoryItemForm.jsx`, `PurchaseForm.jsx`, `ConsumeForm.jsx` |
| Service | `services/inventoryService.js` |
| Options | `constants/inventoryOptions.js` — types `grocery`/`cleaning`; units pcs/kg/g/litre/ml/pack/box/bottle; payment status Paid/Pending |
| Routes | `/inventory`, `/inventory/new` — **no permission gate**; sidebar "Grocery & Cleaning" ungated |

UI permissions used: `inventory.create/update/delete/purchase`. Mutation errors use `alert()`.

### API contract the service expects (legacy shape)

| Function | Call | Reads |
|---|---|---|
| `dashboard(type)` | `GET /inventory/dashboard?type=` | `r.data.data` |
| `listItems(params)` | `GET /inventory` | `{ items: r.data.data, meta: r.data.meta }` |
| `getItem(id)` | `GET /inventory/:id` | `r.data.data` |
| `createItem` / `updateItem` | `POST /inventory` / `PUT /inventory/:id` | `r.data.data` |
| `deactivateItem(id)` | `DELETE /inventory/:id` | |
| `recordPurchase` / `listPurchases` | `POST` / `GET /inventory/purchases` | `{ purchases, meta }` |
| `consume(id, payload)` | `POST /inventory/:id/consume` | `r.data.data` |

### Fields the forms send

- **Item**: `itemName`, `type` (grocery/cleaning), `unit`, `unitCost`, `vendor`, `openingStock`, `minimumStock`.
- **Purchase**: item, `quantity`, `purchaseAmount`, `purchaseDate`, `vendor`, `invoiceNumber`, `paymentStatus`.
- **Consume**: `quantity`, `remarks`.

## Suggested build (keep foundation consistent)

1. Model the same way as Giveaways: `InventoryItem` (with `currentStock`, `minimumStock`, `isActive`,
   virtual stock status), `InventoryPurchase`, and a stock ledger (`InventoryTransaction`: purchase / consume / adjust,
   `balanceAfter`, `performedBy`). Stock changes only through purchase/consume/adjust; consuming beyond stock → 400.
2. Enums in `constants/inventory.js`; routes `/inventory` with fixed paths (`/dashboard`, `/purchases`) before `/:id`.
3. Use the **foundation** response shape (named data keys, `{ page, pageSize, totalItems, totalPages }`) and update
   `inventoryService.js` to `{ items, pagination }` + `cleanParams` at the same time; `PATCH` vs `PUT` — pick one and update the service.
4. Low-stock alerts can reuse `jobs/scheduler.js` + `utils/mailer.js` + `rbacRepository.findUsersWithPermission`.
5. Frontend clean-up: replace `alert()`, gate route/sidebar with `inventory.read`, move forms to `components/inventory/`.
6. Tests + verification guide; consider a shared stock-ledger helper with Giveaways.
