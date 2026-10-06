# Module 4 — Generator Management

**Status:** done. Merged into `develop` via PR #7 (`AAS-97/Generator-Management`), tickets AAS-209 … AAS-376
plus AAS-421 bug fixes. Main author: Zain Arshad. Best-tested module in the repo (backend + frontend).

Covers: generator registry, fuel/usage logs, maintenance scheduling with recurrence and alerts,
invoice uploads, a daily reminder email job, and 7 reports.

## Backend

| Layer | Files |
|---|---|
| Models | `models/Generator.js`, `models/GeneratorLog.js`, `models/GeneratorMaintenance.js` |
| Repositories | `generatorRepository`, `generatorLogRepository`, `generatorMaintenanceRepository`, `reportRepository` |
| Services | `services/generatorService.js` (core rules, ~550 lines), `services/reportService.js`, `services/notificationRecipients.js` |
| Controllers | `generatorController`, `generatorLogController`, `generatorMaintenanceController`, `reportController` |
| Validators | `generatorValidators.js` (enums duplicated from models — keep in sync), `reportValidators.js` |
| Routes | `routes/generator.routes.js` (logs, maintenance, reports, then `/:id` last) |
| Uploads | `middleware/uploadInvoice.js` (multer, PDF/JPG/PNG, `INVOICE_MAX_SIZE_MB`, UUID names in `INVOICE_UPLOAD_DIR`) |
| Jobs / mail | `jobs/scheduler.js`, `jobs/maintenanceReminderJob.js`, `config/mail.js`, `utils/mailer.js`, `utils/emailTemplates/maintenanceReminder.js`, `maintenanceIntervalDue.js` |

### Models

- **Generator** — `tag` (unique), `name`, `location`, make/model/serial, kVA, `fuelType` (diesel/petrol/gas),
  `status` (operational / under_maintenance / faulty / decommissioned / maintenance_due), `runningHoursTotal`,
  `lastServiceDate`, `maintenanceIntervalHours`, `hoursAtLastMaintenanceReset`, `maintenanceDueNotifiedAt`,
  `isActive` (legacy; delete is now hard), `createdBy`/`updatedBy`.
- **GeneratorLog** — `hoursRun`, meter reading, fuel opening/added/consumed/closing litres, cost per litre, cost total, vendor, reason, `recordedBy`.
- **GeneratorMaintenance** — `type` (scheduled/unscheduled/inspection), `status` (scheduled/completed/cancelled),
  `scheduledDate`, recurrence by days (`intervalDays`, `alertThresholdDays` default 7) or hours
  (`intervalHours`, `alertThresholdHours` default 25, `hoursAtScheduling`), `hoursAtService`, `cost`,
  embedded `invoice` metadata, `notifiedStatus` (upcoming/overdue) + `notifiedAt`.

### Endpoints (`/api/v1/generator`, all `authenticate`)

| Method & path | Permission |
|---|---|
| `GET /` `?status&location&search&page&pageSize`, `GET /:id` | `generator.read` |
| `POST /` / `PATCH /:id` / `DELETE /:id` (cascade) | `generator.create` / `.update` / `.delete` |
| `GET /logs` `?generatorId&from&to&page&pageSize` | `generator.read` |
| `POST /logs`, `PATCH /logs/:logId`, `DELETE /logs/:logId` | `generator_log.create` / `.update` / `.delete` |
| `GET /maintenance`, `GET /maintenance/alerts?withinDays` | `generator.read` |
| `POST /maintenance` / `PATCH /maintenance/:id` (edit, or `status: completed|cancelled`) / `DELETE` | `generator.create` / `.update` / `.delete` |
| `POST` / `GET` (download) / `DELETE /maintenance/:id/invoice` (multipart field `invoice`) | `.update` / `.read` / `.update` |
| `GET /reports/running-hours?month=YYYY-MM`, `diesel-consumption?from&to`, `fuel-cost?month`, `maintenance-cost?from&to`, `operating-cost?year`, `service-history` (paged), `cost-summary` | `reports.read` |

Manager has every generator permission except `generator.delete`; staff has `generator.read` + `generator_log.create`.

### Business rules (`generatorService.js`)

- `computeFuelFigures`: server computes consumed = opening + added − closing and total = added × price,
  overriding the client. **Mirrored on the frontend in `utils/fuelFigures.js` — change both together.**
- `recordLog`: atomic `$inc` of `runningHoursTotal`; log is rolled back if that fails.
  `updateLog` corrects hours by the delta (closing ≤ opening + added; price needs litres added); `removeLog` subtracts.
- `maybeFlagMaintenanceDue`: crossing `maintenanceIntervalHours` sets `maintenance_due` and emails admins once.
- Only `scheduled` jobs can be edited (else 409). `completeMaintenance` updates service date, resets the hours
  counter, and auto-creates the next job **for day-based recurrence only**; compensates on failure.
- `computeAlertStatus`: overdue/upcoming computed on read (by date or hours, whichever first) — not stored.
- Invoice attach/replace/remove avoids orphan files.
- Reminder job (`REMINDER_CRON_SCHEDULE`, default 07:00 daily; off with `EMAIL_REMINDERS_ENABLED=false`) emails
  active holders of `generator.update`; `notifiedStatus` prevents repeats. No `SMTP_HOST` → messages built, not sent.

## Frontend (`pages/generator/` — forms and modals live here, not in `components/`)

| Route | Page | Pieces |
|---|---|---|
| `/generator` (layout) | `GeneratorLayout.jsx` | `PageHeader` + URL-driven `Tabs` (Registry/Logs/Maintenance/Reports; Reports needs `reports.read`) |
| index | `GeneratorPage.jsx` | registry table, stat cards, `GeneratorForm`, `GeneratorDetails`, delete via `ConfirmDialog` |
| `logs` | `GeneratorLogsPage.jsx` | `GeneratorLogForm` (live fuel preview via `utils/fuelFigures.js`) |
| `maintenance` | `GeneratorMaintenancePage.jsx` | `GeneratorMaintenanceForm`, `…CompleteForm`, `…Details`, `…Invoice`, `DueInfo` |
| `reports` | `GeneratorReportsPage.jsx` | in-page tabs over 7 lazy panels `GeneratorReport*` (recharts loads only when opened) |

Service: `services/generatorService.js` — lists return `{ items, meta }`; invoice upload via FormData, download as blob.
Error text: `GeneratorForm.jsx` `extractErrorMessage` and `utils/errorMessage.js` `describeError` (prefer `apiErrorMessage` in new code).

## Tests

- Backend `backend/tests/`: `generator.routes`, `generatorLog.routes`, `generatorMaintenance.routes`, `generatorModels`,
  `generatorReports.routes`, `generatorService`, `maintenanceReminderJob`, `reportService`; helper `tests/helpers/generatorTestUtils.js`.
- Frontend `pages/generator/__tests__/`: 17 suites (one per page/form/report).

## Known limitations / gaps

- Hours-only recurrence doesn't auto-create the next job.
- Editing a job's schedule doesn't reset `notifiedStatus`.
- Correcting an old log doesn't recompute later entries.
- Generator create/delete aren't transactional.
- Controllers return raw `data` and spread `req.body` (older style — don't copy).
- No verification guide in `docs/verification/` yet; README still says generator isn't built.
- Sidebar "Generator" item and `/generator` route have no permission gate (backend still enforces `generator.read`).
