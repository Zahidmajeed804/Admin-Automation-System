# Hide self-service sections for admin

Admin manages and approves; they don't clock in, work overtime or take leave
themselves. "My attendance", "My overtime" and "My leave requests" (plus the
Request leave button and the Attendance/Team tab switcher) are now hidden for
admin, driven by one frontend config (`selfServiceHiddenForRoles` in
`frontend/src/config/featureVisibility.js`). Nothing changed on the backend —
this is presentation only, and every permission check still runs exactly as
before. When the Settings module ships, this hardcoded role list moves into
the database so an admin can toggle it per role.

Run on 2026-09-28 in real headless Chrome against the live MongoDB, as admin,
a temporary manager, and a temporary staff account. **All 24 checks passed**
(one run needed `npm run seed`, see below; the rerun was clean). All test
accounts were deleted afterwards.

## Result of the run recorded here

| Role | Attendance | Overtime | Leave |
|---|---|---|---|
| **Admin** | No tab switcher — Team table shown directly, page description reads "Review everyone's attendance and correct records." No "My attendance history" heading. | No "My overtime" section. "Pending approvals" still shown. | No "My leave requests" section and no "Request leave" button. "Pending approvals" still shown, description reads "Review and decide leave requests." |
| **Manager** (approves, but also clocks in) | Tab switcher present (My attendance / Team), unchanged. | Both "Pending approvals" and "My overtime" shown, unchanged. | Both "Pending approvals" and "My leave requests" shown, unchanged. |
| **Staff** | "My attendance history" shown directly, no tab switcher (staff never had one — no `attendance.update`). No "Staff" link in the section nav (no `users.manage`). | "My overtime" shown, no "Pending approvals" (no `overtime.approve`). | "My leave requests" and "Request leave" shown, no "Pending approvals". |

One run along the way needed `npm run seed`: a fresh test staff account was
missing `overtime.read` because the seed had not been run against this
database since that permission was added to the `staff` role. The seed is
idempotent — running it again is always safe — and after running it the
staff checks passed cleanly. This is unrelated to the visibility feature
itself; see the Module 5 README section.

## How to repeat it yourself

Takes about 5 minutes with the backend and frontend running against a live
`MONGO_URI`.

1. **Admin** — log in as the seeded admin (`admin@admin-automation.local`).
   Open **Attendance**: you land straight on the team table, no tabs, no
   clock widget. Open **Overtime**: only "Pending approvals". Open **Leave**:
   only "Pending approvals", no "Request leave" button.
2. **Manager** — create a staff login from **Attendance → Staff**, then give
   it the manager role from a roles/permissions tool (or `POST
   /rbac/user-roles`). Log in as them: Attendance shows the My attendance /
   Team tabs, Overtime and Leave show both their own section and Pending
   approvals — nothing is hidden for a role that isn't `admin`.
3. **Staff** — create a second staff login (default role). Log in as them:
   My attendance history, My overtime and My leave requests all show
   normally, with no Pending approvals anywhere and no Staff link in the nav.

## Clean up

Delete any temporary manager/staff accounts created for this check the same
way as in
[`AAS-383-388-staff-management.md`](AAS-383-388-staff-management.md#clean-up).

## If something does not match

| You see | Likely cause |
|---|---|
| Admin still sees "My attendance" / "My overtime" / "My leave requests" | check the admin's `roles` array from `/auth/me` actually includes `"admin"` — the hook matches on role **name**, not on `users.manage` or any other permission |
| A manager or staff account has sections missing | `selfServiceHiddenForRoles` only lists `"admin"` — if another role's name was added there by mistake, remove it |
| Staff can't open **Overtime** at all (redirected to Unauthorized) | the `staff` role is missing `overtime.read` — run `npm run seed` in `backend` (idempotent, safe to repeat) |
