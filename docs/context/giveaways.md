# Module 2 — Giveaways

**Status:** partially built (author: Nasreen, branch `feature/giveaways-inventory`, PR #1).
The backend is fully coded but **unreachable**: `routes/giveaway.routes.js` is not imported or mounted
in `backend/src/routes/index.js`, so every `/giveaways` call from the frontend returns 404.
It also predates several foundation conventions — align it when picking the module up.

## Backend (exists, not mounted)

| Layer | File |
|---|---|
| Models | `models/GiveawayItem.js`, `models/GiveawayIssue.js`, `models/GiveawayInventoryTransaction.js` |
| Repository | `repositories/giveawayRepository.js` (uses `{ new: true }`) |
| Service | `services/giveawayService.js` |
| Controller | `controllers/giveawayController.js` (returns raw `data`, spreads `req.body`) |
| Validators | `validators/giveawayValidators.js` |
| Routes | `routes/giveaway.routes.js` — **mount as `router.use("/giveaways", giveawayRoutes)`** |

### Models

- **GiveawayItem** — `itemName`, `sku` (unique, uppercased), `category`, `unitPrice`, `vendor`,
  `openingStock`, `currentStock`, `minimumStock`, `isActive`, virtual `status`
  (inStock / lowStock / outOfStock / inactive).
- **GiveawayInventoryTransaction** — stock ledger: `item`, `type` (stock-in / stock-out / issue), `quantity`,
  `balanceAfter`, `reference`, `remarks`, `performedBy` (User).
- **GiveawayIssue** — `item`, `date`, `employeeName` (free text, **not** a User ref), `department`,
  `eventName`, `quantity`, `approvedBy` (free text), `remarks`.

### Endpoints (as written)

| Method & path | Permission |
|---|---|
| `GET /giveaways/dashboard` | `giveaways.read` |
| `GET /giveaways/issues`, `POST /giveaways/issues` | `giveaways.read`, `giveaways.issue` |
| `GET /giveaways` `?search&category&status&page&limit` | `giveaways.read` |
| `POST /giveaways` | `giveaways.create` |
| `GET /giveaways/:id`, `PUT /giveaways/:id` | `giveaways.read`, `giveaways.update` |
| `DELETE /giveaways/:id` (soft-deactivate) | `giveaways.delete` |
| `POST /giveaways/:id/stock-in`, `/stock-out` | `giveaways.update` |

Rules: stock can't be edited via PUT — only stock-in / stock-out / issue change it, each writing a ledger row;
issuing more than `currentStock` → 400. Pagination returns `meta: { total, page, totalPages }` with `limit`.

## Frontend

| Piece | File |
|---|---|
| Page | `pages/giveaways/GiveawaysPage.jsx` (stat cards, `FilterBar`, `Table`, modals) |
| Forms | `components/forms/GiveawayItemForm.jsx`, `GiveawayIssueForm.jsx`, `StockAdjustForm.jsx` |
| Service | `services/giveawayService.js` (lists → `{ items, meta }` / `{ issues, meta }`; no `cleanParams`) |
| Options | `constants/giveawayOptions.js` (categories, departments) |
| Routes | `/giveaways`, `/giveaways/new` — **no permission gate**; sidebar item ungated |

UI permissions used: `giveaways.create/update/delete/issue`. Mutation errors use `alert()`.

## To bring it in line with the foundation

1. Mount the router in `routes/index.js`; smoke-test every endpoint.
2. Switch pagination to `{ page, pageSize, totalItems, totalPages }` + `pageSize` param; wrap data in named keys
   (`data: { items }`, `data: { item }`, `data: { issues }`); pick fields explicitly in the controller;
   use `{ returnDocument: "after" }`.
3. Consider `GiveawayIssue.employee` as a User ref (use `GET /users/options`) instead of free text.
4. Frontend: service → `{ items, pagination }` + `cleanParams`; replace `alert()` with inline `role="alert"`
   banners (`apiErrorMessage`); add `ProtectedRoute permission="giveaways.read"` and the sidebar `permission`;
   move forms to `components/giveaways/`; add status keys to `theme.statusStyles` if missing.
5. Add backend tests (`tests/giveaway.routes.test.js`) and a verification guide.
