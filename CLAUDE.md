# Admin Automation System — project context

A modular admin platform for an office: Giveaways, Grocery & Cleaning Inventory,
Generator Management, Attendance/Overtime/Leave, a Dashboard, Reports & Notifications,
and Profile/Settings. Each module is built **vertically** (model → API → UI → tests →
verification guide) so the app always works end to end.

This file is the always-loaded summary. **Before working on a module, read its file in
`docs/context/`**, plus the foundation file for the side you're touching.

## Stack

| | Frontend (`frontend/`) | Backend (`backend/`) |
|---|---|---|
| Language | Plain JS + JSX (no TypeScript), ES modules | Node 18+, ES modules (`"type": "module"`) |
| Core | React 19, Vite 8, react-router-dom 7, axios | Express **5**, Mongoose **9** (MongoDB) |
| UI | Tailwind 3 (custom tokens), lucide-react icons, recharts | — |
| Validation / auth | Plain `useState` forms | express-validator 7, JWT, bcryptjs |
| Other | — | multer (uploads), node-cron (jobs), nodemailer (email) |
| Tests | vitest + Testing Library (jsdom) | jest 30 + mongodb-memory-server + supertest |
| Lint | oxlint | — |

## Commands

```bash
# backend (http://localhost:5000, health: GET /api/v1/health)
cd backend && npm run dev     # nodemon
npm run seed                  # idempotent: permissions, roles, starter admin
npm test                      # jest, in-memory Mongo, --runInBand

# frontend (http://localhost:5173)
cd frontend && npm run dev
npm run build | npm run lint | npm test
```

- Seeded login: `admin@admin-automation.local` / `ChangeMe123!`.
- Backend env vars are read **only** in `backend/src/config/env.js` (template:
  `backend/.env.example`). Frontend: `VITE_API_BASE_URL` (default `http://localhost:5000/api/v1`).
- After adding permissions, re-run `npm run seed` (it only adds, safe to repeat).

## Module map

