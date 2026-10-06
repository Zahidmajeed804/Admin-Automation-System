# Edit dates of long leave requests before review

After the demo, reviewers asked to be able to change the dates of a long leave
request before approving or rejecting it, instead of rejecting it and asking the
person to apply again. Pending requests applied for **more than 2 days** now
have an **Edit dates** action. The reviewer picks new dates, the request is
re-checked, and then they approve or reject it as usual. What the person
originally applied for is kept and shown as an **"Edited · was N days"** badge.

| Ticket | What it covers |
|---|---|
| AAS-452 | `originalStartDate`, `originalEndDate`, `originalTotalDays`, `editedBy`, `editedAt` on `LeaveRequest` |
| AAS-453 | `PATCH /api/v1/leave/:id/dates` with permission, length, overlap and balance checks |
| AAS-454 | **Edit dates** dialog from the Pending approvals and Team tabs |
| AAS-455 | "Edited · was N days" badge in the Pending, Team and My leave requests tables |
| AAS-456 | This verification guide |

Run on 2026-10-06 over real HTTP and in real headless Chrome, against a
**throwaway in-memory MongoDB** (no real data touched, nothing to clean up).
**18 of 18 API checks and 11 of 11 Chrome checks passed.**

## Result of the run recorded here

Setup: *LD Staff* (casual 10, sick 5, annual 20 days) and *LD Manager* (manager
role). Staff requests: casual 5 days, casual 2 days, annual 3 days (approved),
unpaid 16 days.

### API

| Check | Result |
|---|---|
| Edit the 2-day request | 400, `"Only requests longer than 2 days can have their dates changed"` |
| Manager shortens the 5-day request to 3 days | 200, `"Leave dates changed to 3 days"`; `totalDays: 3` |
| …applied dates and day count kept | `originalTotalDays: 5`, original start/end dates |
| …who and when | `editedBy` = LD Manager (populated), `editedAt` set |
| Edit the same request again, down to 2 days | 200: judged on the **applied** 5 days; originals unchanged |
| Send the same dates again | 400, `"These are already the request's dates"` |
| New dates overlapping the approved annual leave | 409, `"These dates overlap an approved leave request of the same person"` |
| 9 casual days when 8 are free (10 − the other pending 2) | 400, `"Only 8 casual days left for 2026"` |
| 8 casual days | 200: the request's own days don't count against itself |
| Balance afterwards | casual: 10 allocated, 10 pending, 0 remaining |
| Unpaid request shortened | 200, no balance check |
| End date before start | 400 |
| Admin edits their own request | 403, `"You cannot change the dates of your own leave request"` |
| Staff (no approve/reject permission) edits | 403 |
| Edit an approved request | 409, `"Leave request is already approved"` |
| Edit after approving the edited request | 409 |
| `GET /leave` | edited request carries `originalTotalDays`, `editedBy`; an unedited one has no original fields |

### Frontend (Chrome)

| Check | Result |
|---|---|
| Pending approvals: a pending 6-day request has **Edit dates**; a pending 2-day request doesn't | ✓ |
| The dialog names the person and leave type and shows "Applied for 6 days: …"; **Save dates** is disabled until the dates change | ✓ |
| Picking a new **To** date shows a live "3 days" | ✓ |
| Saving updates the row and shows "Dates changed for LD Staff: now 3 days (…), applied for 6. Approve or reject it when ready." | ✓ |
| Dates overlapping an approved request show the server's message inside the dialog | ✓ |
| The **Team** tab offers **Edit dates** on the pending request, not on approved ones | ✓ |
| Team tab shows **"Edited · was 6 days"** on the edited request and nothing on others | ✓ |
| Pending approvals shows the same badge | ✓ |
| Hovering the badge: "Applied for 6 days: <dates>. Dates changed by LD Manager on <date>." | ✓ |
| The staff member sees the badge on their own request in **My leave requests** | ✓ |

## How to repeat it yourself

Takes about 10 minutes with the backend and frontend running. Nothing new to seed.

1. Give a staff member some annual leave (**Staff → Leave** on their row).
2. Log in as them and request **6 days** of annual leave. Also request a
   **2-day** leave.
3. Log in as a manager or admin, open **Attendance → Leave → Pending approvals**.
   The 6-day request has **Edit dates**; the 2-day one doesn't.
4. Click **Edit dates**, move **To** so it's 3 days, and **Save dates**. The
   banner and the row show 3 days, with **Edited · was 6 days** under it.
5. Approve or reject it as usual. Log back in as the staff member: **My leave
   requests** shows the badge too, and the balance cards count 3 days, not 6.

## Behaviour to know about

- **"More than 2 days" means what was applied for.** A 6-day request shortened
  to 2 days can still be adjusted again; a request applied for 2 days never can.
  The threshold is `LEAVE_DATES_EDITABLE_AFTER_DAYS` in
  `backend/src/constants/attendance.js`, mirrored in `frontend/src/utils/leaveFormat.js`.
- **Only while pending.** Once approved or rejected, dates are final.
- **Same rules as a new request.** New dates can't overlap the person's other
  pending or approved leave and must fit their yearly balance (except unpaid).
  The request's own current days are left out of both checks.
- **The applied dates never change.** They're saved on the first edit and kept
  through later edits.
- **Anyone who can approve or reject leave can edit dates.** Nobody can edit
  their own request.

## If something does not match

| You see | Likely cause |
|---|---|
| No **Edit dates** button | the request was applied for 2 days or less, or it's no longer pending |
| **Edit dates** is greyed out | it's your own request |
| "Only N … days left" | the new range is longer than the person's remaining balance (their other pending and approved leave counts) |
| "These dates overlap …" | the person already has pending or approved leave on some of those days |
| "Leave request was reviewed in the meantime" | someone approved or rejected it while the dialog was open; refresh the list |
