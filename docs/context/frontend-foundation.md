# Frontend foundation

React 19 + Vite 8 + Tailwind 3, plain JS/JSX. Everything lives under `frontend/src`.
Read this before adding or changing anything on the frontend. Per-module details are in
the sibling files of this folder.

## Folder layout

```
frontend/
├── index.html              inline .aas-bootloader splash (shown before React mounts)
├── tailwind.config.js      design tokens (below)
├── vite.config.js          react plugin, port 5173, vitest (jsdom, src/test/setup.js); no proxy, no aliases
├── .oxlintrc.json          react + oxc plugins
└── src/
    ├── main.jsx / App.jsx  BrowserRouter > AuthProvider > AppRoutes
    ├── index.css           Inter font, base colours, scrollbar, focus ring
    ├── assets/
    ├── components/
    │   ├── common/         the UI kit (see below) + __tests__/
    │   ├── modals/         Modal, ConfirmDialog
    │   ├── tables/         Table
    │   ├── layout/         AppLayout, Header, Sidebar
    │   ├── forms/          giveaway + inventory forms (legacy location)
    │   ├── attendance/ leave/ overtime/ staff/   module components
    ├── config/             theme.js, featureVisibility.js, attendanceCalendar.js
    ├── constants/          navigation.js, giveawayOptions.js, inventoryOptions.js
    ├── context/AuthContext.jsx
    ├── pages/<module>/     route-level pages (+ __tests__ for generator)
    ├── routes/             AppRoutes.jsx, ProtectedRoute.jsx
    ├── services/           apiClient.js + one service per module
    ├── test/               setup.js (jest-dom), smoke.test.jsx
    └── utils/              formatting + error helpers
```

There is no `hooks/` folder, no state library, no form library, no toast library. All imports are relative.

## Design tokens (`tailwind.config.js`)

| Token | Values |
|---|---|
| `primary` | DEFAULT `#2563EB`, `dark` `#1E3A8A`, `light` `#3B82F6`, `50` `#EFF6FF` |
| `surface` | DEFAULT white, `subtle` `#F8FAFC` (page bg), `blue` `#EFF6FF` |
| `ink` | DEFAULT `#0F172A`, `secondary` `#475569`, `muted` `#64748B` |
| `border` | `#E2E8F0` |
| `status` | `success` / `warning` / `error` / `info` + matching `*Bg` |
| fontSize | `page-title`, `section-heading`, `card-heading`, `body`, `helper` |
| radius / shadow | `rounded` 8px, `rounded-card` 12px, `rounded-pill`; `shadow-card`, `shadow-elevated` |

`src/config/theme.js` holds the same colours as raw hex for Recharts/SVG, a `chartPalette`, and
`statusStyles` — the map from a status key (`present`, `approved`, `pending`, `rejected`,
`operational`, `faulty`, `overdue`, `scheduled`, `completed`, …) to `{ label, color, bg }`.
**Add new status keys there** and render them with `<Badge status="key" />`.

## Routing (`src/routes/AppRoutes.jsx`)

- Public, eager: `/login`, `/register`, `/unauthorized`. `/` → `/dashboard`. `*` → `NotFoundPage`.
- Everything else: `<ProtectedRoute>` → `<AppLayout>`; pages are `React.lazy` inside one
  `<Suspense fallback={<PageLoader />}>`.
- Permission gate = nest a route:
  ```jsx
  <Route element={<ProtectedRoute permission="leave.read" />}>
    <Route path="/attendance/leave" element={<LeavePage />} />
  </Route>
  ```
- `ProtectedRoute`: loading → `PageLoader`; signed out → `/login` with `state.from`; missing
  permission → `/unauthorized`. UX only — the backend re-checks every request.

