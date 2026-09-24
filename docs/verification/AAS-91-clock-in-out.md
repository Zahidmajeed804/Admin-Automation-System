# AAS-91 — Manual HTTP verification: clock-in/out flow

Story: AAS-86..90 (Attendance data model & clock-in/out API). Verified against a
live MongoDB, over real HTTP, using a freshly registered staff account.

| Step | Request | Result |
|---|---|---|
| 1 | `GET /attendance/me/today` before any clock-in | `200`, `data.attendance: null` |
| 2 | `POST /attendance/clock-in` | `201`, record created with `status: "present"` |
| 3 | `POST /attendance/clock-in` again | `409 Already clocked in today` |
| 4 | `GET /attendance/me/today` after clock-in | `200`, reflects the in-progress record |
| 5 | `POST /attendance/clock-out` | `200`, `clockOut`/`workedMinutes` set, `status` recomputed |
| 6 | `POST /attendance/clock-out` again | `409 Already clocked out today` |
| 7 | `GET /attendance/me/today` with no `Authorization` header | `401 Authentication token missing` |

Test user and its attendance record were deleted after verification — no test
data left in the shared database.
