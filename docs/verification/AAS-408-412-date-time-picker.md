# Date and date-time picker

Every plain `<input type="date">` and `<input type="datetime-local">` in
Module 5 is now a custom popover picker: a button-styled field opens a
calendar (`components/common/DatePicker.jsx`), or a calendar plus Hour/Minute
selects for clock times (`components/common/DateTimePicker.jsx`). Both stage
a selection on click and only commit it through `onChange` on **OK** —
**Cancel**, **Escape**, or a click outside discard it. No new dependency;
built in Tailwind on top of plain JS date math.

Run on 2026-09-28 over real HTTP and in real headless Chrome (including a
375px mobile viewport) against a live MongoDB. **55 of 55 Chrome checks
passed** (two failed on the first pass — both my own test's fault, not the
app's, see below). Every test account created for this was removed
afterwards; the database is back to exactly its original 7 real accounts.

## Where it's used

| Field | Component |
|---|---|
| Request leave: From / To | `DatePicker` |
| Team Attendance / Team Overtime / Team Leave filters: From / To | `DatePicker` (`clearable`) |
| Edit attendance: Clock in / Clock out | `DateTimePicker` |

## Result of the run recorded here

### Core behavior (mouse) — 24 checks

| Check | Result |
|---|---|
| Every field listed above renders as a `<button>`, not a native `<input>` | ✓ |
| Clicking the field opens a popover with the correct `aria-label` | ✓ |
| Today's cell is visibly marked | ✓ |
| Clicking a day only stages it — the field's own text doesn't change yet | ✓ |
| **Cancel** discards the staged day; the field keeps its old value | ✓ |
| **OK** commits the staged day; the field updates | ✓ |
| Request leave: "To" follows "From" when From moves past it | ✓ |
| Team filters: the clear (×) button appears once a date is set, and clears it | ✓ |
| Edit attendance: `DateTimePicker` popover has Hour and Minute selects, and committing updates the field | ✓ |
| Cancelling the whole Edit attendance dialog makes no real change | ✓ |

### Keyboard, ARIA and focus — 21 checks

| Check | Result |
|---|---|
| The day grid has `role="grid"` with `role="row"`/`role="gridcell"`/`role="columnheader"` children | ✓ |
| Exactly one day has `tabindex="0"` (roving tabindex); every other day is `-1` | ✓ |
| Opening the popover moves real focus onto that day | ✓ |
| ArrowRight/Left move focus ±1 day, ArrowUp/Down ±7 days | ✓ |
| Home/End move focus to the Sunday/Saturday of the focused day's week | ✓ |
| PageUp/PageDown move the focused day back/forward a month (clamped, so 31 Jan → 28/29 Feb) | ✓ |
| Shift+PageUp/PageDown move back/forward a year | ✓ |
| **Enter commits the focused day immediately — the same as clicking OK** — and closes the popover | ✓ |
| Focus returns to the trigger field after the popover closes, however it closes (OK, Cancel, Escape) | ✓ |
| **Escape closes only the picker's own popover, not an enclosing modal** (a real bug caught here — see below) | ✓ |
| Tab is trapped inside the open popover (Prev month → Next month → the focused day → [Hour → Minute, `DateTimePicker` only] → Cancel → OK → wraps back to Prev month) and Shift+Tab reverses it | ✓ |
| Every day button has a full accessible name via `aria-label` (e.g. "Monday, September 28, 2026") | ✓ |
| Arrow-key navigation never lands focus on a `min`/`max`-disabled day, even when driven past the boundary repeatedly | ✓ |

### min/max and mobile — 4 checks

| Check | Result |
|---|---|
| Request leave "To" has `min={From}`: every day before it is disabled, From-and-later stays enabled | ✓ |
| At a 375px viewport, the popover's right edge stays inside the viewport (no horizontal overflow) | ✓ |
| Day cells are 36×36px at mobile width — comfortably touch-sized | ✓ |
| `DateTimePicker`'s popover (calendar + Hour/Minute selects) also fits a 375px viewport | ✓ |

## A real bug caught while testing, fixed before committing

Escape closed the picker's popover, but it **also closed the whole modal
it lived in** (Request leave, Edit attendance). Both `DatePicker`/
`DateTimePicker` and the shared `Modal` component listen for Escape on
`document`; a keypress fires every `document` listener that's currently
registered, and `Modal`'s had been added first (when the modal itself
opened), so calling `stopPropagation()` in the picker's own listener came
too late to stop it.

