# Monthly overtime and attendance summary

After the demo, stakeholders asked for a monthly view of overtime (per person and
total for all staff) and each person's attendance %, with filters, in the
Attendance module and on the Dashboard. There's now an **Attendance › Summary**
page with month, employee and designation filters, stat cards, two pie charts and
a per-person table, plus a compact version on the **Dashboard**.

| Ticket | What it covers |
|---|---|
| AAS-458 | `GET /api/v1/attendance/summary?month&userId&designationId`: per-person overtime, day counts, leave days; totals |
| AAS-459 | Working days, approved leave on working days, attendance %, average % |
| AAS-460 | Summary page: filters, stat cards, table; "Summary" in the Attendance section nav |
| AAS-461 | Overtime-share pie; attendance-breakdown pie for one employee |
| AAS-462 | "Overtime & attendance" section on the Dashboard, linking to the full page |
| AAS-463 | This verification guide |

Run on 2026-10-06 over real HTTP and in real headless Chrome, against a
**throwaway in-memory MongoDB** (no real data touched, nothing to clean up).
**22 of 22 API checks and 14 of 14 Chrome checks passed.**

## How the numbers are worked out

- **Month**: calendar month, `YYYY-MM` (default: this month).
- **Overtime**: sum of overtime requests dated in the month. *Approved* and
  *pending* are shown separately; rejected overtime is left out.
- **Day counts**: attendance records in the month by stored status (present,
  late, half-day, absent).
- **Leave days**: approved leave days falling in the month (calendar days; a
  request crossing months is split).
- **Working days**: Monday–Friday from the 1st up to **today** (whole month for a
  past month, 0 for a future month).
- **Attendance %** = (present + late + ½ × half-day) ÷ (working days − approved
  leave on working days), to 1 decimal, capped at 100%. Empty ("—") when there
  are no working days to measure against yet.
- **Average attendance** = mean of everyone listed who has a %.
- **Who is listed**: everyone with attendance, overtime or leave that month, plus
  every **active** staff member who has a **designation** (so someone absent all
  month still shows at 0%). Filtering by one employee always shows that person.
- **Who sees what**: `attendance.update` (managers, admin) see everyone and can
  filter; everyone else sees only their own row — the API ignores their filters.

## Result of the run recorded here

Seeded September 2026 (22 working days; 1 Sep is a Tuesday) straight into the
throwaway database, because the API can only record *today's* attendance:

| Person | Designation | Attendance | Overtime | Approved leave |
|---|---|---|---|---|
| A | Engineer | 15 present, 1 late, 2 half-day, 1 absent | 90 + 30 min approved, 45 pending | 28 Sep – 2 Oct |
| B | Engineer | 20 present | 60 rejected, 20 pending | — |
| C | none | 5 present | — | — |
| D | none | — | — | — |
| E | Engineer, **deactivated** | — | — | — |

### API

| Check | Result |
|---|---|
| Manager, `month=2026-09` | 200 |
| Who is listed | A, B, C (not idle D without designation, not deactivated E) |
| A's counts | present 15, late 1, half-day 2, absent 1 |
| A's overtime | 120 min approved, 45 pending |
| A's leave 28 Sep – 2 Oct | 3 days in September |
| B's overtime | rejected 60 ignored; 20 pending |
| Rows carry the designation | A: Engineer; C: `null` |
| Totals | 120 approved, 65 pending; `staffCount` = rows |
| `designationId` = Engineer | A and B only |
| `userId` = C | C only |
| `userId` = D (no activity) | D's row with zeros |
| Staff A asks for B with a designation filter | only A's own row |
| `month=2026-13` | 400, `"month must be in YYYY-MM format"` |
| No month | the current month |
| No token | 401 |
| Working days in September 2026 | 22 |
| A's leave on working days | 3 (Mon–Wed 28–30 Sep) |
| A's attendance % | (15 + 1 + 0.5×2) ÷ (22 − 3) = **89.5%** |
| B's / C's attendance % | 20 ÷ 22 = **90.9%** / 5 ÷ 22 = **22.7%** |
| Average for Engineer (A, B) | **90.2%** |
| `month=2099-01` | 0 working days, every % and the average `null` |

### Frontend (Chrome)

| Check | Result |
|---|---|
| **Summary** appears in the Attendance section nav and opens the page | ✓ |
| Filters: Month (defaults to this month), Employee, Designation | ✓ |
| September: rows for A, B, C with "2h 0m", "+45m pending", day counts, "89.5%" badge | ✓ |
| Designation filter: 2 rows; stat cards **2h 0m** approved, **1h 5m** pending, **90.2%** average | ✓ |
| Employee filter: only C | ✓ |
| **Reset** returns to this month and all employees | ✓ |
| **Overtime share** pie with a legend of names, time and share | ✓ |
| Choosing one employee adds the **Attendance breakdown** pie (Present / Late / Half-day / Absent / Leave with days and %) | ✓ |
| A month or person with no approved overtime shows "No approved overtime this month." instead of an empty pie | ✓ |
| Dashboard (manager): "Overtime & attendance" stat cards, overtime pie, **View full summary** link | ✓ |
| The link opens Attendance › Summary | ✓ |
| Staff: only their own row, no Employee/Designation filters | ✓ |
| Staff: Dashboard shows their own month | ✓ |
| 400px wide: no sideways page scroll (the table scrolls inside itself) | ✓ |

## How to repeat it yourself

Takes about 10 minutes with the backend and frontend running. Nothing new to seed.

1. Make sure staff have designations (**Staff → Designations**) and some
   attendance this month (clock in/out, or a manager correction).
2. As a manager or admin, open **Attendance → Summary**. Pick a month; check the
   stat cards and table against the Team views on the Attendance and Overtime pages.
3. Pick one employee: the breakdown pie appears; its numbers match their row.
4. Open the **Dashboard**: the same totals for this month, with a link to the page.
5. Log in as a staff member: Summary and Dashboard show only their own month.

## Behaviour to know about

- **Late** is a stored status. Nothing sets it automatically yet (the calendar's
  red "late" colouring is display-only), so it's usually 0 unless a manager sets it.
- **Today counts as a working day** in the current month, so someone who hasn't
  clocked in yet today is slightly lower until they do.
- **Weekend work** counts towards attendance, which is why % is capped at 100.
- **Colours**: the pies use a fixed, colour-blind-checked palette
  (`categoricalPalette` in `frontend/src/config/theme.js`); the top five people get a
  colour each and the rest fold into a grey "Others" slice. Every slice is also named
  in the legend with its value, so colour is never the only cue.

## If something does not match

| You see | Likely cause |
|---|---|
| Someone missing from the list | no designation and no attendance/overtime/leave that month — give them a designation, or filter to them |
| Attendance % shows "—" | a future month, or all of their working days were approved leave |
| Overtime looks low | only **approved** overtime counts in the pie and the main figure; pending is shown separately |
| A staff member sees only themselves | expected — the team view needs `attendance.update` |
