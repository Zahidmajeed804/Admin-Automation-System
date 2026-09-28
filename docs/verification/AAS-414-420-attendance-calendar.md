# Monthly attendance calendar

A new calendar view of a single person's attendance for a month, alongside the existing list
(table) view. Present days show green with In/Out times (red if the check-in was after the
cutoff or the check-out before it), weekends default to a pink "Holiday" card, approved leave
shows as a coloured abbreviation (CL/SL/AL/UL), and a summary + colour legend sit above the grid.
Built with no new dependency, in Tailwind on top of plain JS date math (reusing the date helpers
already built for the date picker, `components/common/DatePicker.jsx`).

Run on 2026-09-28 over real HTTP and in real headless Chrome (down to a 320px mobile viewport)
against a live MongoDB, using real historical attendance/leave data for existing accounts
(read-only - nothing was changed) plus one temporary staff account for the "My attendance"
toggle. **18 of 18 scripted pass/fail checks passed** (AAS-417/418/419, run through a `check()`
harness with explicit assertions), plus **12 additional points verified by hand** during
AAS-414/415/416's development, before any page existed yet to give those a URL to script against
(direct DOM/data inspection and screenshots, not a scripted checklist). The temporary account was
removed afterwards; the database is back to exactly its original 7 real accounts.

## Where it's used

- **Attendance → My attendance**: a List/Calendar toggle next to "My attendance history" shows
  the signed-in user's own month.
- **Attendance → Team** (managers/admins): the same toggle appears in the filter bar, but **only
  once a specific employee is picked** in the Employee filter - a calendar only makes sense for
  one person at a time. Clearing the filter back to "All employees" hides the toggle and falls
  back to the list automatically.

## Result of the run recorded here

### Grid, data loading, summary and legend - 12 checks (manual smoke pass, not scripted)

Verified by temporarily mounting the calendar against real accounts' real September 2026 data
(Zahid Majeed: 5 attendance days across the month; Jacke: 3 attendance days plus one real
approved casual-leave day on the 25th; Majid1: one leave day) before either component had a
page to live on yet (AAS-414/415/416 land before AAS-419 wires the toggle in):

| Check | Result |
|---|---|
| Weekends with no attendance/leave show as pink "Holiday" cards | ✓ |
| A real attendance day (even on what would be a weekend) shows Present, not Holiday - attendance data outranks the weekend default | ✓ |
| Present cards show "In HH:MM" / "Out HH:MM" in the viewer's local time | ✓ |
| A day with no check-out shows "----" instead of a time | ✓ |
| A check-in after 09:00 (the configured cutoff) shows in red; on/before shows in green | ✓ |
| A check-out before 19:00 shows in red; at/after shows in green | ✓ |
| Today's cell is ring-highlighted | ✓ |
| Real approved leave renders as its abbreviation in the right colour (verified with a real CL day) | ✓ |
| A leave request that starts or ends outside the visible month is clipped to it, not spilled onto the wrong days | ✓ |
| Summary counts (Present/Late/Leave/Holidays) match a hand-count of the same visible month | ✓ |
| The colour legend lists every card type with a matching swatch | ✓ |
| Prev/Next month re-fetches and re-renders correctly | ✓ |

### Sample data preview (AAS-417) - 5 checks

| Check | Result |
|---|---|
| `?calendarDemo=1` (dev only) shows a "Preview — sample data" banner | ✓ |
| Shows an explicit Absent card | ✓ |
| Shows all four leave abbreviations (CL/SL/AL/UL) | ✓ |
| Shows a day with no checkout ("----") | ✓ |
| Summary counts computed from the sample data are internally consistent (hand-verified against the cutoff logic) | ✓ |

### Mobile and hover polish (AAS-418) - 3 checks

| Check | Result |
|---|---|
| No horizontal page scroll at 375px | ✓ |
| No horizontal page scroll at 320px (iPhone SE width) - still fully legible | ✓ |
| Day cards have a real hover lift (`hover:-translate-y-0.5`), not just a shadow | ✓ |

### List/Calendar toggle (AAS-419) - 10 checks

