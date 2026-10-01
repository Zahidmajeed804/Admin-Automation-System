# Backend foundation

Express 5 + Mongoose 9 API, ES modules. Everything lives under `backend/src`. Read this
before adding or changing anything on the backend. Per-module details are in the sibling
files of this folder.

## Folder layout

```
backend/
├── .env.example            every env var with comments
├── jest.config.js          native ESM jest, in-memory Mongo
├── src/
│   ├── server.js           entry: DNS fix → connectDatabase → cron jobs → listen
│   ├── app.js              express app + middleware chain (imported by tests)
│   ├── authorization/requirePermission.js   requirePermission / requireAnyPermission
│   ├── config/             env.js (ONLY place reading process.env), database.js, mail.js
│   ├── constants/          permissions.js (catalog + default roles), attendance.js (enums)
│   ├── controllers/        <thing>Controller.js — HTTP only
│   ├── errors/AppError.js  typed HTTP errors
│   ├── jobs/               scheduler.js (node-cron wrapper), maintenanceReminderJob.js
│   ├── middleware/         asyncHandler, authenticate, errorHandler, runValidation, uploadInvoice
│   ├── models/             Mongoose schemas + index.js re-export
│   ├── repositories/       <thing>Repository.js — thin data access
│   ├── routes/             <thing>.routes.js + index.js (mount point)
│   ├── seeders/index.js    npm run seed
│   ├── services/           <thing>Service.js — business rules
│   ├── utils/              apiResponse, dates, jwt, logger, mailer, password, emailTemplates/
│   └── validators/         <thing>Validators.js — express-validator chains
├── tests/                  jest suites + helpers/
└── uploads/                runtime files (git-ignored)
```

## Bootstrap

`src/server.js`:
1. `setServers(["1.1.1.1","8.8.8.8"])` so Atlas `mongodb+srv` URIs resolve on restrictive DNS.
2. `connectDatabase()` (`config/database.js`, `strictQuery: true`, exits on failure).
3. If `env.emailRemindersEnabled`: `registerJob("maintenance-reminders", env.reminderCronSchedule, runMaintenanceReminderJob)` then `startScheduler()`.
4. `app.listen(env.port)`, graceful shutdown on SIGINT/SIGTERM.

`src/app.js` middleware order:
`helmet` → `cors({ origin: CLIENT_ORIGIN, credentials: true, exposedHeaders: ["Content-Disposition"] })`
→ `compression` → `express.json({ limit: "10mb" })` → `urlencoded` → `cookieParser`
→ `morgan` (skipped in test) → rate limit on `/api/v1` (300 req / 15 min)
→ `routes` → `notFoundHandler` → `errorHandler`.

Mounted routers (`src/routes/index.js`, prefix `/api/v1`):

| Prefix | File |
|---|---|
| `/` | `health.routes.js` (`GET /health`) |
| `/auth` | `auth.routes.js` |
| `/rbac` | `rbac.routes.js` |
| `/users` | `user.routes.js` |
| `/generator` | `generator.routes.js` (incl. `/generator/reports/*`) |
| `/attendance` | `attendance.routes.js` |
| `/overtime` | `overtime.routes.js` |
| `/leave` | `leave.routes.js` |

`giveaway.routes.js` exists but is **not mounted** — see `giveaways.md`.

## Environment variables (`config/env.js`)

| Var | Default | Used by |
|---|---|---|
| `NODE_ENV` | `development` | morgan format, stack in errors |
| `PORT` | `5000` | server |
| `API_VERSION` | `v1` | route prefix |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/admin_automation_system` | database |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | `dev_secret_change_me` / `7d` | `utils/jwt.js` |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS |
| `OVERTIME_THRESHOLD_MINUTES` | `600` | attendance → overtime |
| `INVOICE_UPLOAD_DIR` / `INVOICE_MAX_SIZE_MB` | `uploads/invoices` / `5` | `middleware/uploadInvoice.js` |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM` | blank host → `jsonTransport` (built, not sent) | `config/mail.js` |
| `EMAIL_REMINDERS_ENABLED` | true unless `"false"` | server.js |
| `REMINDER_CRON_SCHEDULE` | `0 7 * * *` | maintenance reminder job |

Adding a var: add it to `config/env.js` **and** `.env.example` with a comment.

## Request lifecycle & conventions

```js
// routes/thing.routes.js
router.use(authenticate);
router.get("/", requirePermission("thing.read"), listThingValidator, thingController.list);

// controllers/thingController.js
list: asyncHandler(async (req, res) => {
  const { items, pagination } = await thingService.list({
    requesterId: req.userId,
    canViewAll: req.permissions.includes("thing.approve"),
    page: Number(req.query.page) || undefined,
    // ...pick each query/body field explicitly — never spread req.body
  });
  sendSuccess(res, { message: "Things", data: { things: items }, meta: pagination });
}),
```

