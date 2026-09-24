# AAS-290 — Manual HTTP verification: leave request and approval

Story: AAS-287..289 (Leave request and approval API). This file records what was
verified and is also a step-by-step guide so anyone can repeat the verification by
hand. Commands are for **Git Bash** on Windows and were run exactly as written,
against a live MongoDB, on 2026-09-24.

## What you are verifying

```
Employee: POST /leave  { leaveType, startDate, endDate, reason? }
            ├─ dates must be valid, end not before start           ─► 400
            ├─ overlaps their own pending/approved leave           ─► 409
            └─ otherwise a pending request, totalDays computed     ─► 201

Manager:  GET /leave                      everyone's requests (filters, paging)
Manager:  PATCH /leave/:id/review  { decision: approved | rejected, note? }
            approving needs leave.approve, rejecting needs leave.reject
            decided once (409), never your own request (403)

Rejected leave frees its days again; approved leave keeps them.
```

| Rule | Where it lives |
|---|---|
| Day count, overlap check, review rules | `services/leaveService.js` |
| Overlap query and atomic "only if still pending" update | `repositories/leaveRepository.js` |
| Permissions (approve and reject are separate) | `routes/leave.routes.js` |
| Input checks | `validators/leaveValidators.js` |
| Fields and allowed values | `models/LeaveRequest.js` |

## Result of the run recorded here

**All checks behaved as expected.** Four accounts were used: two employees, a
manager, and an approver who can approve but not reject.

| Check | Result |
|---|---|
| Submit casual leave 10 to 12 Mar 2030 | created, `days=3`, `pending` |
| Second employee submits the same dates | allowed (overlap is per person) |
| Unknown leave type | `400` `leaveType must be one of: casual, sick, annual, unpaid` |
| End date before start date | `400` `endDate must not be before startDate` |
| Missing dates | `400` `startDate is required; endDate is required` |
| Overlapping own pending leave (12 to 14 Mar) | `409` `You already have a pending leave request overlapping these dates` |
| The next day (13 Mar) | created |
| Employee lists own | 2 requests |
| Manager lists all | sees both employees |
| Filters `status=pending&leaveType=sick`, and a date window of 11 Mar | return the matching requests only |
| Employee tries to approve | `403` `Missing one of required permissions: leave.approve, leave.reject` |
| `decision: "maybe"` | `400` `decision must be one of: approved, rejected` |
| Approver (approve-only) tries to reject | `403` `Missing required permission: leave.reject` |
| Approver approves with a note | `approved by LV approver note=Enjoy the break` |
| Manager tries to reject the approved request | `409` `Leave request is already approved` |
| Manager rejects the other request with a note | `rejected by LV manager note=Team is short that week` |
| New request on a day inside approved leave | `409` `You already have an approved leave request overlapping these dates` |
| New request on a day of the rejected leave | created (rejected leave freed the day) |
| Manager approves their own request | `403` `You cannot review your own leave request` |
| Employees view results | each sees the reviewer and note |

An automated run (52 checks) also covered the reject-only user (can reject but not
approve), mass-assignment protection, list validation errors, and paging.

All test accounts, leave requests, role links and the temporary role were deleted
afterwards. Nothing was left in the shared database.

---

# How to verify it yourself

Takes about 10 minutes.

## 0. One-time setup

1. Stop any backend already running on port 5000 (close its terminal, or end that
   `node` process) so you are testing the current code.
2. From the `backend` folder start it:

   ```bash
   cd backend
   npm run dev
   ```

   No seeding is needed. The staff role already has `leave.read` and
   `leave.create`, and the manager role has `leave.approve` and `leave.reject`.

3. Open a **second** Git Bash window and paste this block. Keep the window open,
   because the shortcuts only exist in that window. It needs Node.js.

   ```bash
   BASE=http://localhost:5000/api/v1
   j()     { node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); $1"; }
   login() { curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | j "d.data.token"; }
   get()   { curl -s "$BASE$1" -H "Authorization: Bearer $2"; }
   post()  { curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" ${3:+-d "$3"}; }
   patch() { curl -s -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
   show()  { j "(d.success ? 'OK   ' : 'FAIL ') + d.message + (d.details ? ' -> ' + d.details.map(x => x.message).join('; ') : '')"; }
   ```

   `show` prints one line per response: `OK` for success, `FAIL` plus the reason
   otherwise. Many steps below are *supposed* to print `FAIL`, because they test
   that bad requests are refused.

## 1. Create the test accounts

Four accounts. New registrations get the `staff` role automatically.

```bash
for n in employee1 employee2 manager approver; do
  curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
    -d "{\"name\":\"LV $n\",\"email\":\"lv-$n@test.local\",\"password\":\"Passw0rd1\",\"confirmPassword\":\"Passw0rd1\"}" | j "d.message"
done
```

