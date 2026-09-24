# AAS-302 — End-to-end verification: attendance, overtime and leave

Story: AAS-301 wrap-up, S2.6.1. One pass through the real screens as a **staff
member** and then a **manager**, from creating the account to seeing the final
decisions. It records what was checked and is also a step-by-step guide you can
repeat by hand in the browser.

Run on 2026-09-24 in real Chrome against the live MongoDB, driving the actual
Register, Login, Attendance, Overtime and Leave pages. **All 33 checks passed.**

The Dashboard is still the "Coming Soon" placeholder for Module 6, so it takes no
part in this pass beyond being the page you land on after signing in.

## The flow

```
STAFF                                           MANAGER
1  Register, land on the Dashboard
2  Sidebar shows Attendance, Overtime, Leave
3  Attendance: Clock in
4  Leave: request casual (3 days) and sick (1 day)
5  ...work ~3 minutes, then Clock out
   └─ overtime request is created automatically
6  Overtime page: 1 pending request
                                               7  Login, open Overtime: the request is waiting
                                               8  Overtime: Approve with a note
                                               9  Leave: Approve casual, Reject sick (with notes)
                                              10  Attendance > Team: staff member's day is there
                                              11  Overtime and Leave: nothing left waiting
12 Sign back in: Overtime approved,
   Leave approved and rejected, each with
   the manager's name and note
```

## Result of the run recorded here

To avoid waiting 10 hours, the backend was started with a **1 minute** overtime
threshold, so about 3 minutes of work produced 2 minutes of overtime.

| Step | Checked | Result |
|---|---|---|
| 1 | Register page signs the new user in | lands on `/dashboard` (the Coming Soon placeholder) |
| 2 | Sidebar | Attendance, Overtime and Leave are listed |
| 3 | Attendance page | not clocked in, no Team tab. **Clock in** works, status becomes Clocked in |
| 4 | Leave page | casual 10 to 12 Apr 2035 (3 days) and sick 5 May 2035 (1 day) submitted. Banner shows "(3 days)". Table lists both as Pending |
| 5 | Clock out after about 2.5 minutes | status Clocked out. History row: worked **3m** |
| 6 | Overtime page (staff) | 1 row: **2m**, Pending (worked 3m minus the 1m threshold). No "Pending approvals" section |
| 7 | Manager logs in through the Login page | lands on `/dashboard` |
| 8 | Overtime page (manager) | Pending approvals lists the staff member with 2m. Approve with a note. Row disappears |
| 9 | Leave page (manager) | both requests listed with type, dates, days and reason. Approve casual with a note, Reject sick with a note |
| 10 | Attendance, Team tab, filter by the staff member | clock in, clock out, **3m**, **Half Day** |
| 11 | Manager: Overtime and Leave, Pending approvals | the staff member no longer appears in either |
| 12 | Staff signs back in: Overtime | **Approved**, by the manager, note "Thanks for staying late" |
| 12 | Staff: Leave | casual **Approved** ("Enjoy the time off"), sick **Rejected** ("Short-staffed that day") |
| 13 | Database | attendance worked 3, overtime 2 min approved and linked to that attendance, leave 3 and 1 days with the right statuses and reviewer |
| | Browser console | no errors during the whole pass |

Why the day shows **Half Day**: the rule is under 4 hours worked means Half Day.
Three minutes is under that, so this is expected in a short test. A real 10-hour
day is Present.

All test accounts, attendance, overtime and leave records and the temporary role
were deleted afterwards. Nothing was left in the shared database.

---

# How to repeat it yourself

Takes about 15 minutes, including a 3 minute wait.

## 0. Setup

1. Stop any backend running on port 5000, then start it with a **1 minute**
   overtime threshold. From the `backend` folder in Git Bash:

   ```bash
   OVERTIME_THRESHOLD_MINUTES=1 npm run dev
   ```

   PowerShell: `$env:OVERTIME_THRESHOLD_MINUTES=1; npm run dev`

2. Start the frontend if it is not running: `npm run dev` in `frontend`
   (opens on `http://localhost:5173`).

3. Give the staff role permission to see overtime (adds permissions only, safe to
   repeat). Without it, staff cannot open the Overtime page:

   ```bash
   cd backend
   npm run seed
   ```

4. Create the two accounts through the **Register** page
   (`http://localhost:5173/register`). Use any password with a number in it,
   for example `TestPass123`:

   | Name | Email |
   |---|---|
   | E2E Staff | `e2e.staff@test.local` |
   | E2E Manager | `e2e.manager@test.local` |

   Register the manager first, then **Sign out** from the user menu (top right),
   so you can register the staff member.

