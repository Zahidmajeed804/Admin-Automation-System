# Modules 6–8 — Dashboard, Reports & Notifications, Profile & Settings

**Status:** not started. Each route renders `components/common/ComingSoon.jsx`. This file lists what
already exists that these modules should build on, so they stay consistent with the foundation.

## Module 6 — Centralized Dashboard

- Placeholder: `pages/dashboard/DashboardPage.jsx` (route `/dashboard`, the post-login landing page; ungated).
  A monthly overtime/attendance section was added in AAS-462 and then taken back out (the page is Coming Soon
  again); when the dashboard is built, `GET /attendance/summary` and the `components/attendance/summary/`
  pieces (`useMonthlySummary`, `MonthlySummaryStats`, `OvertimeShareChart`) can be reused for it.
- Permission seeded: `dashboard.read` (admin, manager, staff).
- No backend yet. Suggested: `routes/dashboard.routes.js` → `GET /dashboard` gated by `dashboard.read`, with a
  `dashboardService` that composes **existing repositories** (attendance today, pending overtime/leave counts,
  generator alerts via `computeAlertStatus`, low stock from giveaways/inventory) and returns only the sections
  the caller has permissions for (`req.permissions`).
- Frontend kit: `StatCard`, `Card`, `Badge`, recharts with `config/theme.js` `chartPalette`.

## Module 7 — Reports, Alerts & Notifications

- Placeholders: `pages/reports/ReportsPage.jsx` (`/reports`), `pages/notifications/NotificationsPage.jsx` (`/notifications`).
- Permission seeded: `reports.read`.
- **Existing reports** live inside Generator: `/api/v1/generator/reports/*` (`services/reportService.js`,
  `repositories/reportRepository.js`, `validators/reportValidators.js`) and `pages/generator/GeneratorReport*.jsx`.
  Reuse `resolveMonthRange` / `resolveDateRange` / `resolveYearRange` and the report panel pattern
  (`FilterBar` + `StatCard` + `Table` + lazy recharts).
- Done in Module 5 (AAS-457): monthly overtime + attendance % summary (`/attendance/summary`). Still outstanding:
  daily attendance, leave and individual-employee reports, and the overtime sheet export (no export/CSV helper exists yet).
- **Notifications today** = only generator maintenance emails: `jobs/maintenanceReminderJob.js`,
  `jobs/scheduler.js`, `utils/mailer.js`, `utils/emailTemplates/`, `services/notificationRecipients.js`.
  No in-app notification model. The Header bell (`components/layout/Header.jsx`) has a hardcoded red dot.
- Suggested: a `Notification` model + `/notifications` endpoints, created by services (overtime/leave review,
  maintenance due, low stock) and read by the bell; recipients via `rbacRepository.findUsersWithPermission`.

## Module 8 — Profile & System Settings

- Placeholders: `pages/profile/ProfilePage.jsx` (`/profile`), `pages/settings/SettingsPage.jsx` (`/settings`),
  both reachable from the Header profile menu.
- No permissions seeded yet for settings — add e.g. `settings.manage` to the catalog.
- Things waiting to move into Settings (currently hardcoded on the frontend):
  - `config/featureVisibility.js` — which roles hide self-service sections (AAS-390–392).
  - `config/attendanceCalendar.js` — `LATE_CHECK_IN_AFTER`, `EARLY_CHECK_OUT_BEFORE` cut-off times (AAS-414).
  - `OVERTIME_THRESHOLD_MINUTES` (backend env), public-holiday list (doesn't exist yet).
- Profile: `GET /auth/me` exists; no self-service "update my profile" or "change password" endpoint yet.
- Login page has a "Forgot password?" link to `/forgot-password` with no route or backend.
- A roles/permissions admin UI would sit here too; the API already exists under `/rbac` (see `auth-rbac.md`).
