# AAS-280 — Manual HTTP verification: overtime auto-trigger and approval

Story: AAS-276..279 (Overtime auto-calculation and approval API). This file records
what was verified and is also a step-by-step guide so anyone can repeat the
verification by hand. Commands are for **Git Bash** on Windows and were run exactly
as written, against a live MongoDB, on 2026-09-24.

## What you are verifying

```
Employee clocks out ──► attendanceService.clockOut
                          worked minutes > OVERTIME_THRESHOLD_MINUTES (default 600 = 10h)?
                            yes ─► pending OvertimeRequest for (worked − threshold) minutes
                            no  ─► nothing
                                        │
Manager: GET /overtime?status=pending ◄─┘
Manager: PATCH /overtime/:id/review  { decision: approved | rejected, note? }
Employee: GET /overtime  ─► sees the decision, reviewer and note
```

| Rule | Where it lives |
|---|---|
| Threshold and auto-create on clock-out | `attendanceService.clockOut`, `env.overtimeThresholdMinutes` |
| One request per attendance record | unique index in `models/OvertimeRequest.js`, upsert in `overtimeRepository.createForAttendance` |
| Staff see own requests, reviewers see all | `overtimeService.list` (reviewer = has `overtime.approve`) |
| Decide once; no self-review | `overtimeService.review` and `overtimeRepository.reviewIfPending` |
| Permissions and input checks | `routes/overtime.routes.js`, `validators/overtimeValidators.js` |

## Result of the run recorded here

**All checks passed.** To avoid waiting 10 hours, the backend was started with
`OVERTIME_THRESHOLD_MINUTES=1` and three minutes were worked.

| Check | Result |
|---|---|
| Clock out after ~3 min with a 1 min threshold | pending request for **2 min** created automatically |
| Employee who clocks in and straight out (0 min) | **no** request |
| Employee lists own requests | 1 row, `pending`, 2 min |
| Employee tries to approve | `403` (`overtime.approve` missing) |
| Manager lists `?status=pending` | sees every employee's request |
| `decision: "maybe"` / missing decision / malformed id | `400`, with `details` naming the field |
| Approve with a note | request becomes `approved` (proved by the next two rows) |
| Approve or reject the same request again | `409 Overtime request is already approved` |
| Reject another request with a note | `200`, status `rejected`, note and reviewer stored |
| Manager reviews their own request | `403 You cannot review your own overtime request` |
| Employee views result | `approved by OT manager note=Approved - busy day`; `rejected by OT manager note=Not pre-approved` |

The approve response body was not captured in this run (a typo in my run script
swallowed it). It is covered by the `409` and the employee view above, and by the
automated 25-check run for AAS-279 (approve returned `200` with reviewer and
trimmed note).

Earlier automated runs (AAS-277 to AAS-279) covered the real 10 hour rule: 9h and
exactly 10h create nothing, 11h creates 60 min, 12h30m creates 150 min, and two
reviews at the same instant produce one winner and one `409`.

All test users, attendance records, overtime requests and role links were deleted
afterwards. Nothing was left in the shared database.

---

# How to verify it yourself

Takes about 10 minutes, most of it a 3 minute wait.

## 0. One-time setup

1. Stop any backend already running on port 5000 (close its terminal, or end that
   `node` process) so you are testing the current code.
2. From the `backend` folder, give the staff role permission to see overtime. This
   only adds permissions, so it is safe to run again:

   ```bash
   cd backend
   npm run seed
   ```

   Without this, every staff account gets `403` on `GET /overtime`.
3. Start the backend with a **1 minute** overtime threshold (Git Bash):

   ```bash
   OVERTIME_THRESHOLD_MINUTES=1 npm run dev
   ```

   PowerShell: `$env:OVERTIME_THRESHOLD_MINUTES=1; npm run dev`

   Leave it running. When you finish, stop it and start normally with `npm run dev`
   so the threshold goes back to 10 hours.

4. Open a **second** Git Bash window and paste this block. Keep the window open,
   because the shortcuts only exist in that window. It needs Node.js (you have it).

   ```bash
   BASE=http://localhost:5000/api/v1
   j()     { node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); $1"; }
   login() { curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | j "d.data.token"; }
   get()   { curl -s "$BASE$1" -H "Authorization: Bearer $2"; }
   post()  { curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" ${3:+-d "$3"}; }
   patch() { curl -s -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3" -w "\nHTTP %{http_code}\n"; }
   ```

   Responses in development mode include a long `stack` field. Ignore it and read
   `message` and the `HTTP` line.

## 1. Create the test accounts

Four accounts. New registrations get the `staff` role automatically.

```bash
for n in employee1 employee2 employee3 manager; do
  curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
    -d "{\"name\":\"OT $n\",\"email\":\"ot-$n@test.local\",\"password\":\"Passw0rd1\",\"confirmPassword\":\"Passw0rd1\"}" | j "d.message"
done
```

Expect `Account created successfully` four times.

Now make `ot-manager` a real manager using the seeded admin account. If you changed
the admin password, use your current one.

```bash
ADMIN=$(login admin@admin-automation.local 'ChangeMe123!')
MGR=$(login ot-manager@test.local Passw0rd1)
MGR_ROLE=$(get /rbac/roles $ADMIN | j "d.data.find(r => r.name === 'manager')._id")
MGR_ID=$(get /auth/me $MGR | j "d.data.user._id")
post /rbac/user-roles $ADMIN "{\"userId\":\"$MGR_ID\",\"roleId\":\"$MGR_ROLE\"}" | j "d.message"
MGR=$(login ot-manager@test.local Passw0rd1)     # log in again to pick up the new role
get /auth/me $MGR | j "d.data.roles.join(',') + ' | ' + d.data.permissions.filter(p => p.startsWith('overtime')).join(',')"
```