5. Make the manager a real manager. There is no screen for roles, so use the admin
   account with these commands in Git Bash (change the admin password if you have
   changed it):

   ```bash
   BASE=http://localhost:5000/api/v1
   j()     { node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); $1"; }
   login() { curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | j "d.data.token"; }
   get()   { curl -s "$BASE$1" -H "Authorization: Bearer $2"; }
   ADMIN=$(login admin@admin-automation.local 'ChangeMe123!')
   MGR=$(login e2e.manager@test.local TestPass123)
   MGR_ROLE=$(get /rbac/roles $ADMIN | j "d.data.find(r => r.name === 'manager')._id")
   MGR_ID=$(get /auth/me $MGR | j "d.data.user._id")
   curl -s -X POST $BASE/rbac/user-roles -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d "{\"userId\":\"$MGR_ID\",\"roleId\":\"$MGR_ROLE\"}" | j "d.message"
   ```

   Expect `Role assigned to user`.

## 1. As the staff member

Log in as `e2e.staff@test.local` (registering already signs you in). You land on
the Dashboard, which is a "Coming Soon" page for now.

| # | Do this | You should see |
|---|---|---|
| 1 | Look at the sidebar | Attendance, Overtime and Leave are listed |
| 2 | Click **Attendance**, then **Clock in** | status becomes "Clocked in at HH:MM", the button changes to Clock out. **Note the time** |
| 3 | Click **Leave**, then **Request leave**. Type **Casual leave**, From **10/04/2035**, To **12/04/2035**, Reason "Family event". **Submit request** | green banner "...(3 days). It is pending approval." |
| 4 | Request again: **Sick leave**, From and To **05/05/2035**, no reason | the table lists both requests as **Pending** |
| 5 | **Wait until about 3 minutes have passed since clock in** | |
| 6 | Click **Attendance**, then **Clock out** | "Clocked out", "Done for today". History row shows worked **3m** (2 to 4m is fine) |
| 7 | Click **Overtime** | one request, Pending, for **worked minutes minus 1** (2m for a 3m day). No "Pending approvals" section |

## 2. As the manager

**Sign out**, then log in through the Login page as `e2e.manager@test.local`.

| # | Do this | You should see |
|---|---|---|
| 8 | Click **Overtime** in the sidebar | **Pending approvals**: E2E Staff, today, 2m (real people's requests may be listed too) |
| 9 | Click **Approve** on that row, type the note "Thanks for staying late", confirm | the dialog closes and the row disappears |
| 10 | Click **Leave** in the sidebar | **Pending approvals** lists both requests, with type, dates, days and reason |
| 11 | **Approve** the casual leave with the note "Enjoy the time off" | row disappears |
| 12 | **Reject** the sick leave with the note "Short-staffed that day" | row disappears |
| 13 | **Attendance**, then the **Team** tab. Pick **E2E Staff** in the Employee filter | one row: clock in, clock out, **3m**, **Half Day** |
| 14 | Open **Overtime** and **Leave** again | E2E Staff no longer appears in either Pending approvals table |

## 3. As the staff member again

**Sign out**, log in as `e2e.staff@test.local`.

| # | Do this | You should see |
|---|---|---|
| 15 | **Overtime** | the request is **Approved**, Reviewed by E2E Manager, note "Thanks for staying late" |
| 16 | **Leave** | casual is **Approved** ("Enjoy the time off"), sick is **Rejected** ("Short-staffed that day"), both reviewed by E2E Manager. Nothing is Pending |

## 4. Clean up

Removes only the two accounts above and their records. It reads your database
address from `backend/.env` and needs `mongosh`:

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^e2e\..*@test\.local$/ }).toArray().map(u => u._id);
print("overtimerequests:", db.overtimerequests.deleteMany({ user: { $in: ids } }).deletedCount);
print("leaverequests:", db.leaverequests.deleteMany({ user: { $in: ids } }).deletedCount);
print("attendances:", db.attendances.deleteMany({ user: { $in: ids } }).deletedCount);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
'
```

Expect `1`, `2`, `1`, then the number of role links (3 to 4), then `2`.

Finally stop the backend and start it normally with `npm run dev`, so the overtime
threshold goes back to 10 hours.

## If something does not match

| You see | Likely cause |
|---|---|
| Staff is sent to "Unauthorized" when opening Overtime | `npm run seed` was not run, so staff lack `overtime.read` |
| No overtime request after clocking out | the backend was not started with `OVERTIME_THRESHOLD_MINUTES=1`, or less than about 2 minutes were worked (the 1 minute threshold needs at least 2 minutes worked) |
| The manager has no "Pending approvals" and only sees their own data | the manager role was not assigned, or you have not logged out and in again since assigning it |
| More requests listed for the manager than you created | other people's real requests are pending as well. Look for the E2E Staff rows |
| Pages suddenly fail to load during repeated testing | the backend limits each address to 300 requests per 15 minutes. Wait a few minutes or restart the backend |
| Register says the email is taken | the accounts already exist from an earlier run. Run step 4 (Clean up) first |