Expect `Account created successfully` four times.

Make `lv-manager` a real manager using the seeded admin account. If you changed the
admin password, use your current one.

```bash
ADMIN=$(login admin@admin-automation.local 'ChangeMe123!')
MGR=$(login lv-manager@test.local Passw0rd1)
MGR_ROLE=$(get /rbac/roles $ADMIN | j "d.data.find(r => r.name === 'manager')._id")
MGR_ID=$(get /auth/me $MGR | j "d.data.user._id")
post /rbac/user-roles $ADMIN "{\"userId\":\"$MGR_ID\",\"roleId\":\"$MGR_ROLE\"}" | show
MGR=$(login lv-manager@test.local Passw0rd1)     # log in again to pick up the new role
get /auth/me $MGR | j "d.data.roles.join(',') + ' | ' + d.data.permissions.filter(p => p.startsWith('leave')).join(',')"
```

Expect `OK   Role assigned to user`, then
`staff,manager | leave.read,leave.approve,leave.reject,leave.create`.

Now give `lv-approver` a role that can approve but **not** reject. This proves the
two permissions are separate.

```bash
APPR=$(login lv-approver@test.local Passw0rd1)
APPR_ID=$(get /auth/me $APPR | j "d.data.user._id")
LV_ROLE=$(post /rbac/roles $ADMIN '{"name":"lv-approve-only","description":"temp"}' | j "d.data._id")
P_APPROVE=$(get /rbac/permissions $ADMIN | j "d.data.find(p => p.name === 'leave.approve')._id")
post /rbac/role-permissions $ADMIN "{\"roleId\":\"$LV_ROLE\",\"permissionId\":\"$P_APPROVE\"}" | show
post /rbac/user-roles $ADMIN "{\"userId\":\"$APPR_ID\",\"roleId\":\"$LV_ROLE\"}" | show
APPR=$(login lv-approver@test.local Passw0rd1)
get /auth/me $APPR | j "d.data.permissions.filter(p => p.startsWith('leave')).join(',')"
```

Expect two `OK` lines, then `leave.read,leave.create,leave.approve` (no
`leave.reject`).

Log in the employees:

```bash
E1=$(login lv-employee1@test.local Passw0rd1)
E2=$(login lv-employee2@test.local Passw0rd1)
```

## 2. Submit leave

```bash
L1=$(post /leave $E1 '{"leaveType":"casual","startDate":"2030-03-10","endDate":"2030-03-12","reason":"Family event"}' | j "d.data.leave._id")
L2=$(post /leave $E2 '{"leaveType":"sick","startDate":"2030-03-10","endDate":"2030-03-12"}' | j "d.data.leave._id")
echo "L1=$L1 L2=$L2"
get /leave $E1 | j "d.data.leave.map(l => l.leaveType + ' ' + l.startDate.slice(0,10) + '..' + l.endDate.slice(0,10) + ' days=' + l.totalDays + ' ' + l.status).join()"
```

Expect two ids, then `casual 2030-03-10..2030-03-12 days=3 pending`. Employee 2
uses the same dates on purpose: overlap is only checked per person.

## 3. Bad input is refused

```bash
post /leave $E1 '{"leaveType":"holiday","startDate":"2030-05-01","endDate":"2030-05-01"}' | show   # unknown type
post /leave $E1 '{"leaveType":"casual","startDate":"2030-05-05","endDate":"2030-05-01"}' | show    # end before start
post /leave $E1 '{"leaveType":"casual"}' | show                                                     # dates missing
```

Expect `FAIL Validation failed -> ...` with the reason for each.

## 4. Overlap rule

```bash
post /leave $E1 '{"leaveType":"annual","startDate":"2030-03-12","endDate":"2030-03-14"}' | show   # touches 12 Mar
post /leave $E1 '{"leaveType":"sick","startDate":"2030-03-13","endDate":"2030-03-13"}' | show      # the day after
```

Expect `FAIL You already have a pending leave request overlapping these dates`, then
`OK   Leave request submitted`.

## 5. Lists and filters

The manager list is filtered to your `lv-` accounts so other people's real data is
not shown.

```bash
get /leave $E1 | j "'employee1 sees ' + d.data.leave.length + ' requests'"
get /leave $MGR | j "'manager sees requests from: ' + [...new Set(d.data.leave.filter(l => l.user.email.startsWith('lv-')).map(l => l.user.name))].sort().join(', ')"
get "/leave?status=pending&leaveType=sick" $MGR | j "d.data.leave.filter(l => l.user.email.startsWith('lv-')).map(l => l.user.name + ':' + l.leaveType).join()"
get "/leave?startDate=2030-03-11&endDate=2030-03-11" $MGR | j "d.data.leave.filter(l => l.user.email.startsWith('lv-')).map(l => l.user.name).sort().join()"
```