| Check | Result |
|---|---|
| Team Attendance: toggle is hidden while "All employees" is selected | ✓ |
| Toggle appears once a specific employee is picked | ✓ |
| Clicking Calendar swaps the table for that employee's monthly calendar | ✓ |
| The calendar shows that employee's real approved leave (Jacke's real CL on Sep 25) | ✓ |
| Clearing the employee filter hides the toggle and falls back to List automatically | ✓ |
| My attendance: defaults to List | ✓ |
| Clicking Calendar shows the signed-in user's own monthly grid | ✓ |
| Switching back to List hides the calendar again | ✓ |
| (plus 2 login/navigation checks) | ✓ |

## Real bugs found while testing this story

None in the calendar itself. Two of my **own test scripts** had bugs, both instructive:

- A `waitFor` condition checked `document.querySelectorAll('[data-date]').length > 0`, which is
  true from the very first render (cells render immediately with an empty `days` prop, before the
  month's data has finished fetching) - so the test read cell text before the real data arrived
  and saw empty cells where real attendance should have shown. Fixed by waiting for the actual
  data to land (a debug hook during development, and `document.body.innerText` content checks in
  the final tests) instead of the grid's mere existence.
- A viewport "mobile" test mutated `document.documentElement.style.width`, which resizes the
  `<html>` box but not the real browser viewport that CSS media queries (`sm:`) respond to - so
  nothing was actually narrower and the check passed for the wrong reason. Fixed by adding a real
  `Emulation.setDeviceMetricsOverride` viewport helper to the test driver (already fixed the same
  way for the date picker's mobile tests in AAS-411; reused here).

## How to repeat it yourself

1. As any staff member, open **Attendance**. Next to "My attendance history", click **Calendar**
   - your own month appears with a summary and legend above the grid. Click **List** to go back.
2. As a manager/admin, open **Attendance → Team**. The toggle is absent while "All employees" is
   selected. Pick one employee - the toggle appears. Click **Calendar** to see their month; the
   Status/Date filters stay visible but only the Employee filter matters in this view. Clear the
   employee filter - the toggle disappears and the table reappears.
3. In dev (`npm run dev`), visit `/attendance?calendarDemo=1` (works from either List/Calendar
   context once you're on Calendar) to see every state at once with sample data, marked with a
   "Preview" banner so it's never mistaken for real attendance.
4. Resize the window down to phone width (or DevTools device mode) - the grid stays inside the
   viewport with no sideways scroll, and hovering a card (desktop) lifts it slightly.

## Clean up

This story's own testing used only real, existing accounts read-only, plus one temporary staff
login for the "My attendance" toggle check:

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const u = db.users.findOne({ email: "aas419.qa@example.com" });
if (u) {
  print("userroles:", db.userroles.deleteMany({ user: u._id }).deletedCount);
  print("users:", db.users.deleteMany({ _id: u._id }).deletedCount);
}
'
```

(Already run - the database was confirmed back to exactly its original 7 accounts before this
guide was written.)

## If something does not match

| You see | Likely cause |
|---|---|
| A day I know has attendance shows empty | Check the browser's local timezone - the calendar reads `Attendance.date`/`clockIn`/`clockOut` in UTC and displays times in the viewer's local zone; a genuinely missing day is more likely a fetch that hasn't resolved yet (compare against **Team** in List view for the same employee/month) |
| Every weekday looks "late" | Check `frontend/src/config/attendanceCalendar.js` - `LATE_CHECK_IN_AFTER`/`EARLY_CHECK_OUT_BEFORE` are local wall-clock cutoffs; a value that doesn't match the real work schedule will flag normal days |
| The List/Calendar toggle doesn't show up on Team | It only appears once a specific employee (not "All employees") is selected in the Employee filter - a calendar for everyone at once isn't meaningful |
| `?calendarDemo=1` does nothing | It's gated on `import.meta.env.DEV` - it only works running `npm run dev`, never in a production build |
| A leave day appears on the wrong side of a month boundary | Leave is clipped to the visible month from the request's real start/end dates; check the request's actual dates via **Leave → Team** if the boundary looks wrong |