| # | Module | Status | Context file |
|---|---|---|---|
| 0 | Foundation (backend) | Done | [docs/context/backend-foundation.md](docs/context/backend-foundation.md) |
| 0 | Foundation (frontend, UI kit) | Done | [docs/context/frontend-foundation.md](docs/context/frontend-foundation.md) |
| 1 | Authentication & DB-driven RBAC | Done | [docs/context/auth-rbac.md](docs/context/auth-rbac.md) |
| 2 | Giveaways | Backend coded but **router not mounted**; frontend page exists | [docs/context/giveaways.md](docs/context/giveaways.md) |
| 3 | Grocery & Cleaning Inventory | Frontend + permissions only, **no backend** | [docs/context/inventory.md](docs/context/inventory.md) |
| 4 | Generator Management | Done (PR #7) | [docs/context/generator.md](docs/context/generator.md) |
| 5 | Attendance, Overtime, Leave, Staff | Done for planned scope | [docs/context/attendance.md](docs/context/attendance.md) |
| 6–8 | Dashboard · Reports/Alerts/Notifications · Profile/Settings | `ComingSoon` placeholders | [docs/context/upcoming-modules.md](docs/context/upcoming-modules.md) |

## Foundation rules (keep every module consistent)

### Backend
1. **Layering** — `models/` → `repositories/` (thin Mongoose calls, no business logic) →
   `services/` (all business rules; throw typed errors) → `controllers/` (wrapped in
   `asyncHandler`, pick fields explicitly from `req.body`, respond with `sendSuccess`) →
   `validators/` (express-validator arrays ending in `runValidation`) → `routes/`.
   File names: `<thing>Controller.js`, `<thing>Service.js`, `<thing>Repository.js`,
   `<thing>Validators.js`, `<thing>.routes.js`; export new models from `models/index.js`.
2. **Route order** — `router.use(authenticate)` then
   `requirePermission("x.y")` → validator → controller. Mount the router in
   `backend/src/routes/index.js`. Declare fixed sub-paths before `/:id`.
3. **Responses** — success `{ success: true, message, data, meta? }` via
   `utils/apiResponse.js`; errors `{ success: false, message, details }` via
   `errors/AppError.js` (`BadRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403,
   `NotFoundError` 404, `ConflictError` 409). New modules wrap data in a named key
   (`data: { leave }`) and paginate as `meta: { page, pageSize, totalItems, totalPages }`
   (default 20, max 100).
4. **RBAC is data, not code** — permissions are `resource.action` strings declared in
   `backend/src/constants/permissions.js` (catalog + default roles) and resolved from the
   database on every request. **Never** check role names (`role === "admin"`). Need a
   "see everyone vs own records" switch? Use `req.permissions.includes("x.approve")`.
5. **Config & constants** — env only via `config/env.js`; enums in `constants/` and shared by
   model + validator + service; day values normalized with `utils/dates.js` (`startOfDay`,
   midnight UTC). Express 5: `req.query` is read-only — no `.toInt()` on query chains,
   convert with `Number()` in the controller.
6. **Tests** — supertest against `src/app.js` with `tests/helpers/testAuth.js`
   (`ensureRbacSeeded`, `createUserWithRole`).

### Frontend
1. **Reuse the UI kit** in `src/components/common`, `modals/`, `tables/` (Button, Input, Select,
   DatePicker/DateTimePicker, Table, Modal, ConfirmDialog, FilterBar, Tabs, Pagination, Badge,
   StatCard, PageHeader, EmptyState/ErrorState, Loading). Never use a raw `<button>` or native date input.
2. **Styling** — Tailwind tokens only (`primary`, `ink`, `surface`, `border`, `status.*`,
   `text-page-title` etc.). Raw hex only in `src/config/theme.js` (charts/SVG). Status
   colours go through `Badge status="..."` → `theme.statusStyles`.
3. **API** — one named service object per module in `src/services/` built on
   `apiClient`, passing filters through `cleanParams()`, returning
   `{ items, pagination }` for lists. Errors shown with `utils/apiError.js` `apiErrorMessage`.
4. **Permissions** — `useAuth().hasPermission("x.y")` for buttons/tabs; routes gated by nesting
   `<Route element={<ProtectedRoute permission="x.y" />}>` in `src/routes/AppRoutes.jsx`
   (pages are `React.lazy`); sidebar items in `src/constants/navigation.js` with `permission`.
5. **Feedback** — inline `role="alert"` (error) / `role="status"` (success) banners; no toast
   library; **no `alert()`** in new code. Destructive actions go through `ConfirmDialog`.
6. **Forms & data** — controlled `useState` forms inside `Modal` with a `footer`; fetch in
   `useEffect`/`useCallback` with a cancelled flag or request key; reset page to 1 on filter change.
7. **Layout** — pages in `pages/<module>/<Name>Page.jsx`, module components in
   `components/<module>/`.

## Workflow conventions

- **Git** — PRs target `develop` (origin: `Nasreen245345/Admin-Automation-System`; contributors
  push from forks). Branches: `feature/<module>` or `AAS-<epic>/<Title-Case>`.
- **Commits** — `AAS-<ticket> <Short imperative summary>`, one Jira ticket per commit
  (e.g. `AAS-404 Balance cards and remaining days in the request form`).
- **Done = verified** — each story ends with "Test and write the verification guide":
  `docs/verification/AAS-<first>-<last>-<slug>.md` using the newer template (see
  `docs/verification/AAS-400-406-leave-quotas.md`), linked from `README.md`.
- When a module changes, update its `docs/context/<module>.md` and the status in `README.md`.

## Known inconsistencies — don't copy these into new code

- Giveaways/Inventory use a legacy page shape `meta: { total, page, totalPages }` with a `limit`
  param; Generator/Giveaway controllers return raw `data` and spread `req.body`.
- Giveaway repository uses `{ new: true }`; others use `{ returnDocument: "after" }`.
- Three frontend error helpers exist (`utils/apiError.js`, `utils/errorMessage.js`,
  `GeneratorForm.jsx` `extractErrorMessage`) — prefer `apiErrorMessage`.
- Backend tests cover only Generator/Reports; auth, RBAC, attendance, leave, overtime and users have none.
- `README.md` "Not built yet / no other modules" lines predate the Generator merge.