Expect `employee1 sees 2 requests`, `LV employee1, LV employee2`,
`LV employee1:sick,LV employee2:sick`, and `LV employee1,LV employee2` (both have
leave covering 11 Mar).

## 6. Who may review

```bash
patch /leave/$L1/review $E1 '{"decision":"approved"}' | show     # an employee
patch /leave/$L1/review $MGR '{"decision":"maybe"}' | show       # not a real decision
patch /leave/$L1/review $APPR '{"decision":"rejected"}' | show   # approve-only user rejecting
```

Expect:

- `FAIL Missing one of required permissions: leave.approve, leave.reject`
- `FAIL Validation failed -> decision must be one of: approved, rejected`
- `FAIL Missing required permission: leave.reject`

## 7. Decisions and what they do to the calendar

```bash
patch /leave/$L1/review $APPR '{"decision":"approved","note":"Enjoy the break"}' | j "d.message + ' | ' + d.data.leave.status + ' by ' + d.data.leave.reviewedBy.name + ' note=' + d.data.leave.reviewNote"
patch /leave/$L1/review $MGR '{"decision":"rejected"}' | show
patch /leave/$L2/review $MGR '{"decision":"rejected","note":"Team is short that week"}' | j "d.message + ' | ' + d.data.leave.status + ' by ' + d.data.leave.reviewedBy.name + ' note=' + d.data.leave.reviewNote"
```

Expect:

- `Leave request approved | approved by LV approver note=Enjoy the break`
- `FAIL Leave request is already approved` (a decision cannot be changed)
- `Leave request rejected | rejected by LV manager note=Team is short that week`

Now the effect on the calendar. Employee 1's leave was approved, employee 2's was
rejected, and both covered 11 Mar:

```bash
post /leave $E1 '{"leaveType":"casual","startDate":"2030-03-11","endDate":"2030-03-11"}' | show
post /leave $E2 '{"leaveType":"casual","startDate":"2030-03-11","endDate":"2030-03-11"}' | show
```

Expect `FAIL You already have an approved leave request overlapping these dates`
for employee 1 (approved leave keeps its days) and `OK   Leave request submitted`
for employee 2 (rejected leave freed them).

## 8. A manager cannot approve their own leave

The manager also has the staff role, so they can submit leave.

```bash
LM=$(post /leave $MGR '{"leaveType":"annual","startDate":"2030-07-01","endDate":"2030-07-05"}' | j "d.data.leave._id")
patch /leave/$LM/review $MGR '{"decision":"approved"}' | show
```

Expect `FAIL You cannot review your own leave request`.

## 9. What the employees see

```bash
get "/leave?status=approved" $E1 | j "d.data.leave.map(l => l.status + ' by ' + l.reviewedBy.name + ' note=' + l.reviewNote).join()"
get "/leave?status=rejected" $E2 | j "d.data.leave.map(l => l.status + ' by ' + l.reviewedBy.name + ' note=' + l.reviewNote).join()"
```

Expect `approved by LV approver note=Enjoy the break` and
`rejected by LV manager note=Team is short that week`.

## 10. Clean up

Removes only the accounts, leave requests and temporary role created above. It
reads your database address from `backend/.env` and needs `mongosh`.

```bash
cd backend
URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-)
mongosh "$URI" --quiet --eval '
const ids = db.users.find({ email: /^lv-.*@test\.local$/ }).toArray().map(u => u._id);
print("leaverequests:", db.leaverequests.deleteMany({ user: { $in: ids } }).deletedCount);
print("userroles:", db.userroles.deleteMany({ user: { $in: ids } }).deletedCount);
print("users:", db.users.deleteMany({ _id: { $in: ids } }).deletedCount);
const role = db.roles.findOne({ name: "lv-approve-only" });
if (role) {
  print("role permissions:", db.rolepermissions.deleteMany({ role: role._id }).deletedCount);
  print("roles:", db.roles.deleteOne({ _id: role._id }).deletedCount);
}
'
```

Expect `5`, `6`, `4`, `1`, `1` if you followed every step exactly.

## If something does not match

| You see | Likely cause |
|---|---|
| `Route not found: PATCH /api/v1/leave//review` | the id variable is empty, so step 2 failed. Re-run it and read the output |
| `Route not found` on any `/leave` request | an old backend is still running on port 5000 |
| Step 6 shows `Missing required permission: leave.approve` for the manager | the manager login was not refreshed after the role was assigned. Re-run the `MGR=$(login ...)` line |
| Approver can also reject | the approver got the manager role by mistake, or your `staff` role was edited to include `leave.reject` |
| `Account created` fails with `already exists` | you ran step 1 before. Run step 10 first |
| Overlap step returns `OK` instead of `FAIL` | the dates in step 2 were changed, or the first request failed to save |
