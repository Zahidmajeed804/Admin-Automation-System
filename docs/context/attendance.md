# Module 5 — Attendance, Overtime, Leave & Staff

**Status:** done for the planned scope (Sprints 1–2), tickets AAS-86 … AAS-420. Main author: Zahid Majeed.
Branch: `feature/attendance-module`. Every feature has a verification guide in `docs/verification/`.

Four pages under one sidebar entry ("Attendance"), switched by `AttendanceSectionNav`
(`constants/navigation.js` `attendanceNav`, each link shown only with its permission).

## Backend

| Area | Model | Repository / Service / Controller / Validators / Routes |
|---|---|---|
| Attendance | `models/Attendance.js` | `attendanceRepository`, `attendanceService`, `attendanceController`, `attendanceValidators`, `attendance.routes.js` |
| Overtime | `models/OvertimeRequest.js` | `overtimeRepository`, `overtimeService`, `overtimeController`, `overtimeValidators`, `overtime.routes.js` |
| Leave | `models/LeaveRequest.js` | `leaveRepository`, `leaveService`, `leaveController`, `leaveValidators`, `leave.routes.js` |
| Staff | `models/User.js` | `userRepository`, `userService`, `userController`, `userValidators`, `user.routes.js` |
| Designations | `models/Designation.js` | `designationRepository`, `designationService`, `designationController`, `designationValidators`, `designation.routes.js` |

Enums: `constants/attendance.js` — `ATTENDANCE_STATUSES` (present, absent, half-day, late),
`OVERTIME_STATUSES` / `LEAVE_STATUSES` (pending, approved, rejected), `LEAVE_TYPES`
(casual, sick, annual, unpaid), `REVIEW_DECISIONS` (approved, rejected).

### Models

- **Attendance** — `user`, `date` (midnight UTC; **unique `{ user, date }`**), `clockIn`, `clockOut`,
  `workedMinutes`, `earlyDepartureMinutes` (absent on old records → UI shows "—"), `shiftMinutes`
  (shift the day was measured against, stored at clock-out; absent on older records), `status`, `notes`.
- **Designation** — `name` (unique, case-insensitive collation), `shiftHours` (1–16, decimals allowed), `isActive`.
  Deactivated, never deleted.
- **User.designation** — optional ref to `Designation`; populated (`name shiftHours isActive`) in staff lists and `/users/options`.
- **OvertimeRequest** — `user`, `attendance` (unique), `date`, `overtimeMinutes`, `status`, `reviewedBy`, `reviewedAt`, `reviewNote`.
- **LeaveRequest** — `user`, `leaveType`, `startDate`/`endDate` (midnight UTC, inclusive), `totalDays`, `reason` (≤500), `status`, review fields,
  and after a reviewer edit: `originalStartDate`/`originalEndDate`/`originalTotalDays` (set on first edit, never overwritten), `editedBy`, `editedAt`.
- **User.leaveAllocation** — `{ casual, sick, annual }` days per year (unpaid is unlimited).

### Endpoints (`/api/v1`, all `authenticate`)

