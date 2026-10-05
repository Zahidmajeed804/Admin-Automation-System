# CNG generators measured in kg (AAS-436–439)

Fuel types are now Diesel, Petrol and CNG (replacing "Gas"). A CNG generator's
tank capacity, opening/added/closing fuel, price and consumption are shown in
kg everywhere diesel/petrol generators show litres. The fuel-consumption
report (renamed from "Diesel Consumption" to "Fuel Consumption", including the
API route) totals litres and kg as two separate pairs and never adds them
together.

## Result of the run recorded here

Run on 2026-10-05 over real HTTP against the live MongoDB Atlas dev database,
using the already-running backend (`:5000`) and the seeded admin account. All
checks below passed. The one generator and log created for this run were
deleted afterwards (cascade-deleted its log too); confirmed gone with a 404.

### API / DB (AAS-436, AAS-438)

| Check | Result |
|---|---|
| No generator in the live DB still has `fuelType: "gas"` after the migration | 0 of 3 existing generators; only `diesel` in use |
| `POST /generator` with `fuelType: "gas"` | 400, `"fuelType must be one of: diesel, petrol, cng"` |
| `POST /generator` with `fuelType: "cng"` | 201, persisted as `"cng"` |
| `POST /generator/logs` on the CNG generator (opening 30, added 10, closing 35) | 201, `fuelConsumedLiters` computed as 5 (the field name is unchanged by design — only its displayed unit differs) |
| Old route `GET /generator/reports/diesel-consumption` | 404 (removed) |
| New route `GET /generator/reports/fuel-consumption` | 200 |
| Fuel-consumption report totals for a fleet with one CNG generator (10 added / 5 consumed) and no litre activity in range | `totalFuelAddedKg: 10`, `totalFuelConsumedKg: 5`, `totalFuelAddedLiters: 0`, `totalFuelConsumedLiters: 0` — kg and litres never combined |
| `GET /generator/logs` row's populated `generator` object | includes `fuelType` (needed by the frontend to pick L vs kg per row) |

### Backend test suite

330 passing (2 pre-existing todo), including two new cases: `getFuelConsumptionReport` keeps a litre-only and a kg-only generator's totals apart, and the `fuelType` enum round-trips through the shared constants file. Also caught and fixed a real bug from AAS-436 along the way: `FUEL_TYPES` had `"CNG"` (uppercase) instead of `"cng"`, which nothing had exercised until this subtask's test tried creating a CNG generator — a `"gas"` generator would have migrated to an enum value the validator itself would then reject.

### Frontend

Not driven in a live browser this round — no UI changes were made directly
against the dev DB and checked by eye. What's covered instead:

- The full frontend automated suite passes (19 files, 153 tests), including a
  new `GeneratorReportFuelConsumption.test.jsx` that exercises the renamed
  component's litre and kg stat cards, filtering, empty and error states.
- `vite build` succeeds with no new warnings.
- Every place that previously hardcoded "L" (generator form, log form, logs
  table, generator details, the fuel-consumption report table/stat cards) now
  derives the unit from the selected/row generator's `fuelType` via
  `frontend/src/utils/fuelUnit.js`.

If you want a real-browser pass logged here too, say so and it can be run
against the dev servers the same way earlier stories' guides were.

## How to repeat it yourself

### 1. Confirm the migration and validation

| # | Do this | You should see |
|---|---|---|
| 1 | `cd backend && npm run seed` against the dev `MONGO_URI` | log line "Migrated N generator(s) from fuelType 'gas' to 'cng'" only if any existed; silent otherwise (idempotent) |
| 2 | `POST /api/v1/generator` with `"fuelType": "gas"` | 400 validation error |
| 3 | `POST /api/v1/generator` with `"fuelType": "cng"` | 201 |

### 2. See the kg units in the UI

| # | Do this | You should see |
|---|---|---|
| 4 | Open **Generator → Registry**, add/edit a generator, set Fuel Type to CNG | "Fuel Tank Capacity (kg)" label |
| 5 | Open **Generator → Fuel & Usage Logs**, add a log for that generator | "Opening Fuel (kg)", "Fuel Added (kg)", "Price per Kg" labels; the logs table shows kg for that row |
| 6 | Open **Generator → Reports → Fuel Consumption** (renamed tab) | four stat cards: Fuel Added/Consumed in L, and in kg; a diesel generator's row shows L, a CNG generator's row shows kg |

## Clean up

Nothing left over from this run — the temp `ZZ-439-CNG` generator and its one
log were deleted via the API during the run itself (`DELETE
/generator/:id`), confirmed with a follow-up 404.

## If something does not match

| You see | Likely cause |
|---|---|
| A generator still shows "L" after being set to CNG | the unit is derived from the generator's own `fuelType` at render time — check the generator was actually saved with `fuelType: "cng"`, not just selected in the form and not submitted |
| `GET /generator/reports/diesel-consumption` still works | stale route table from a server that hasn't picked up the route rename — restart the backend |
| Fuel-consumption report shows 0 for kg even though a CNG generator has logs | check the date range filter covers the log's date; the report defaults to "this month so far" |
