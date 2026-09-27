# Early departure tracking

The shift starts when a staff member clocks in and lasts 10 hours (the same number as the
overtime threshold). Clocking out before that records how many minutes short the day was.
Late arrival is not tracked: with the shift starting at clock-in there is nothing to be
late against.

Run on 2026-09-26 in real Chrome against the live MongoDB. **All 15 checks passed.**

## Result of the run recorded here

To avoid waiting 10 hours, the backend was started with a **3 minute** shift
(`OVERTIME_THRESHOLD_MINUTES=3`).

| Check | Result |
|---|---|
| Open day (clocked in, not out) | no early-departure value |
| Manager corrects a day to 1 minute worked | early **2** (3 minus 1), status Half Day |
| Corrected to 5 minutes worked | early **0** |
| Corrected to exactly 3 minutes | early **0** |
| Corrected with an explicit status "present" and 2 minutes | status kept, early still recomputed as **1** |
| A correction never creates overtime | none created |
| Record from before the field existed | no value in the API |
| Staff clocks in, waits 70 seconds, clocks out | widget shows **Left 2m early** |
| Own history table | column **Left early** after Worked: "2m early", worked 1m, Half Day |
| Manager Team table | same column; staff "2m early", corrected day "Full shift", old record "—" |
| Browser console | no errors |

All test accounts and records were deleted afterwards.

---

# How to repeat it yourself

Takes about 5 minutes.

## 0. Setup

1. Stop any backend on port 5000 and start it with a 3 minute shift. From `backend` in
   Git Bash:

   ```bash
   OVERTIME_THRESHOLD_MINUTES=3 npm run dev
   ```

   PowerShell: `$env:OVERTIME_THRESHOLD_MINUTES=3; npm run dev`

2. Start the frontend if it is not running (`npm run dev` in `frontend`).
3. Register `early.staff@test.local` through the Register page (any password with a
   number, for example `TestPass123`). For the manager part, register
   `early.manager@test.local` and give it the manager role as in step 5 of
   [`AAS-302-end-to-end-attendance-overtime-leave.md`](AAS-302-end-to-end-attendance-overtime-leave.md).

## 1. Leaving early (staff)

| # | Do this | You should see |
|---|---|---|
| 1 | Log in as the staff member, open **Attendance**, click **Clock in** | status "Clocked in" |
| 2 | Wait about 1 minute, then click **Clock out** | in the right-hand card: **Left 2m early** (or 1m to 3m, depending on when you click) and a Half Day badge |
| 3 | Look at **My attendance history** | a **Left early** column between Worked and Status, showing "2m early" in amber |

## 2. Manager correction

| # | Do this | You should see |
|---|---|---|
| 4 | Log in as the manager, **Attendance**, **Team** tab | the same **Left early** column, with the staff member's "2m early" |
| 5 | Click **Edit** on that row and set clock out to 5 minutes after clock in. The dialog says early departure will be recalculated | after saving, the row shows **Full shift** |
| 6 | Set clock out to 1 minute after clock in | the row shows **2m early** again |

Old records that were clocked out before this change show "—" in the column.

## 3. Clean up

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^early\..*@test\.local$/ }).toArray().map(u => u._id);
print("attendances:", db.attendances.deleteMany({ user: { $in: ids } }).deletedCount);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
'
```

Then stop the backend and start it normally with `npm run dev` so the shift goes back to
10 hours.

## If something does not match

| You see | Likely cause |
|---|---|
| "Full shift" for a very short day | the backend still has the 3 minute test shift, or the day is at least the shift length. Half Day is decided separately, by the 4 hour rule |
| No **Left early** value on a clocked-out day | the record was made before this feature. Only new clock-outs and manager corrections set it |
| No early value after the correction | the dialog only recalculates when a time actually changes |