| Method & path | Permission | Notes |
|---|---|---|
| `POST /attendance/clock-in` / `clock-out` | `attendance.create` | 409 if already clocked in; 404 clock-out without clock-in |
| `GET /attendance/me/today` | `attendance.read` | |
| `GET /attendance` `?userId&status&startDate&endDate&page&pageSize` | `attendance.read` | own records; `attendance.update` sees everyone |
| `GET /attendance/employees` | `attendance.update` | Team filter options |
| `GET /attendance/summary` `?month=YYYY-MM&userId&designationId` | `attendance.read` | `attendanceSummaryService.getMonthly`; `attendance.update` sees everyone + filters, others only their own row |
| `PATCH /attendance/:id` `{ clockIn, clockOut, status, notes }` | `attendance.update` | manager correction; recomputes worked/status/early departure |
| `GET /overtime` | `overtime.read` | `overtime.approve` sees everyone |
| `PATCH /overtime/:id/review` `{ decision, note }` | `overtime.approve` | |
| `GET /leave` | `leave.read` | approvers/rejecters see everyone |
| `GET /leave/balance` `?userId&year` | `leave.read` | `userId` only for reviewers |
| `POST /leave` `{ leaveType, startDate, endDate, reason }` | `leave.create` | |
| `PATCH /leave/:id/review` | `leave.approve` to approve, `leave.reject` to reject | inline `requireDecisionPermission` in `leave.routes.js` |
| `PATCH /leave/:id/dates` `{ startDate, endDate }` | `leave.approve` or `leave.reject` | pending requests applied for > 2 days (AAS-451) |
| `GET /users/options` | `overtime.approve` or `leave.approve` | lightweight employee list |
| `GET /users` `?search&status&page&pageSize`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status` | `users.manage` | staff directory |
| `PUT /users/leave-allocation/all` `{ casual, sick, annual, overwrite, designationId? }` | `users.manage` | bulk allocation; `designationId` limits it to that designation (404 if unknown; inactive allowed) |
| `GET /designations` `?status` | `users.manage` or `attendance.update` | sorted by name, `data: { designations }` |
| `POST /designations` `{ name, shiftHours }`, `PATCH /designations/:id` `{ name, shiftHours, isActive }` | `users.manage` | duplicate name → 409 |

### Business rules (enforced server-side)

- Worked time computed on clock-out; **< 240 min = `half-day`**, else `present`.
- Shift length = the person's `designation.shiftHours` × 60 (AAS-430–434), or `OVERTIME_THRESHOLD_MINUTES`
  (default 600) when they have none; a deactivated designation still applies to its holders.
  Stored as `Attendance.shiftMinutes` at clock-out. `earlyDepartureMinutes = max(0, shift − worked)`.
  Manager corrections recompute it with the stored shift (older records take the current one and store it);
  `clockIn` must fall on the record's date.
- Worked time above the shift auto-creates a **pending OvertimeRequest** for the excess on clock-out
  (upsert on `attendance`, so it's idempotent). Manager corrections don't create or adjust overtime.
- Monthly summary (AAS-457): overtime per person = approved / pending `overtimeMinutes` dated in the month (rejected ignored);
  day counts by stored status; leave days = approved leave clipped to the month. Working days = Mon–Fri up to today
  (whole past month, 0 for a future one). Attendance % = (present + late + ½ half-day) ÷ (working days − approved leave on
  working days), 1 decimal, capped at 100, `null` if nothing to measure. Listed: anyone with activity that month plus
  active staff with a designation (`userRepository.findForSummary`).
- Designations: assigning one requires it to exist (404) and be active (400); a person keeps a designation
  that's deactivated later. `designationId: null` / `""` on `PATCH /users/:id` clears it.
- Reviews are **decided once** (atomic `reviewIfPending`; second decision → 409) and **nobody reviews their own** request (403).
- Editing dates (`leaveService.editDates`): only pending (409), not own (403), only if applied for more than
  `LEAVE_DATES_EDITABLE_AFTER_DAYS` = 2 days, judged on `originalTotalDays ?? totalDays` (400); unchanged dates → 400.
  Overlap and balance checks pass `excludeId` so the request doesn't count against itself; atomic `updateDatesIfPending`.
- Leave can't overlap the same person's pending/approved leave (409); rejected leave frees the days.
- Quotas (casual/sick/annual): `remaining = allocated − approved − pending`, checked **per calendar year**
  the request touches (`daysInYear`, `yearsTouched` in `leaveService.js`); over quota → 400 naming the year and days left.
- Staff accounts: admin types a unique **Employee ID** (case-insensitive), a **phone** (required, normalized) and an
  optional email + temp password; new users get `staff`; duplicate phone/email/ID → 409 naming it (`assertContactsAvailable`).
  On edit, `""` for email or phone removes it. Leave allocation updates use dot-paths so other types aren't reset.
- Bulk allocation touches active users only (optionally only one designation); without `overwrite` it fills only
  accounts with no allocation. Per-person changes send only the changed types (dot-path update).
- Deactivation blocks login and invalidates existing tokens on the next request; history is kept; you can't deactivate yourself.

## Frontend

| Page | File | Uses |
|---|---|---|
| `/attendance` | `pages/attendance/AttendancePage.jsx` | Tabs "My attendance" / "Team" (`?tab=team`, needs `attendance.update`); `ClockWidget`, `AttendanceViewToggle` (List/Calendar), `AttendanceHistoryTable`, `AttendanceCalendarContainer` → `AttendanceCalendar`, `TeamAttendanceTable`, `EditAttendanceModal` (DateTimePicker) |
| `/attendance/overtime` | `pages/overtime/OvertimePage.jsx` | Pending / Team (`?view=team`) for `overtime.approve`: `PendingOvertimeTable`, `TeamOvertimeTable`, `ReviewOvertimeDialog`; "My overtime" `OvertimeHistoryTable` |
| `/attendance/leave` | `pages/leave/LeavePage.jsx` | `LeaveBalanceCards`, `RequestLeaveModal` (shows remaining, blocks over-balance), `LeaveHistoryTable`, Pending/Team for approvers: `PendingLeaveTable`, `TeamLeaveTable`, `ReviewLeaveDialog`, `EditLeaveDatesDialog` (Edit dates on pending rows > 2 days); `LeaveDaysCell` adds the "Edited · was N days" badge (`theme.statusStyles.edited`) in all three tables |
| `/attendance/summary` | `pages/attendance/AttendanceSummaryPage.jsx` | month/employee/designation filters, `components/attendance/summary/`: `useMonthlySummary`, `MonthlySummaryStats`, `MonthlySummaryTable`, lazy `SummaryCharts` (`OvertimeShareChart`, `AttendanceBreakdownChart`, `SummaryPie`) |
| `/attendance/staff` | `pages/attendance/StaffPage.jsx` | `FilterBar` + `Table` (Designation column), `StaffFormModal` (Employee ID, temp password with show/hide, Designation select of active ones), `ConfirmDialog` (activate/deactivate), `AssignLeaveAllocationDialog` ("Apply to": all active staff or a designation), `StaffLeaveAllocationDialog` (row **Leave** action, prefilled, sends only changed types), `DesignationsDialog` (add/edit/(de)activate) |

Services: `attendanceService`, `overtimeService`, `leaveService`, `userService` — all return `{ items, pagination }`;
`designationService.list` returns a plain array (not paginated). Shift labels: `utils/designationFormat.js`
(`formatShiftHours` → "8h" / "8h 30m", `formatDesignation`).
Shared columns/formatting: `components/attendance/attendanceColumns.jsx`, `utils/attendanceFormat.js`, `utils/leaveFormat.js`.

- **Calendar**: month grid; present days green with In/Out; red if check-in after `LATE_CHECK_IN_AFTER` ("09:00")
  or check-out before `EARLY_CHECK_OUT_BEFORE` ("19:00") — `config/attendanceCalendar.js`, display only.
  Weekends = pink "Holiday"; approved leave = CL/SL/AL/UL. Summary counts + legend above the grid.
  Dev preview: `?calendarDemo=1` (data in `components/attendance/attendanceCalendarSample.js`).
- **Admin self-service hidden**: "My attendance/overtime/leave" and Request leave are hidden for the
  `admin` role via `config/featureVisibility.js` (frontend-only).
- All date inputs use `DatePicker` / `DateTimePicker` (AAS-408–412).

## Verification guides (`docs/verification/`)

AAS-91 clock in/out · AAS-96 list & edit · early-departure · AAS-280 overtime auto-trigger · AAS-290 leave
· AAS-302 end-to-end · AAS-383–388 staff · AAS-390–392 hide self-service · AAS-394–398 team overtime/leave
· AAS-400–406 leave quotas · AAS-408–412 date/time picker · AAS-414–420 calendar
· AAS-430–434 shift by designation · AAS-447–450 leave allocation by designation / per person · AAS-452–456 edit long leave dates · AAS-458–463 monthly summary.

## Not built yet

- Late-arrival tracking (no fixed shift start, by design).
- Leave/Holiday/Weekend as stored attendance statuses; configurable public-holiday list.
- Reports beyond the monthly summary (daily, leave, individual history) and the overtime sheet export (→ Module 7).
- Backend tests for this module (verified manually via the guides above).
- After pulling, run `npm run seed` (adds `overtime.read` to staff).