Expect `Role assigned to user`, then `staff,manager | overtime.read,overtime.approve`.

Log in the others:

```bash
E1=$(login ot-employee1@test.local Passw0rd1)
E2=$(login ot-employee2@test.local Passw0rd1)
E3=$(login ot-employee3@test.local Passw0rd1)
```

## 2. Work a shift

Employee 1, employee 2 and the manager clock in. Employee 3 clocks in and straight
out to prove that no overtime is created below the threshold.

```bash
for t in $E1 $E2 $MGR; do post /attendance/clock-in $t | j "d.message"; done
post /attendance/clock-in  $E3 | j "d.message"
post /attendance/clock-out $E3 | j "d.message + ' worked=' + d.data.attendance.workedMinutes"
```

Expect `Clocked in successfully` x4, then `Clocked out successfully worked=0`.

**Wait about 3 minutes**, then clock the others out:

```bash
for t in $E1 $E2 $MGR; do post /attendance/clock-out $t | j "d.message + ' worked=' + d.data.attendance.workedMinutes"; done
```

Expect `worked=3` (or 2 to 4, depending on your timing). With a 1 minute threshold,
overtime is worked minutes minus 1.

## 3. Check the requests were created automatically

```bash
get /overtime $E1 | j "JSON.stringify(d.data.overtime.map(o => ({mins:o.overtimeMinutes, status:o.status, user:o.user.name})))"
get /overtime $E3 | j "'employee3 count=' + d.data.overtime.length"
```

Expect one `pending` request for employee 1 with `mins` of 2 (worked minus 1), and
`employee3 count=0`.

Save the ids for the next steps:

```bash
OT1=$(get /overtime $E1  | j "d.data.overtime[0]._id")
OT2=$(get /overtime $E2  | j "d.data.overtime[0]._id")
OTM=$(get /overtime $MGR | j "d.data.overtime.find(o => o.user.email === 'ot-manager@test.local')._id")
```

## 4. Permissions and validation

An employee must not be able to review:

```bash
patch /overtime/$OT1/review $E1 '{"decision":"approved"}'
```

Expect `HTTP 403` and `Missing required permission: overtime.approve`.

The manager sees all pending requests (the filter hides other people's real data):

```bash
get "/overtime?status=pending&pageSize=100" $MGR | j "d.data.overtime.filter(o => o.user.email.startsWith('ot-')).map(o => o.user.name + ':' + o.overtimeMinutes).join(', ')"
```

Expect `OT manager:2, OT employee2:2, OT employee1:2` in some order.

Bad input is rejected and changes nothing:

```bash
patch /overtime/$OT1/review $MGR '{"decision":"maybe"}'                    # 400 decision must be one of: approved, rejected
patch /overtime/$OT1/review $MGR '{}'                                       # 400 decision is required
patch /overtime/not-an-id/review $MGR '{"decision":"approved"}'             # 400 id must be a valid overtime request id
```

## 5. Approve, reject, and the rules around them

```bash
patch /overtime/$OT1/review $MGR '{"decision":"approved","note":"Approved - busy day"}'   # 200, status approved
patch /overtime/$OT1/review $MGR '{"decision":"rejected"}'                                  # 409 already approved
patch /overtime/$OT2/review $MGR '{"decision":"rejected","note":"Not pre-approved"}'        # 200, status rejected
patch /overtime/$OTM/review $MGR '{"decision":"approved"}'                                  # 403 cannot review your own
```

The second line proves a decision cannot be changed. The last proves a manager
cannot approve their own overtime.

## 6. What the employees see

```bash
get "/overtime?status=approved" $E1 | j "d.data.overtime.map(o => o.status + ' by ' + o.reviewedBy.name + ' note=' + o.reviewNote).join()"
get "/overtime?status=rejected" $E2 | j "d.data.overtime.map(o => o.status + ' by ' + o.reviewedBy.name + ' note=' + o.reviewNote).join()"
```

Expect `approved by OT manager note=Approved - busy day` and
`rejected by OT manager note=Not pre-approved`.

## 7. Clean up

Removes only the accounts created above and their records. It reads your database
address from `backend/.env` and needs `mongosh` (already installed):

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^ot-.*@test\.local$/ }).toArray().map(u => u._id);
print("overtimerequests:", db.overtimerequests.deleteMany({ user: { $in: ids } }).deletedCount);
print("attendances:", db.attendances.deleteMany({ user: { $in: ids } }).deletedCount);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
'
```

Expect `3`, `4`, `5`, `4` if you followed the steps exactly. Then stop the backend
and restart it without the threshold override.

## If something does not match

| You see | Likely cause |
|---|---|
| `403` on `GET /overtime` for an employee | `npm run seed` was not run, so staff lack `overtime.read` |
| `Route not found: PATCH /api/v1/overtime//review` | the id variable is empty, so the earlier list call failed. Re-run step 3 and read its output |
| No overtime request after clock-out | the backend was started without `OVERTIME_THRESHOLD_MINUTES=1`, or an old backend is still running on port 5000 |
| `Already clocked in today` | that account already used today's attendance record. Use new `ot-` emails or run step 7 |
| `Account created` fails with `already exists` | you ran step 1 before. Run step 7 first |
