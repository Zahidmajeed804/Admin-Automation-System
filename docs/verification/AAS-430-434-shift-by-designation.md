# Shift length by designation

After the demo, staff shifts were asked to be 8 or 9 hours depending on the
person's designation, instead of one fixed 10-hour threshold for everyone.
Admins now manage a list of **designations** (name + shift hours) from the
Staff page and give each staff member one. Overtime starts, and early
departure is measured, at the end of **that person's** shift. The shift used
is saved on each attendance day, so changing a designation later doesn't
rewrite days already clocked out.

| Ticket | What it covers |
|---|---|
| AAS-430 | `Designation` model and `/api/v1/designations` endpoints |
| AAS-431 | `designation` on staff accounts (create, edit, clear, shown in lists) |
| AAS-432 | Clock-out and manager corrections use the person's shift; shift stored as `shiftMinutes` |
| AAS-433 | Designations dialog on the Staff page, Designation field in the staff form, Designation column |
| AAS-434 | This verification guide |

Run on 2026-10-04 over real HTTP and in real headless Chrome, against a
**throwaway in-memory MongoDB** (no real data touched, nothing to clean up).
**21 of 21 API checks and 12 of 12 Chrome checks passed.**

## Result of the run recorded here

### API

| Check | Result |
|---|---|
| Create `Engineer` (8h) and `Office Boy` (9h) | 201 |
| Create `ENGINEER` again | 409, `"A designation with this name already exists"` (names are case-insensitive) |
| Create with `shiftHours: 20` | 400, `"shiftHours must be a number between 1 and 16"` |
| Create staff with `designationId` | 201, `designation` returned populated `{ name, shiftHours, isActive }` |
| Create staff with `designationId: ""` | 201, no designation |
| `GET /users` | each row has its designation populated |
| Staff calls `GET /designations` | 403 |
| Manager calls `GET /designations` / `POST /designations` | 200 / 403 (listing is open to `attendance.update` for filters; changes need `users.manage`) |
| Engineer (8h) works 8h 30m and clocks out | `shiftMinutes: 480`, `earlyDepartureMinutes: 0`, pending overtime of **30 min** created |
| Office Boy (9h) works the same 8h 30m | `shiftMinutes: 540`, `earlyDepartureMinutes: 30`, **no** overtime |
| Staff with no designation works 8h 30m | `shiftMinutes: 600` (the `OVERTIME_THRESHOLD_MINUTES` default), `earlyDepartureMinutes: 90` |
| Engineer changed to 9h, then a manager corrects that earlier day | still measured against **480** (the stored shift) |
| Give a deactivated designation to a new staff member | 400, `"This designation is inactive and can't be assigned"` |
| Edit someone who already holds that deactivated designation | 200, they keep it |
| `PATCH /users/:id { designationId: null }` | 200, designation removed |

### Frontend (Chrome)

| Check | Result |
|---|---|
| Staff table has a **Designation** column: name with "9h shift" underneath, "—" when none | ✓ |
| **Designations** button opens a dialog listing each designation's shift and Active/Inactive status | ✓ |
| Clicking **Add** with empty fields shows "Name is required." and "Shift length is required." and saves nothing | ✓ |
| Adding *Driver* with 8.5 hours shows the row as **8h 30m** and a "Driver added." banner | ✓ |
| Adding *driver* again shows the server's "already exists" message | ✓ |
| **Edit** prefills the form; saving 9 hours updates the row to **9h** | ✓ |
| **Deactivate** marks it Inactive | ✓ |
| **Add staff** form offers only *active* designations, labelled with their shift ("Engineer (9h shift)") plus "No designation (default shift)" | ✓ |
| Creating staff with Engineer shows it in the table straight away | ✓ |
| **Edit** on a staff member preselects their designation; choosing "No designation" and saving shows "—" | ✓ |
| At 400px wide the page and dialog don't scroll sideways (the dialog's table scrolls inside itself) | ✓ |

## How to repeat it yourself

Takes about 10 minutes with the backend and frontend running. Nothing new to
seed: designations need no new permissions.

### 1. Create designations and give them to staff

1. Log in as admin, open **Attendance → Staff → Designations**.
2. Add *Office Boy* with **9** and *Engineer* with **8**. Each appears with
   its shift and an Active badge.
3. Close the dialog, **Edit** a staff member, pick *Engineer (8h shift)* in
   **Designation**, save. The Designation column shows *Engineer / 8h shift*.

### 2. See the shift drive overtime

1. Log in as that staff member and **Clock in**, then **Clock out**. With
   only a few minutes worked, the day shows an early departure of almost
   **8h** (their shift), not 10h.
2. To see overtime without waiting a full day (use a different staff member
   or another day): clock in as the staff member; as a manager, open
   **Attendance → Team**, edit today's record and move the clock-in 8h 30m
   earlier; then clock out as the staff member. An Engineer (8h) gets a
   pending **30-minute** overtime request on the **Overtime** page; an Office
   Boy (9h) gets a 30-minute early departure and no overtime.

### 3. Change a designation

1. Change *Engineer* to 9 hours. Days already clocked out keep 8h (look at a
   corrected day's early departure). New clock-outs use 9h.
2. **Deactivate** *Office Boy*. It no longer appears in the staff form for new
   people; anyone who already has it keeps it and can still be edited.

## Behaviour to know about

- **Default shift.** Staff without a designation use `OVERTIME_THRESHOLD_MINUTES`
  (600 = 10h, `backend/.env`). Give everyone a designation to move them off it.
- **Stored per day.** `Attendance.shiftMinutes` is set at clock-out. Days
  clocked out before this change have no stored shift; the first manager
  correction to one of them measures it against the person's *current* shift
  and stores it.
- **Manager corrections don't create overtime** (unchanged from before this
  story): only a real clock-out does.
- **No delete.** Designations are deactivated, never deleted, so nobody is left
  pointing at a missing one.

## If something does not match

| You see | Likely cause |
|---|---|
| Early departure still counts against 10h | the person has no designation, or clocked out before one was set (the stored shift wins) |
| A designation is missing from the staff form | it's inactive; activate it in **Designations** |
| "This designation is inactive and can't be assigned" | same as above, on create or when switching someone to it |
| A manager gets 403 on the Designations dialog | managers can list designations but not change them; changes need `users.manage` |
