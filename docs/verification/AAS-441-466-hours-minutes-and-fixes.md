# Hours and minutes, tag-reuse fix, fuel-cost per hour, calendar date picker (AAS-441–466)

Running hours (meter readings, log hours, maintenance intervals) now display and
are entered as "Xh Ym" instead of a raw decimal, with the underlying backend
rounding fixed to the nearest **minute** rather than 2 decimal places — so 20
minutes (0.333... hours) round-trips exactly instead of being truncated to
0.33. Three unrelated fixes rode along in the same story, each with its own
subtask: a generator-tag reuse bug, the Fuel Cost report's average now being
per running hour instead of per litre/kg, and every date field in the module
switching from a plain text box to the calendar picker already used in
Attendance.

## Result of the run recorded here

Run on 2026-10-05. Backend/DB checks below were run for real over HTTP
against the live MongoDB Atlas dev database, using the already-running
backend (`:5000`) and the seeded admin account. All checks passed. The one
generator and log created for this run were deleted afterwards; confirmed
gone with a 404.

### API / DB (AAS-441, AAS-464, AAS-465)

| Check | Result |
|---|---|
| Log a new entry with `hoursRun: 4.333333...` (4h 20m) | saved and reflected in `runningHoursTotal` exactly, no precision loss |
| Correct that log's `hoursRun` to `5` (a +20 minute delta) via `PATCH /generator/logs/:id` | generator's `runningHoursTotal` becomes exactly `5`, confirming the delta rounds to the nearest minute (`*60/60`), not 2 decimals (`*100/100`, the pre-AAS-441 bug) |
| `GET /generator/reports/fuel-cost` for that generator (500 cost / 4.33h) | `averageCostPerHour: 115.47`; field renamed from `averageCostPerLiter`, computed from hours run, not fuel added |
| **Tag-reuse bug (AAS-464):** `npm run seed` against the dev DB | logged "Dropped the non-partial 'tag_1' unique index on generators"; migration ran for real, not just in tests |
| `POST /generator` with the exact real-world repro — `tag: "4"`, which had been blocked by a legacy soft-deleted GEN-004 row | **201**, generator created — confirms the actual reported bug is fixed on the real dev DB, not just in the test suite |

### Backend test suite

348 passing (2 pre-existing todo). New/changed coverage: `hoursMinutes.js` round-to-minute and formatting helpers; the email templates' hours display; `generatorService.updateLog`'s minute-precision delta; the generator-tag partial index (a dedicated migration test that recreates the old non-partial index, proves reuse is blocked beforehand, runs the migration, and proves reuse works afterward — plus an idempotency check); `reportService.getFuelCostReport`'s new `averageCostPerHour`, including a mixed diesel+CNG case showing the average is unaffected by the litres/kg split.

### Frontend

Not driven in a live browser this round for the new UI (the Hours+Minutes
boxes and the calendar date picker) — no manual click-through against the
dev DB was done. What's covered instead:

- The full frontend automated suite passes (23 files, 183 tests), including:
  - `hoursMinutes.js` and `HoursMinutesInput.jsx` unit/component tests (split/combine, 20-minute exactness, the clock-style minute carry-over e.g. 75m → 1h 15m).
  - Every generator form/page/report updated to use `HoursMinutesInput` or `formatHoursMinutes` has its existing tests updated to match, plus a couple of new ones that specifically type into the minutes box and assert the combined decimal sent to the server.
  - `DueInfo.test.jsx` and `GeneratorMaintenanceDetails.test.jsx` are new — "Due in"/"Overdue by" and the maintenance details modal weren't under test before this story.
  - Every date field across the module (generator install date, log date, maintenance scheduled/completed date, and every report's From/To filter) now renders and is driven through the real `DatePicker` component (a new shared test helper, `src/test/datePicker.js`, opens it, navigates months, and clicks the day) instead of typing into a native date box.
- `vite build` succeeds with no new warnings.

If you want a real-browser pass logged here too, say so and it can be run
against the dev servers the same way earlier stories' guides were.

## How to repeat it yourself

### 1. Hours and minutes

| # | Do this | You should see |
|---|---|---|
| 1 | Open **Generator → Fuel & Usage Logs**, add a log, type `4` in the Hours box and `20` in the Minutes box for Hours Run | nothing rounds away; saving and reopening the entry still shows `4h 20m` |
| 2 | Open the generator's registry row, or its details modal | running hours shown as `Xh Ym`, not a decimal |
| 3 | Open **Generator → Maintenance**, a job with an hours-based interval | "Due in Xh Ym" / "Overdue by Xh Ym" |

### 2. Generator tag reuse

| # | Do this | You should see |
|---|---|---|
| 4 | Delete a generator, then add a new one with the exact same tag | succeeds — no "duplicate tag" error |

### 3. Fuel Cost report

| # | Do this | You should see |
|---|---|---|
| 5 | Open **Generator → Reports → Fuel Cost** | the average-cost stat card and column read "Average Cost / Hour" / "Avg Cost / Hour" |

### 4. Calendar date picker

| # | Do this | You should see |
|---|---|---|
| 6 | Open any generator/log/maintenance form, or a report's From/To filter | a calendar opens instead of a native date box; pick a day, OK commits it, Cancel/Escape discards it |

## Clean up

Nothing left over from this run — the temp `ZZ-445` generator and its one
log were deleted via the API during the run itself, confirmed with a
follow-up 404. The tag-reuse check from AAS-464's own subtask (temp
generator tagged `"4"`) was likewise deleted during that subtask's work.

## If something does not match

| You see | Likely cause |
|---|---|
| An hours field still shows a decimal | check the specific file actually imports `formatHoursMinutes`/`HoursMinutesInput` — a few report/detail surfaces were updated individually in AAS-444, grep `toFixed\|formatNumber(.*hours` for stragglers |
| Tag reuse still blocked on a given dev DB | the migration only runs on `npm run seed` — confirm it was run against that specific DB and the log line "Dropped the non-partial…" (or no line, if already migrated) appeared |
| Fuel Cost report 500s or shows undefined | confirm the backend was restarted after pulling these changes — the repository aggregation pipeline shape changed |
