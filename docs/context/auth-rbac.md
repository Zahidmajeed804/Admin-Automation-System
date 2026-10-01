# Module 1 — Authentication & database-driven RBAC

**Status:** done. Every other module depends on it — change it carefully.

## Principle

Authorization is **data**. The chain is
`users → user_roles → roles → role_permissions → permissions`, resolved from MongoDB on
every request. No code checks role names. Granting access = a data change (via `/rbac` or the
seeder), not a code change.

## Backend

| Piece | File |
|---|---|
| Models | `models/User.js`, `Role.js`, `Permission.js`, `UserRole.js`, `RolePermission.js` |
| Catalog + default roles (seed data only) | `constants/permissions.js` |
| Seeder | `seeders/index.js` (`seedPermissions`, `seedRoles`, `seedRbacCatalog`, `seedDefaultAdmin`) |
| Auth | `routes/auth.routes.js`, `controllers/authController.js`, `services/authService.js`, `validators/authValidators.js` |
| RBAC admin | `routes/rbac.routes.js`, `controllers/rbacController.js`, `repositories/rbacRepository.js` |
| Middleware | `middleware/authenticate.js`, `authorization/requirePermission.js` |
| Helpers | `utils/jwt.js` (payload `{ sub: userId }`), `utils/password.js` (bcrypt, 12 rounds) |

### Endpoints (`/api/v1`)

| Method & path | Guard | Notes |
|---|---|---|
| `POST /auth/register` | public | password ≥ 8 chars with a digit + `confirmPassword`; new user gets `staff` role |
| `POST /auth/login` | public, 20 req / 15 min | rejects inactive users; sets `lastLoginAt` |
| `GET /auth/me` | `authenticate` | returns `{ user, roles, permissions }` |
| `GET/POST /rbac/roles`, `GET /rbac/permissions` | `roles.manage` | |
| `POST/DELETE /rbac/role-permissions` `{ roleId, permissionId }` | `roles.manage` | |
| `POST/DELETE /rbac/user-roles` `{ userId, roleId }` | `users.manage` | |
| `GET /rbac/users/:userId/access` | `users.manage` | |

Register/login return `{ user, token, roles, permissions }`.

### Middleware behaviour

- `authenticate`: `Authorization: Bearer <jwt>` → `verifyToken` → load user → **401 if `isActive` is false**
  (this is how deactivation takes effect immediately; there's no revocation list). Sets `req.user`, `req.userId`.
- `requirePermission(name)`: resolves the user's permission names from the DB
  (`rbacRepository.resolvePermissionNamesForUser`), 403 `"Missing required permission: x"` if absent,
  and sets `req.permissions` (full array) for controllers to use.
- `requireAnyPermission([a, b])`: passes if the user has any of them.

### User model (`models/User.js`)

`name`, `email` (unique, lowercase), `employeeId` (trimmed, uppercased, unique + sparse, typed by an admin),
`passwordHash` (`select: false`, stripped in `toJSON`), `phone`, `department`, `isActive` (default true),
`lastLoginAt`, `leaveAllocation { casual, sick, annual }` (default 0), timestamps.

## Permission catalog

| Resource | Actions |
|---|---|
| `users` | `read`, `manage` |
| `roles` | `manage` |
| `giveaways` | `read`, `create`, `update`, `delete`, `issue` |
| `inventory` | `read`, `create`, `update`, `delete`, `purchase` |
| `generator` | `read`, `create`, `update`, `delete` (also covers maintenance) |
| `generator_log` | `create`, `update`, `delete` |
| `attendance` | `read`, `create`, `update`, `approve` |
| `overtime` | `read`, `approve` |
| `leave` | `read`, `create`, `approve`, `reject` |
| `dashboard` | `read` |
| `reports` | `read` |

## Seeded roles (`isSystem: true`)

- **admin** — every permission.
- **manager** — giveaways (no delete), inventory (no delete), generator read/create/update,
  all `generator_log.*`, all `attendance.*`, `overtime.read/approve`, `leave.read/approve/reject`,
  `dashboard.read`, `reports.read`.
- **staff** (default for new accounts) — `giveaways.read`, `inventory.read`, `generator.read`,
  `generator_log.create`, `attendance.read/create`, `overtime.read`, `leave.read/create`, `dashboard.read`.
- Starter login: `admin@admin-automation.local` / `ChangeMe123!`.

### Adding permissions for a new module

1. Add `{ resource, action, description }` entries to `permissionsCatalog` under a module comment.
2. Add the names to `manager` / `staff` in `defaultRoles` as appropriate (admin gets all automatically).
3. `npm run seed` — find-or-create, only adds, safe to repeat. Tell teammates to re-run it after pulling.

## Frontend

- `context/AuthContext.jsx` — session state, token in `localStorage["aas_token"]`, `hasPermission`.
- `routes/ProtectedRoute.jsx` — auth + optional `permission` gate.
- `pages/auth/LoginPage.jsx` — `useState` form; on success plays `LogoLoader` ("Welcome, {name}!")
  then navigates to `state.from` or `/dashboard`. "Remember me" is not wired; "Forgot password?"
  links to `/forgot-password`, which has no route yet.
- `pages/auth/RegisterPage.jsx` — maps `details[].field` to field errors.
- `pages/UnauthorizedPage.jsx`, `pages/NotFoundPage.jsx`.
- `config/featureVisibility.js` — `selfServiceHiddenForRoles = ["admin"]` + `useSelfServiceVisible()`.
  Presentation-only role check (hides "My attendance/overtime/leave" for admin); intended to move
  into Settings (Module 8). Not a security boundary.

## Gaps

- No backend tests for auth/RBAC.
- RBAC admin endpoints have no validators and no UI (roles/permissions are managed via API or seed).
- No forgot/reset password, no refresh tokens, logout is client-side only.
