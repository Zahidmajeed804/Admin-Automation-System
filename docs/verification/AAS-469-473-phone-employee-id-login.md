# Log in and register with phone or Employee ID

After the demo, stakeholders pointed out that many staff don't have a work email.
Login now takes **one field: phone number, Employee ID or email**. Registering
needs a name, phone and password; email and Employee ID are optional. Admins create
staff with a phone and no email. Phone numbers are stored in one standard form, so
`+92 300-1234567`, `0300 1234567` and `03001234567` are the same number everywhere.

| Ticket | What it covers |
|---|---|
| AAS-469 | Email optional and phone unique (partial unique indexes), phones normalized, `npm run seed` migration |
| AAS-470 | `POST /auth/login { identifier, password }`; `{ email }` from older clients still accepted |
| AAS-471 | Register and admin staff creation without email; 409 names the clashing field |
| AAS-472 | Login, Register and Staff form/table updates |
| AAS-473 | This verification guide |

Run on 2026-10-06 over real HTTP and in real headless Chrome, against
**throwaway in-memory MongoDB** databases (no real data touched, nothing to clean
up). **10 of 10 migration checks, 29 of 29 API checks and 9 of 9 Chrome checks
passed.** The existing backend test suite still passes (329 tests).

## ⚠ After pulling: run `npm run seed`

```bash
cd backend && npm run seed
```

Existing databases have a plain unique index on `email` that allows only **one**
account without an email. The seed now runs a migration
(`backend/src/seeders/migrations.js`) that:

1. removes blank (`""` / `null`) emails and phones,
2. rewrites every phone into the standard form,
3. replaces the old email index with one that ignores accounts without an email,
   and adds the same kind of unique index for phone.

It's safe to run any number of times. If two people share a phone number, it names
them in a warning and doesn't build the phone index. Give each person their own
number and run the seed again. Until you run it, the backend still starts, but a
second account without an email is refused.

## Result of the run recorded here

### Migration (`npm run seed` on an existing-style database)

| Check | Result |
|---|---|
| Old plain `email_1` index | replaced by a unique index limited to real emails |
| Phone index | unique, limited to real phone numbers |
| `+92 300-1234567` | stored as `03001234567` |
| A blank phone `""` | removed |
| Two accounts without an email | allowed |
| Same phone typed differently (`+923001234567`) | rejected by the index |
| Same email in different case | still rejected |
| Run it a second time | nothing changes |
| Two people with one number | warning names both; phone index waits until fixed |
| Real `npm run seed` (pointed at a throwaway database), twice | completes both times |

### API

| Check | Result |
|---|---|
| Admin creates staff with phone `+92 300-12345xx` | stored as `0300…` |
| Login with email / EMAIL IN CAPITALS | 200 / 200 |
| Login with Employee ID in lower case | 200 |
| Login with phone as `0300…`, `0300 …`, `+92 300-…` | 200 each |
| Older client sending `{ email, password }` | 200 |
| Wrong password | 401, `"Invalid phone, Employee ID, email or password"` |
| Unknown identifier | 401, **same** message (doesn't reveal which accounts exist) |
| Empty identifier | 400, `"Phone, Employee ID or email is required"` |
| Deactivated account | 401 |
| Register with name + phone + password only | 201, no email, no Employee ID |
| A second account without email | 201 |
| New account logs in by phone (+92 format) | 200 |
| Register with a taken phone in another format | 409, `"An account with this phone number already exists"` |
| Register with a taken email / Employee ID | 409 naming email / Employee ID |
| Register without a phone / with `12ab` | 400, `"Phone number is required"` / `"Enter a valid phone number, …"` |
| Register with `email: ""`, `employeeId: ""` | 201, treated as not given |
| Gmail address registered as `John.Doe…@Gmail.com`, login typed `john.doe…@gmail.com` | 200 (emails are matched the way they're stored) |
| Admin creates staff with phone and no email | 201 |
| Admin creates staff without a phone | 400 |
| Admin creates staff with a taken phone (+92 form) | 409 naming phone |
| Change someone's phone to a taken one | 409 |
| Add an email later / clear it with `""` | 200 / 200, email removed |
| Staff search "0312 1234567" | finds the person stored as `03121234567` |

### Frontend (Chrome)

| Check | Result |
|---|---|
| Login page has one **Phone, Employee ID or email** field (no email-only field) | ✓ |
| Log in with the phone in `+92 300 …` format | ✓ |
| Log in with the Employee ID in lower case | ✓ |
| Wrong password shows "Invalid phone, Employee ID, email or password" on the page | ✓ |
| Register: Phone is required (*); Employee ID and Email are marked optional; registering with name, phone and password lands on the Dashboard | ✓ |
| Registering a taken phone (typed `+92…`) shows "An account with this phone number already exists" | ✓ |
| Add staff: Phone required (*), Email optional; saving without a phone shows "Phone number is required."; with a phone and no email it saves | ✓ |
| Staff table shows a **Phone** column and "—" for the missing email | ✓ |
| Staff search with "0301 …" (space) finds the person | ✓ |

## How to repeat it yourself

Takes about 10 minutes. **Run `npm run seed` first** (see above).

1. **Login page**: one field. Log in as the seeded admin with its email; it still works.
2. **Staff → Add staff**: create someone with a name, Employee ID, temporary password
   and phone `+92 300 1234567`, no email. The table shows `03001234567` and "—" for email.
3. Log out and log in as them with `0300 1234567`, then with their Employee ID.
4. **Register** (from the login page): only name, phone and password. You land on
   the Dashboard. Register again with the same phone typed as `+92…`: the page says
   the phone number already exists.
5. **Staff** search: type the phone with a space; the person is found.

## Behaviour to know about

- **One login field.** Anything with "@" is treated as an email; otherwise the
  Employee ID is tried first, then the phone number.
- **Phone format.** Spaces, dashes, dots and brackets are ignored; `+92`, `0092`
  and `92` become a leading `0`. Numbers from other countries keep their `+`.
  The rule lives in `backend/src/utils/phone.js`, mirrored in `frontend/src/utils/phone.js`.
- **Required fields.** Self-registration: name, phone, password. Admin-created staff:
  name, Employee ID, phone, password. Email is optional everywhere. Editing staff can
  clear an email or phone (leave it empty and save).
- **Older apps** that still send `{ email, password }` to `/auth/login` keep working.

## If something does not match

| You see | Likely cause |
|---|---|
| "Duplicate value" when creating a second account without email | `npm run seed` hasn't been run on this database yet |
| Seed warns "Phone … is shared by …" | two people have the same number; fix one and run the seed again |
| Login by phone fails for an older account | that account has no phone saved, or a different number; check it on the Staff page |
| "Invalid phone, Employee ID, email or password" | any of: unknown identifier, wrong password, or a deactivated account (one message on purpose) |