| Path | Page | Gate |
|---|---|---|
| `/dashboard` | `pages/dashboard/DashboardPage` (placeholder) | — |
| `/giveaways`, `/giveaways/new` | `pages/giveaways/GiveawaysPage` | — |
| `/inventory`, `/inventory/new` | `pages/inventory/InventoryPage` | — |
| `/generator` (+ `logs`, `maintenance`, `reports`) | `pages/generator/GeneratorLayout` + children | `reports` → `reports.read` |
| `/attendance` | `pages/attendance/AttendancePage` | `attendance.read` |
| `/attendance/overtime` | `pages/overtime/OvertimePage` | `overtime.read` |
| `/attendance/leave` | `pages/leave/LeavePage` | `leave.read` |
| `/attendance/staff` | `pages/attendance/StaffPage` | `users.manage` |
| `/reports`, `/notifications`, `/profile`, `/settings` | `ComingSoon` placeholders | — |

## Auth (`src/context/AuthContext.jsx`)

`useAuth()` → `{ user, roles, permissions, isAuthenticated, loading, authError, login, register, logout, hasPermission }`.
- Token in `localStorage["aas_token"]`; on mount calls `GET /auth/me` to rebuild the session.
- `login`/`register` return `{ success }` or `{ success: false, message, details? }`.
- `logout()` clears locally (no API call).
- **Gate UI with `hasPermission("x.y")`, never with `roles`.** Only exception:
  `config/featureVisibility.js` (`useSelfServiceVisible`, presentation-only).

## API layer

- `services/apiClient.js`: one axios instance, `baseURL = VITE_API_BASE_URL || http://localhost:5000/api/v1`,
  adds `Authorization: Bearer <aas_token>`; on 401 removes the token (no redirect, no normalization).
- Service pattern (model: `services/leaveService.js`):
  ```js
  import apiClient from "./apiClient";
  import { cleanParams } from "../utils/cleanParams";
  export const thingService = {
    // Resolves to { items, pagination } — pagination is { page, pageSize, totalItems, totalPages }.
    list: (params) => apiClient.get("/things", { params: cleanParams(params) })
      .then((r) => ({ items: r.data.data.things, pagination: r.data.meta })),
    create: (payload) => apiClient.post("/things", payload).then((r) => r.data.data.thing),
  };
  ```
- File uploads: see `generatorService.js` (FormData, unset `Content-Type`; downloads as blob).
- Errors: `utils/apiError.js` `apiErrorMessage(err, fallback)` (joins `details[].message`, then
  `message`). `utils/errorMessage.js` `describeError(err)` gives generic per-status text (used by generator reports).

## UI kit

| Component | Key props / notes |
|---|---|
| `common/Button` | `variant` primary/secondary/ghost/danger/link, `size` sm/md/lg, `icon` (lucide), `iconPosition`, `loading`; default `type="button"` |
| `common/Input` | forwardRef; `label`, `id`/`name`, `error`, `helperText`, `required`, `icon`, `trailing` (right slot, e.g. show-password) |
| `common/Select` | Input props + `options=[{ value, label }]`, `placeholder` |
| `common/DatePicker` | value `"YYYY-MM-DD"`; `min`, `max`, `clearable`, `error`; popover with OK/Cancel, full keyboard + ARIA; shows `DD/MM/YYYY`; exports date helpers (`toDateStr`, `parseDateStr`, `buildMonthGrid`, …) |
| `common/DateTimePicker` | value `"YYYY-MM-DDTHH:mm"` |
| `common/Badge` | `status` key from `theme.statusStyles`, or `color`/`bg`/`children`; `dot` |
| `common/Card`, `PageHeader` | `PageHeader`: `title`, `description`, `action` |
| `common/FilterBar` | `search`, `onSearchChange`, `filters` (nodes), `onReset`, `actions` |
| `common/SearchInput`, `Pagination` | `Pagination`: `page` (1-based), `totalPages`, `totalItems`, `pageSize`, `onPageChange` |
| `common/Tabs` | controlled `tabs=[{ id, label }]`, `value`, `onChange`; ARIA + arrow keys |
| `common/StatCard` | `label`, `value`, `icon`, `trend`, `iconColor`, `iconBg` |
| `common/ActionMenu` | row ⋮ menu `items=[{ icon, label, onClick, danger }]` |
| `common/EmptyState`, `ErrorState` | `ErrorState`: `title`, `description`, `onRetry` |
| `common/Loading` | `LoadingSpinner`, `Skeleton`, `CardSkeleton`, `TableSkeleton` |
| `common/PageLoader`, `LogoLoader`, `FolioLogo` | splash / animated welcome after login |
| `common/ComingSoon` | placeholder page (`title`, `moduleLabel`) |
| `modals/Modal` | portal; `open`, `onClose`, `title`, `description`, `size` sm–xl, `footer`; Esc closes |
| `modals/ConfirmDialog` | `open`, `onClose`, `onConfirm`, `title`, `description`, `confirmLabel`, `variant`, `loading`, `error` — use for every destructive action |
| `tables/Table` | `columns=[{ key, header, render?, width? }]`, `data`, `keyField="_id"`, `loading`, `error`, `onRetry`, `empty*`, `pagination` — renders skeleton/error/empty/pager itself |