- **Repository**: plain object of Mongoose calls, e.g. `list({...})` returning
  `{ items, totalItems }` with `Promise.all([find().sort({ date: -1, _id: -1 }).skip().limit(), countDocuments()])`.
  Use `{ returnDocument: "after" }` for updates. Model: `src/repositories/attendanceRepository.js`.
- **Service**: owns rules, throws `AppError` subclasses, builds pagination inline:
  ```js
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  return { items, pagination: { page: safePage, pageSize: safePageSize, totalItems, totalPages: Math.ceil(totalItems / safePageSize) } };
  ```
  Model: `src/services/attendanceService.js`.
- **Atomic state changes**: "decide once" flows use `findOneAndUpdate({ _id, status: "pending" }, ...)`
  and return 409 if nothing matched (see overtime/leave `reviewIfPending`). Counters use `$inc`.
  Multi-write operations compensate (undo) on failure — no transactions are used.
- **Validators**: arrays of `body()/param()/query()` chains ending in `runValidation`
  (throws `BadRequestError("Validation failed", [{ field, message }])`). Enums come from `constants/`.
- **Errors** (`errors/AppError.js`): `AppError(message, statusCode, details)`;
  `BadRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404,
  `ConflictError` 409. `middleware/errorHandler.js` also maps Mongoose `ValidationError`→400,
  duplicate key 11000→409 (`details: keyValue`), `CastError`→400; logs only unexpected 500s.
  Envelope: `{ success: false, message, details, stack? }` (no stack in production).
- **Success** (`utils/apiResponse.js`): `sendSuccess(res, { statusCode = 200, message, data, meta })`.

## Shared helpers to reuse

| Need | Use |
|---|---|
| Async controller | `middleware/asyncHandler.js` |
| Auth / permissions | `middleware/authenticate.js` (sets `req.user`, `req.userId`), `authorization/requirePermission.js` (sets `req.permissions`) |
| Day boundaries | `utils/dates.js` `startOfDay` (midnight UTC) |
| Tokens / hashing | `utils/jwt.js` (`signToken({ sub })`, `verifyToken`), `utils/password.js` (bcrypt 12) |
| Logging | `utils/logger.js` (`info/warn/error`; morgan handles requests) |
| Email | `utils/mailer.js` `mailer.sendMail({ to, subject, html, text })`; templates in `utils/emailTemplates/` |
| Who to notify | `rbacRepository.findUsersWithPermission(name)`; `services/notificationRecipients.js` |
| Employee picker | `userRepository.listAll()` / `GET /users/options` |
| Scheduled jobs | `jobs/scheduler.js` `registerJob(name, cron, fn)` |
| File uploads | `middleware/uploadInvoice.js` pattern (multer disk, UUID names, type/size checks → `BadRequestError`) |
| Report date ranges | `services/reportService.js` `resolveMonthRange`, `resolveDateRange`, `resolveYearRange` |
| Enums | `constants/attendance.js`; put new module enums in `constants/<module>.js` |

## Tests

- `npm test` → jest with `--experimental-vm-modules --runInBand`, no Babel.
- `tests/globalSetup.js` starts `MongoMemoryServer` and sets `MONGO_URI` (must not import `src/`);
  `globalTeardown.js` stops it and removes `uploads/`.
- `tests/setup.js` connects in `beforeAll`, wipes all collections except RBAC ones `afterEach`, silences `logger.info`.
- `tests/helpers/testAuth.js`: `ensureRbacSeeded()`, `createUserWithRole(roleName, overrides)` → `{ user, token }`.
- `tests/helpers/generatorTestUtils.js`: `as(user).get/post/...`, `makeUsers()` — copy this shape for a new module.
- Suites import `app` from `src/app.js` with supertest; `server.js` is never started.

## New backend module checklist

1. Enums → `constants/<module>.js`.
2. Model → `models/<Thing>.js` (`timestamps: true`, indexes), export from `models/index.js`.
3. Repository → `repositories/<thing>Repository.js`.
4. Service → `services/<thing>Service.js` (rules, typed errors, pagination shape above).
5. Validators → `validators/<thing>Validators.js`.
6. Controller → `controllers/<thing>Controller.js` (named data key, explicit fields).
7. Routes → `routes/<thing>.routes.js`, **mount in `routes/index.js`**.
8. Permissions → add to `permissionsCatalog` and the right `defaultRoles` in `constants/permissions.js`; `npm run seed`.
9. Tests → `tests/<thing>.routes.test.js` using the helpers.
10. Verification guide → `docs/verification/`, link it from `README.md`, update the module's context file.
