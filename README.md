# Admin Automation System

A modular admin automation platform (Giveaways, Grocery & Cleaning Inventory,
Generator Management, Attendance & Overtime, Reports, Notifications) built
module-by-module, end-to-end (frontend → API → database → tested feature)
per module.

## Status

**Phase 0 — Project Foundation: complete.**
**Module 1 — Authentication & Database-Driven RBAC: complete.**
**Module 5 — Attendance, Overtime & Leave Management: complete for the planned scope (Sprints 1–2); see "Not built yet" below.**

- `frontend/` — React + Vite + Tailwind app shell: design system/tokens,
  reusable component library, sidebar/header layout, routing, Axios API
  client, plus real Login/Register pages, `AuthContext` (JWT session,
  `hasPermission(...)`), and `ProtectedRoute`. Builds cleanly (`npm run build`).
- `backend/` — Express + Mongoose API: config, error handling, health check,
  security middleware, logging, **plus** the full RBAC data model
  (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`),
  `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, a database-driven
  `requirePermission(...)` authorization middleware, RBAC admin endpoints
  under `/rbac`, and an idempotent seeder (`npm run seed`) for default
  roles/permissions and a starter admin account.

Verified in this environment: all files pass syntax checks, the Express app
boots and every auth/RBAC route was exercised over real HTTP (validation
errors, 401s on missing/invalid tokens, correct error envelopes), and
password hashing / JWT sign-verify were unit-tested directly. Full
register → login → permission-gated request flow needs a live MongoDB to
verify end-to-end, which isn't reachable from this sandbox — connect your
own `MONGO_URI` and run `npm run seed` then `npm run dev` to complete that
verification.

### Module 5 — Attendance, Overtime & Leave Management

Employees clock in and out themselves, overtime is worked out automatically
and approved by a manager, and leave is requested and approved the same way.
Built vertically (model → repository → service → controller/validators →
routes, then service → components → page → route on the frontend), following
the Module 1 layering.

**Backend** (`/api/v1`, all routes require a signed-in user):

| Area | Endpoints | Permissions |
|---|---|---|
| Attendance | `POST /attendance/clock-in`, `POST /attendance/clock-out`, `GET /attendance/me/today` | `attendance.create`, `attendance.read` |
| | `GET /attendance` (filters, paging) | `attendance.read` (own records); `attendance.update` sees everyone |
| | `GET /attendance/employees` (for the Team filter), `PATCH /attendance/:id` (manager correction) | `attendance.update` |
| Overtime | `GET /overtime` (filters, paging) | `overtime.read`; `overtime.approve` sees everyone |
| | `PATCH /overtime/:id/review` (approve or reject) | `overtime.approve` |
| Leave | `POST /leave`, `GET /leave` (filters, paging) | `leave.create`, `leave.read`; approvers see everyone |
| | `PATCH /leave/:id/review` | `leave.approve` to approve, `leave.reject` to reject |
| Staff | `GET /users` (search, status filter, paging), `POST /users` (create a login) | `users.manage` |
| | `PATCH /users/:id` (edit), `PATCH /users/:id/status` (activate/deactivate) | `users.manage` |
| | `GET /users/options` (lightweight employee list for the Team Overtime/Leave filters) | `overtime.approve` or `leave.approve` |
| | `PUT /users/leave-allocation/all` (bulk-set casual/sick/annual days on every active account) | `users.manage` |
| Leave balance | `GET /leave/balance` (own balance by default; `?userId=` for reviewers, `?year=`) | `leave.read` |

Data model: `Attendance` (one record per user per day, enforced by a unique
index), `OvertimeRequest` (one per attendance record) and `LeaveRequest`
(`casual`, `sick`, `annual`, `unpaid`).

Rules the API enforces:
- Worked time is computed on clock-out; under 4 hours is a **half-day**.
- The shift starts at clock-in and lasts as long as the overtime threshold (10 hours).
  Clocking out before that records an **early departure** (`earlyDepartureMinutes`, 0 for
  a full shift). It is recalculated when a manager corrects the times. Records from before
  this was added have no value and show "—".
- When worked time passes the daily threshold, a **pending overtime request** for the
  excess is created automatically. The threshold defaults to 10 hours and is set
  with `OVERTIME_THRESHOLD_MINUTES` (600 by default).
- A request is decided **once** (a second decision returns 409), and nobody can
  review **their own** overtime or leave request.
- Leave cannot overlap the same person's pending or approved leave. A rejected
  request frees its days again.
- Approving and rejecting leave are separate permissions.
- An admin (`users.manage`) creates a staff login with a name, email, a unique
  **Employee ID** they type themselves, and a temporary password; the account gets the
  `staff` role by default. Employee ID is case-insensitive (`emp-001` and `EMP-001`
  collide) and duplicate emails/IDs return 409.
- **Deactivating** a staff member blocks new logins immediately, and any token they
  already hold stops working on its very next request — there is no separate
  revocation list; `authenticate` re-checks `isActive` on every call. Their attendance,
  overtime and leave history is kept, and the account can be re-activated. An admin
  cannot deactivate their own account.
- Each user has a **yearly leave allocation** per type (`casual`, `sick`, `annual` —
  unpaid has none and is unlimited), set individually via `PATCH /users/:id` or for
  every active account at once via `PUT /users/leave-allocation/all`. Requesting leave
  checks the pending-plus-approved days already used against the allocation for **each**
  calendar year the request touches independently, so a request spanning New Year's is
  checked against both years on their own terms, and refuses with a 400 naming the
  year and days left if it would go over.

**Frontend:**
- `/attendance` — clock widget, own history, and (for `attendance.update`) a Team
  tab with filters and a manager edit dialog.
- `/attendance/overtime` — own overtime history, plus for `overtime.approve` a
  **Pending approvals** / **Team** tab switcher: Pending is the decision queue,
  Team is everyone's requests filterable by employee/status/date, with inline
  Approve/Reject either way.
- `/attendance/leave` — three balance cards (Casual/Sick/Annual: allocated, used,
  pending, remaining), Request leave form (shows the chosen type's remaining days
  and disables submit over the balance — the server still enforces it authoritatively),
  own leave history, plus the same Pending approvals / Team tab switcher for anyone
  who can approve or reject leave (Team adds a leave-type filter).
- `/attendance/staff` — admin-only staff directory: search, filter by status, add a
  staff login (Employee ID + temporary password), edit details, activate/deactivate,
  and **Assign leaves to all**: set casual/sick/annual days for every active account
  at once, either filling only accounts with no allocation yet or overwriting everyone.
- A single Attendance entry in the sidebar, and a page switcher at the top of the
  four pages (Attendance, Overtime, Leave, Staff), each link shown only to users who
  hold that page's permission.
- **Admin doesn't see its own self-service sections**: "My attendance", "My overtime",
  "My leave requests" and the Request leave button are hidden for the `admin` role
  (`frontend/src/config/featureVisibility.js`). This is a frontend-only presentation
  switch — the backend permissions are unchanged — and is meant to move into the
  database once the Settings module lets an admin toggle feature visibility per role.
- Every date and date-time field (Request leave, the Team filters, Edit attendance's
  Clock in/out) is a custom popover calendar (`components/common/DatePicker.jsx`,
  `DateTimePicker.jsx`) instead of the native browser picker: click opens it, a day
  only stages until **OK** commits it, Cancel/Escape/clicking outside discard it.
  Full keyboard support (arrow keys, Home/End, PageUp/PageDown, Shift for year, Enter
  to commit), a trapped Tab order, and ARIA grid semantics; tested down to a 375px
  mobile width.

**Verified** over real HTTP and in real Chrome against a live MongoDB, with test
data removed afterwards. Each guide can be repeated by hand:
- [`docs/verification/AAS-91-clock-in-out.md`](docs/verification/AAS-91-clock-in-out.md)
- [`docs/verification/AAS-96-attendance-list-and-edit.md`](docs/verification/AAS-96-attendance-list-and-edit.md)
- [`docs/verification/early-departure.md`](docs/verification/early-departure.md)
- [`docs/verification/AAS-280-overtime-auto-trigger-and-approval.md`](docs/verification/AAS-280-overtime-auto-trigger-and-approval.md)
- [`docs/verification/AAS-290-leave-request-and-approval.md`](docs/verification/AAS-290-leave-request-and-approval.md)
- [`docs/verification/AAS-302-end-to-end-attendance-overtime-leave.md`](docs/verification/AAS-302-end-to-end-attendance-overtime-leave.md) — full staff and manager walkthrough
- [`docs/verification/AAS-383-388-staff-management.md`](docs/verification/AAS-383-388-staff-management.md) — Employee ID, staff create/edit/search/filter, deactivation
- [`docs/verification/AAS-390-392-hide-self-service-for-admin.md`](docs/verification/AAS-390-392-hide-self-service-for-admin.md) — self-service sections hidden for admin, unchanged for manager/staff
- [`docs/verification/AAS-394-398-team-overtime-leave.md`](docs/verification/AAS-394-398-team-overtime-leave.md) — Team Overtime and Team Leave tabs, filters, and review from the Team view
- [`docs/verification/AAS-400-406-leave-quotas.md`](docs/verification/AAS-400-406-leave-quotas.md) — leave balances, quota enforcement, assign-to-all, full staff→approve→balance loop
- [`docs/verification/AAS-408-412-date-time-picker.md`](docs/verification/AAS-408-412-date-time-picker.md) — the custom date/date-time picker: mouse, keyboard, ARIA, and mobile

**After pulling this module, run `npm run seed` in `backend`.** It adds
`overtime.read` to the staff role so staff can see their own overtime. It only adds
permissions and is safe to repeat. Until then, staff are sent to "Unauthorized"
when they open the Overtime page.

**Not built yet** (in the requirements, outside the planned scope):
- Late-arrival tracking. Skipped on purpose: the shift starts at clock-in, so there is no
  fixed start time to be late against.
- Attendance statuses for Leave, Holiday and Weekend, and a holiday calendar.
  Approved leave does not yet create attendance records.
- Setting an individual's leave allocation from the **Add/edit staff** form. The backend
  fully supports it (`PATCH /users/:id` with a `leaveAllocation` object); only **Assign
  leaves to all** is wired into the UI, not a per-person field on that form.
- Reports (daily and monthly attendance, monthly overtime, leave, individual
  employee, attendance percentage) and the overtime sheet export.

No other business modules (giveaways, inventory, generator, reports) are
implemented on this branch yet.

### Default seeded roles

Running `npm run seed` (after setting `MONGO_URI`) creates:
- **admin** — every permission
- **manager** — inventory/generator/giveaways management + attendance/leave/overtime approval
- **staff** — read-only + submit leave/attendance, and view their own overtime (the default role for new registrations)
- A starter admin login: `admin@admin-automation.local` / `ChangeMe123!` — change this immediately.

Roles and permissions live entirely in the database — there is no
`if (role === "admin")` anywhere in the codebase. Adding a role or granting
a permission is a data change via the `/rbac` endpoints, not a code change.

## Prerequisites

- Node.js 18+
- A MongoDB connection string (local MongoDB or a free MongoDB Atlas
  cluster). The backend cannot start without one.

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173.

## Running the backend

```bash
cd backend
npm install
cp .env.example .env   # then set MONGO_URI to your own MongoDB connection string
npm run dev
```

Runs on http://localhost:5000. Health check:
`GET http://localhost:5000/api/v1/health`

Optional setting: `OVERTIME_THRESHOLD_MINUTES` (default 600, i.e. 10 hours) is the
worked time per day after which the excess counts as overtime. Set it to 1 to
try overtime without working a full day.

## Project structure

```text
admin-automation-system/
├── frontend/   React + Vite + Tailwind UI
├── backend/    Express + Mongoose API
└── docs/       verification guides (docs/verification)
```

See `frontend/src` and `backend/src` for the internal folder layout — both
follow the structure specified in the project plan (components/pages/mock
for frontend; controllers/services/repositories/models/routes/middleware for
backend).

## Development approach

Each module (starting with Module 1 — Authentication & RBAC) is built
vertically: UI → API → database → business logic → verification, so the
app is always in a working, demonstrable state, rather than building the
entire frontend or entire backend in isolation.

Authorization throughout the system is database-driven RBAC
(`users → user_roles → roles → role_permissions → permissions`) — never
hardcoded `role === "admin"` checks.
