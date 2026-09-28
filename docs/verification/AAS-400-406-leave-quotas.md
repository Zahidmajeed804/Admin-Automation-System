# Leave quotas

Each staff member now has a yearly leave allowance per type (casual, sick,
annual — unpaid leave stays unlimited), set by an admin either per person or
for everyone at once. Requesting leave checks the balance and is refused if
it would go over; a "days left" hint and balance cards show the numbers
before that happens.

Run on 2026-09-28 over real HTTP and in real headless Chrome against the live
MongoDB. **Every API check and 20 of 20 Chrome checks passed** (two of the
Chrome checks first failed on my own test's string matching — the app's
messages were correct and the tests were fixed, see below). All test
accounts, their leave requests, and every temporary allocation change to real
accounts were removed afterwards; the seven real accounts were confirmed back
to exactly their pre-test state.

## Result of the run recorded here

### API

| Check | Result |
|---|---|
| Create a staff login with `leaveAllocation: {casual, sick, annual}` | stored correctly |
| `PATCH /users/:id` with only `leaveAllocation.casual` | merges — `sick`/`annual` untouched (dot-path update, not a subdocument replace) |
| Request more days than the allocation | 400, `"Only N <type> day(s) left for <year>"` |
| Request within the allocation | 201, created |
| `GET /leave/balance` after a pending request | `pending` reflects it, `remaining` drops |
| A second request once `remaining` is 0 | 400, `"Only 0 ... left"` |
| Unpaid leave, any length | always allowed, no balance involved |
| Rejecting a request | frees the balance (`pending` back to 0) |
| A request spanning New Year's Eve (28 Dec – 3 Jan) | checked against **each** year's own allocation independently, both passed |
| `GET /leave/balance?userId=` as a reviewer (`leave.approve`) | returns the target user's balance |
| Same `?userId=` as plain staff | silently ignored — their own balance comes back, not the other user's |
| `PUT /users/leave-allocation/all`, fill-only (`overwrite:false`) | matched every active account with no allocation set (**a real bug was caught and fixed here** — see below); left already-set accounts alone |
| Same call run again immediately | matched 0 — already-filled accounts are correctly skipped |
| Same call with `overwrite:true` | updates every active account, including already-set ones |
| Non-admin calling the assign-all endpoint | 403 |

**Bug caught while testing, fixed before committing:** the first version of
the "fill only unset accounts" filter looked for `leaveAllocation.casual: 0`
etc. That matches an explicit `0`, but accounts created before this feature
existed have no `leaveAllocation` field **at all** — Mongoose only fills in
the schema default when a document is *read*, not inside a raw query filter.
Real accounts (Jack, Jacke, Majid, System Administrator, ...) were silently
skipped by the first version. Fixed by matching `{ $not: { $gt: 0 } }`
instead, which catches 0, `null`, and "field missing" alike. Re-tested and
confirmed all 7 real accounts were correctly included afterward, then
restored to their unset state.

### Frontend (Chrome)

| Check | Result |
|---|---|
| Leave page shows three balance cards (Casual/Sick/Annual) with correct allocated/remaining/pending/used | ✓ |
| Request leave modal shows "N days left this year" under Leave type | ✓ |
| A range longer than the remaining balance shows an inline message and disables Submit | ✓ |
| Reducing the range back under the balance re-enables Submit | ✓ |
| Switching to Unpaid leave hides the balance hint and never disables Submit | ✓ |
| Staff page: "Assign leaves to all" button opens a dialog with 3 number fields + an overwrite checkbox | ✓ |
| Apply is disabled until all three fields are filled | ✓ |
| Submitting shows a success banner with the matched/modified counts, and real accounts were verifiably updated | ✓ |
| **Full loop**: staff submits → balance card shows it pending → admin approves from the Team tab → staff's balance card updates to show it used, no longer pending | ✓ |

## How to repeat it yourself

Takes about 10 minutes with the backend and frontend running against a live
`MONGO_URI`.

### 1. Give someone a small allocation and watch it work

1. As an admin, create a staff login from **Attendance → Staff** with e.g.
   `casual: 2` (the create form doesn't expose sick/annual/casual fields
   individually yet — see **Known gap** below — so set this via the API, or
   use **Assign leaves to all** for a quick round number everyone shares).
2. Log in as that staff member, open **Leave** — three balance cards show
   allocated/remaining for Casual, Sick, Annual.
3. Click **Request leave**, pick Casual, and a 3-day range. A message names
   the days actually left and **Submit** is disabled. Shorten it to 2 days —
   the message clears and Submit re-enables.
4. Submit. The balance card updates immediately to show it **pending**.
5. As a manager or admin, open **Leave → Team**, approve it. Log back in as
   the staff member — the card now shows it **used**, not pending.

### 2. Assign to everyone at once

1. As an admin, **Attendance → Staff → Assign leaves to all**.
2. Fill in Casual/Sick/Annual and leave **Overwrite** unchecked, then Apply.
   The banner names how many of how many active accounts changed.
3. Run it again with the same numbers — the banner should now say **0**
   changed, since everyone already has that allocation.
4. Check **Overwrite** and Apply again — this time everyone changes, even
   the ones already set.

## Known gap

The **Add/edit staff** form does not have Casual/Sick/Annual fields — only
**Assign leaves to all** and direct API calls (`PATCH /users/:id` with a
`leaveAllocation` object) can set an individual's allocation differently from
the shared bulk value. The backend fully supports it (this was tested above);
it just isn't wired into that form. This wasn't part of the tickets for this
story; flagging it here in case a follow-up ticket is wanted.

## Clean up

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^(s4|aas40)[0-9.]*\..*@example\.com$/ }).toArray().map(u => u._id);
print("leave:", db.leaverequests.deleteMany({ user: { $in: ids } }).deletedCount);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
'
```

If you ran **Assign leaves to all** against real accounts while testing,
restore them afterward (there is no UI for this — it is a one-off cleanup
step, not a feature):

```bash
mongosh "$URI" --quiet --eval 'db.users.updateMany({}, { $unset: { leaveAllocation: "" } })'
```

## If something does not match

| You see | Likely cause |
|---|---|
| A request under the allocation is still refused | pending requests count against the balance too, not just approved ones — check `GET /leave/balance` for the real `pending` figure |
| The remaining-days hint never appears in the modal | leave type is Unpaid (by design, no hint) — switch types |
| "Assign leaves to all" says 0 changed but you expected more | either everyone already has an allocation (check **Overwrite**), or every candidate is inactive (`isActive: true` is part of the filter) |
| A year-crossing request behaves oddly | each calendar year is checked against that year's own allocation independently; a request that's fine for one year and over budget for the other is refused, naming the year that failed |
