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

Data model: `Attendance` (one record per user per day, enforced by a unique
index), `OvertimeRequest` (one per attendance record) and `LeaveRequest`
(`casual`, `sick`, `annual`, `unpaid`).

Rules the API enforces:
- Worked time is computed on clock-out; under 4 hours is a **half-day**.
- When worked time passes the daily threshold, a **pending overtime request** for the
  excess is created automatically. The threshold defaults to 10 hours and is set
  with `OVERTIME_THRESHOLD_MINUTES` (600 by default).
- A request is decided **once** (a second decision returns 409), and nobody can
  review **their own** overtime or leave request.
- Leave cannot overlap the same person's pending or approved leave. A rejected
  request frees its days again.
- Approving and rejecting leave are separate permissions.

**Frontend:**
- `/attendance` — clock widget, own history, and (for `attendance.update`) a Team
  tab with filters and a manager edit dialog.
- `/attendance/overtime` — own overtime history, plus Pending approvals with
  Approve/Reject for `overtime.approve`.
- `/attendance/leave` — Request leave form, own leave history, plus Pending
  approvals for users who can approve or reject leave.
- A single Attendance entry in the sidebar, and a page switcher at the top of the
  three pages (Attendance, Overtime, Leave), each link shown only to users who hold
  that page's permission.

**Verified** over real HTTP and in real Chrome against a live MongoDB, with test
data removed afterwards. Each guide can be repeated by hand:
- [`docs/verification/AAS-91-clock-in-out.md`](docs/verification/AAS-91-clock-in-out.md)
- [`docs/verification/AAS-96-attendance-list-and-edit.md`](docs/verification/AAS-96-attendance-list-and-edit.md)
- [`docs/verification/AAS-280-overtime-auto-trigger-and-approval.md`](docs/verification/AAS-280-overtime-auto-trigger-and-approval.md)
- [`docs/verification/AAS-290-leave-request-and-approval.md`](docs/verification/AAS-290-leave-request-and-approval.md)
- [`docs/verification/AAS-302-end-to-end-attendance-overtime-leave.md`](docs/verification/AAS-302-end-to-end-attendance-overtime-leave.md) — full staff and manager walkthrough

**After pulling this module, run `npm run seed` in `backend`.** It adds
`overtime.read` to the staff role so staff can see their own overtime. It only adds
permissions and is safe to repeat. Until then, staff are sent to "Unauthorized"
when they open the Overtime page.

**Not built yet** (in the requirements, outside the planned scope):
- Late-arrival and early-departure tracking (needs shift start and end times).
- Attendance statuses for Leave, Holiday and Weekend, and a holiday calendar.
  Approved leave does not yet create attendance records.
- An Employee ID field on users.
- Leave balances per leave type.
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
