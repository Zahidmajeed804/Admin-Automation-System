# Assign leave per person or by designation

After the demo, admins asked to set leave allocations **staff by staff**, or in
bulk for everyone with a given **designation**, instead of only "everyone at
once". The bulk dialog on the Staff page is now **Assign leaves**, with an
**Apply to** choice (all active staff, or one designation). Each staff row has a
**Leave** action that opens that person's own casual / sick / annual days,
prefilled with what they have now.

| Ticket | What it covers |
|---|---|
| AAS-447 | `PUT /users/leave-allocation/all` accepts an optional `designationId` |
| AAS-448 | "Apply to" choice in the Assign leaves dialog, banner names the designation |
| AAS-449 | Per-person **Leave** action on each staff row (`PATCH /users/:id { leaveAllocation }`) |
| AAS-450 | This verification guide |

This closes the **Known gap** recorded in
[`AAS-400-406-leave-quotas.md`](AAS-400-406-leave-quotas.md): an individual's
allocation can now be set from the UI.

Run on 2026-10-06 over real HTTP and in real headless Chrome, against a
**throwaway in-memory MongoDB** (no real data touched, nothing to clean up).
**15 of 15 API checks and 11 of 11 Chrome checks passed.** The existing backend
test suite still passes (329 tests).

## Result of the run recorded here

Setup: designations *LA Engineer* (8h) and *LA Office Boy* (9h); staff E1, E2
(Engineer), E3 (Engineer, **deactivated account**), B1 (Office Boy), N1 (no
designation), M1 (manager).

### API

| Check | Result |
|---|---|
| Bulk 5/3/10 to Engineer, fill only | 200, matched **2**, modified 2 (E1, E2) |
| …E3 (inactive account), B1 and N1 | untouched (0/0/0) |
| Same call again | matched **0** (already set) |
| Bulk 6/4/12 to Engineer with overwrite | matched 2, both now 6/4/12 |
| Bulk 2/2/2 with no designation, fill only | B1 and N1 filled; Engineers (already set) left alone |
| `designationId` that doesn't exist | 404, `"Designation not found"` |
| Malformed `designationId` | 400 |
| Office Boy designation deactivated, then bulk to it with overwrite | matched 1, B1 updated (people who still hold it get leave too) |
| `PATCH /users/:id { leaveAllocation: { casual: 9 } }` | 200, **9/2/2**: sick and annual kept |
| Same with all three | 200, 9/5/15 |
| Negative days | 400 |
| Manager calls the bulk endpoint / the per-person update | 403 / 403 (both need `users.manage`) |

### Frontend (Chrome)

| Check | Result |
|---|---|
| **Assign leaves** dialog has **Apply to**: "All active staff", "LA Engineer", "LA Office Boy (inactive)" | ✓ |
| Picking a designation changes the helper ("Only active staff with the LA Engineer designation.") and the overwrite text ("…every active LA Engineer…") | ✓ |
| Apply 3/2/8 with overwrite to LA Engineer → banner "Leave allocation applied to 2 of 2 matching staff member(s) with the LA Engineer designation." | ✓ |
| A server error (designation not found) shows inside the dialog | ✓ |
| Every staff row has a **Leave** action | ✓ |
| It opens with that person's days prefilled (3/2/8), names them, and has no Apply to / overwrite controls | ✓ |
| Change only Casual to 12 → banner "Leave allocation saved for LA E1: 12 casual, 2 sick, 8 annual days a year."; reopening shows **12/2/8** | ✓ |
| The other Engineer still shows 3/2/8 | ✓ |
| **Save** is disabled while a field is empty or negative, and until something changes | ✓ |
| At 400px wide the row action is reachable and the dialog fits without sideways page scroll | ✓ |

## How to repeat it yourself

Takes about 10 minutes with the backend and frontend running. Nothing new to
seed. You need at least one designation (**Staff → Designations**, see
[`AAS-430-434-shift-by-designation.md`](AAS-430-434-shift-by-designation.md)).

### 1. Bulk by designation

1. As an admin, open **Attendance → Staff → Assign leaves**.
2. In **Apply to**, pick a designation. The helper text names it.
3. Fill Casual / Sick / Annual, tick **Overwrite** if people already have an
   allocation, and **Apply**. The banner says how many of how many staff with
   that designation changed.
4. Open **Leave** on someone with that designation: the new numbers are there.
   Someone with a different designation is unchanged.

### 2. One person

1. On any staff row, click **Leave**. Their current days are filled in.
2. Change one type (e.g. Casual) and **Save**. The banner repeats all three
   numbers; the other two are unchanged.
3. Log in as that person and open **Leave**: the balance cards use the new
   allocation.

## Behaviour to know about

- **Fill only vs overwrite.** Without **Overwrite**, bulk only fills people whose
  three types are all 0 or unset, so per-person values aren't lost. With
  **Overwrite**, bulk replaces them.
- **Only active accounts** are touched by bulk. Deactivated staff keep what they had.
- **Inactive designations** are listed (marked "(inactive)") because the people
  who still hold them need leave too.
- **Per-person saves send only the types you changed.** If two admins edit the
  same person at once, each one's changed types are kept.

## If something does not match

| You see | Likely cause |
|---|---|
| Bulk says **0** changed | everyone targeted already has an allocation (tick **Overwrite**), or they're all deactivated |
| A designation is missing from **Apply to** | the list failed to load; the helper text says so, and only "All active staff" is available until you reopen the dialog |
| **Save** stays disabled in the per-person dialog | nothing changed yet, or a field is empty / negative / not a whole number |
| A manager can't see the **Leave** action | the Staff page needs `users.manage`, which managers don't have by default |