Layout: `AppLayout` = `Sidebar` + `Header` + `<Outlet/>`. Sidebar renders
`constants/navigation.js` `navSections` (`{ label, to, icon, permission?, end? }`) and hides items
the user lacks permission for. `attendanceNav` drives the Attendance page switcher.
Header: mobile menu, bell → `/notifications` (dot is static), profile menu (Profile, Settings, Log out).

## Page patterns

- **Data fetching**: `useEffect` with a `cancelled` flag or a `useCallback load()`; re-fetch via a
  `refreshKey` counter; attendance-family tables use a request-key pattern
  (`loading = result.key !== requestKey`, see `pages/attendance/StaffPage.jsx`). Reset page to 1 on filter change.
- **States**: pass `loading/error/onRetry/empty*` to `Table`; otherwise `CardSkeleton`/`ErrorState`.
- **Forms**: controlled `useState`, local validation, `Input`/`Select`/`DatePicker` in a `Modal`
  with a `footer`; show field errors from `details[].field` after a submit attempt.
- **Feedback**: inline red `role="alert"` box for errors, green `role="status"` banner for
  success (Leave, Staff pages). No `alert()`.
- **Permissions**: `const canEdit = hasPermission("thing.update")` → conditional render; filter tab arrays by permission.
- **URL state**: tab/view in the query string (`?tab=team`, `?view=team`) where useful.
- **Tests**: vitest + Testing Library, `vi.mock` the service and `useAuth`
  (model: `pages/generator/__tests__/GeneratorPage.test.jsx`).

## Utils

`cleanParams` (drop empty filters) · `formatDate` (`formatDate`, `formatDateNumeric`, `todayDateValue`) ·
`formatNumber` · `attendanceFormat` (`formatTime`, `formatDuration`, UTC date) · `leaveFormat`
(`leaveTypeOptions`, `inclusiveDays`) · `fuelFigures` (mirror of backend `computeFuelFigures` — keep in sync) ·
`apiError` · `errorMessage`.

## New frontend page checklist

1. Service → `services/<thing>Service.js` (pattern above).
2. Status colours → `config/theme.js` `statusStyles`; option lists → `constants/<thing>Options.js`.
3. Components → `components/<module>/` (tables, dialogs, forms).
4. Page → `pages/<module>/<Name>Page.jsx` using `PageHeader`, `FilterBar`, `Table`, `Modal`, `ConfirmDialog`.
5. Route → lazy import in `routes/AppRoutes.jsx`, nested in `ProtectedRoute permission="..."`.
6. Nav → `constants/navigation.js` with `permission`.
7. Tests → `__tests__/` next to the page; run `npm run lint`, `npm test`, `npm run build`.
