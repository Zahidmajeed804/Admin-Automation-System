# AAS-96 — Manual HTTP verification: attendance filters, pagination and edit

Story: AAS-93..95 (Attendance listing, filters & manager edit). Verified over real
HTTP against a live MongoDB using three fresh accounts: staff A, staff B, and a
manager (staff account promoted to the `manager` role). Past-day records were
seeded straight into the database as test setup (clock-in only ever creates
"today"); every assertion below went through the API.

Seed data: A has 12 records (Aug 1–12, 2026: 8 present, 2 half-day, 2 late),
B has 3 records (Aug 3–5).

**Result: 41 / 41 checks passed.**

## Pagination — `GET /attendance?userId=A&pageSize=5`

| Check | Result |
|---|---|
| Pages 1–4 | 5, 5, 2 and 0 rows; `meta.totalPages` = 3, `totalItems` = 12 |
| Rows across all pages | no duplicates, none missing |
| Ordering | newest date first, consistently across pages |
| No `pageSize` given | defaults to 20 |

## Filters (manager)

| Query | Result |
|---|---|
| `status=half-day` / `status=late` (A) | 2 / 2 |
| `startDate=2026-08-03&endDate=2026-08-06` | 4 |
| `startDate=2026-08-10` only | 3 |
| `endDate=2026-08-02` only | 2 |
| `status=half-day&startDate=2026-08-01&endDate=2026-08-05` | 1 |
| Range with no data (2030) | 0 rows, `totalPages` 0 |
| No `userId` | both A's and B's records returned |
| `userId=B` | only B's 3 records |

## Scoping (staff)

| Request | Result |
|---|---|
| Staff A, no filter | only A's 12 records |
| Staff A with `?userId=B` | still only A's records (param ignored, not rejected) |
| Staff B | only B's 3 records |
| No token | `401` |

## List validation

`page=0`, `pageSize=101`, `status=bogus`, `userId=nope`, `startDate=x`, and
`endDate` before `startDate` each return `400`.

## Edit — `PATCH /attendance/:id` (manager, A's Aug 5 record)

| Step | Result |
|---|---|
| `clockOut` moved to 12:00 | `workedMinutes` 180, status `half-day`; A's half-day count in the list goes 2 → 3 |
| `status: "late"` | explicit status wins, `workedMinutes` untouched; list shows late 3 / half-day 2 |
| `clockIn` 08:00 + `clockOut` 18:00 + padded `notes` | 600 min, status `present`, notes trimmed; persisted on re-read |
| `clockOut` before `clockIn` | `400` |
| `clockIn` on a different day | `400` |
| Empty body / bad status / malformed id | `400` |
| Unknown id | `404` |
| Staff account (no `attendance.update`) | `403` |
| No token | `401` |

All test users, user-role links and attendance records (3 / 4 / 15) were deleted
afterwards — no test data left in the shared database.