Fixed by moving Escape handling out of the picker's `document` listener and
into a regular React `onKeyDown` on the popover element itself. A real
keypress starts at the focused day (inside the popover) and bubbles up
through actual DOM ancestors — so handling it there, then calling
`stopPropagation()`, stops it before it ever reaches `Modal`'s `document`
listener. The outside-click listener (for closing the popover when you
click elsewhere) stays on `document`, since it isn't affected by this — a
mousedown "outside the field" was never controversial about which layer
should own it.

## Two of my own test bugs (not app bugs), fixed along the way

- **"Today is ring-highlighted"** failed on the first pass. Opening a picker
  with no existing value stages *today* as the current pick by design, so
  today renders as **selected** (filled) rather than ring-outlined — the
  ring is only shown for "today" when today isn't the staged day. The app
  was right; the test's assumption wasn't. Fixed the assertion to accept
  either rendering.
- **Mobile viewport checks** first failed because the test resized
  `document.documentElement.style.width`, which only changes the `<html>`
  element's box — not the actual browser viewport that CSS media queries
  (`sm:`) respond to. Fixed by adding a real `Emulation.setDeviceMetricsOverride`
  helper to the test driver and using that instead.

## How to repeat it yourself

1. As any user, open **Leave → Request leave**. Click **From** — a calendar
   popover opens with today staged. Click a day (it only stages), click
   **Cancel** — the field is unchanged. Reopen, pick a day, click **OK** —
   the field updates and **To** follows it if To was before it.
2. Tab to a picker field and press Enter/Space to open it (or click it).
   Use arrow keys to move around the grid, Home/End for the start/end of
   the week, PageUp/PageDown for the month, Shift+PageUp/PageDown for the
   year. Press Enter on a day — it commits immediately, same as OK.
3. Press Escape while the popover is open — only the popover closes, the
   modal underneath stays open. Press it again — now the modal closes too
   (that Escape reaches `Modal`'s own listener normally, since nothing
   intercepts it once the popover isn't there to catch it first).
4. Open **Attendance → Overtime/Leave → Team**, or the Team Attendance
   table (as a manager/admin): the From/To filters are the same picker
   with a clear (×) that appears once a date is set.
5. As a manager/admin, **Attendance → Team → Edit** a record: Clock in and
   Clock out are the date-**and-time** picker, with Hour/Minute selects
   under the calendar.
6. Shrink the window to phone width — the popover still fits without
   spilling off-screen, and the day cells stay comfortably tappable.

## Clean up

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^aas41[0-9]\.qa@example\.com$/ }).toArray().map(u => u._id);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
'
```

## If something does not match

| You see | Likely cause |
|---|---|
| Enter on a day does nothing | Focus isn't actually on a day cell — click a day first, or Tab into the popover; Enter is bound to the day grid, not the field button |
| Escape closes the whole form, not just the calendar | You pressed it while the calendar was already closed — the first Escape closes the calendar, a second closes the modal (expected; see the bug writeup above for why it doesn't cascade in one press) |
| A day I expect to be pickable is disabled | Check `min`/`max` on that field — e.g. Request leave's "To" can't go before "From" |
| The popover looks clipped on a very narrow screen | It's capped at `calc(100vw - 2rem)`, so it should shrink to fit; if it still overflows, check for a non-standard zoom level or an ultra-narrow (<300px) viewport, which wasn't tested |
