# Staff management (Employee ID, staff CRUD, deactivation)

An admin (`users.manage`) can now add a staff login with a unique Employee ID they
type themselves, edit a staff member's details, search and filter the staff list,
and deactivate or re-activate an account. Deactivating blocks the login immediately,
including any token issued before the change, and keeps the person's attendance,
overtime and leave history.

Run on 2026-09-28 over real HTTP and in real headless Chrome against the live
MongoDB. **All checks below passed.** All test accounts were deleted afterwards.

## Result of the run recorded here

### API (AAS-383, AAS-384, AAS-385)

| Check | Result |
|---|---|
| Create a staff login with name, email, Employee ID, password, department | 201, staff role assigned |
| Duplicate Employee ID (`emp-test-383` vs `EMP-TEST-383`) | 409, case-insensitive collision caught |
| Duplicate email | 409 |
| Missing Employee ID | 400, validation message on the `employeeId` field |
| List with `?search=` matching name/email/Employee ID | correct row(s) only |
| Edit (e.g. department) | 200, updated document returned |
| Deactivate (`isActive:false`) | 200 |
| Login with the deactivated account | 401 "Invalid email or password" (same generic message as a wrong password — no account-exists leak) |
| Existing token used after deactivation (`GET /auth/me`) | 401 **"Your account has been deactivated. Contact an administrator."** — rejected on the very next request, no separate revocation list needed |
| Re-activate, then log in again | succeeds |
| Admin tries to deactivate their own account | 400 "You cannot deactivate your own account" |
| Staff (no `users.manage`) calls `GET /users` | 403 "Missing required permission: users.manage" |

### Frontend — Staff page (AAS-386)

| Check | Result |
|---|---|
| Page title, section nav includes "Staff" | present |
| Table headers: Employee ID, Name, Email, Status | present |
| Real staff rows load from the live database | 7/7 accounts shown |
| Search box present, narrows to the matching row | 1 row for an exact name match |
| Status filter present, "Inactive" shows the empty state | "No matching staff" |

### Frontend — Add/edit form (AAS-387)

| Check | Result |
|---|---|
| "Add staff" opens a modal titled "Add staff" | ✓ |
| Create disabled while the form is empty | ✓ |
| Weak password (too short) shows a hint, not a silent failure | "At least 8 characters." |
| Create enables once every field is valid | ✓ |
| Successful create closes the modal and the new row appears | ✓ |
| Duplicate Employee ID on create shows a server error inside the modal, and the modal **stays open** (entered data isn't lost) | ✓ |
| "Edit" on a row opens a modal titled "Edit staff", pre-filled, **no password field** | ✓ |
| Saving an edit (e.g. department) updates the row | ✓ |

## How to repeat it yourself

Takes about 5 minutes with the backend and frontend already running
(`npm run dev` in both `backend` and `frontend`) against a live `MONGO_URI`.

### 1. Create and validate (as an admin)

| # | Do this | You should see |
|---|---|---|
| 1 | Log in as an account with `users.manage` (the seeded admin has it), open **Attendance → Staff** | the staff directory table |
| 2 | Click **Add staff**, leave everything empty | **Create staff** is disabled |
| 3 | Fill in Name, Employee ID (e.g. `EMP-100`), Email, a password under 8 characters | a hint appears under Password and Create stays disabled |
| 4 | Fix the password to 8+ characters with a number, submit | modal closes, the new row appears with that Employee ID |
| 5 | Click **Add staff** again, reuse the same Employee ID (any case) | a red error banner names the Employee ID conflict; the modal stays open |

### 2. Edit and search

| # | Do this | You should see |
|---|---|---|
| 6 | Click **Edit** on the new row | a form pre-filled with their details, **no password field** |
| 7 | Change the Department, save | the row updates in place |
| 8 | Type part of their name into the search box | the list narrows to that one row |
| 9 | Set the Status filter to **Inactive** | empty state, since nobody is deactivated yet |

### 3. Deactivate and confirm it blocks access

| # | Do this | You should see |
|---|---|---|
| 10 | Log in as the new staff member in a second browser/incognito window, keep that tab open | a normal session |
| 11 | Back as admin, click **Deactivate** on their row, confirm | status badge turns "Inactive" |
| 12 | In the staff member's tab, click anything that calls the API (e.g. refresh Attendance) | they are signed out with "Your account has been deactivated. Contact an administrator." |
| 13 | Try logging that account back in | "Invalid email or password" |
| 14 | As admin, click **Activate** on their row | status turns "Active"; they can log in again |
| 15 | Try deactivating your own (admin) account | a clear error; the action is refused |

## Clean up

Staff created through the UI have no delete endpoint by design (removal =
deactivation, to keep history). To fully remove **test** accounts created while
verifying this, delete them directly:

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^emp1?00.*@test\.local$/ }).toArray().map(u => u._id);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
'
```

Adjust the email pattern to match whatever test address you used.

## If something does not match

| You see | Likely cause |
|---|---|
| 403 on `/attendance/staff` or the Staff link is missing from the nav | the logged-in account lacks `users.manage` — only the seeded admin (or a role granted it) has it |
| Deactivated account can still call the API for a while | shouldn't happen — `authenticate` re-checks `isActive` on every request via `userRepository.findById`, no caching involved |
| "An account with this Employee ID already exists" on a value that looks different | Employee ID is case-insensitive and stored uppercased on purpose |
| Create/edit modal shows a generic error instead of the specific message | check the backend is actually running against the same `MONGO_URI` the frontend expects; the modal surfaces `err.response.data.message` verbatim |
