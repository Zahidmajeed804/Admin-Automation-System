import { seedRbacCatalog } from "../../src/seeders/index.js";
import { rbacRepository } from "../../src/repositories/rbacRepository.js";
import { hashPassword } from "../../src/utils/password.js";
import { signToken } from "../../src/utils/jwt.js";
import { User } from "../../src/models/index.js";

// No caching across calls: tests/setup.js clears every collection after
// each test (including Role/Permission/RolePermission), so the catalog
// must be reseeded per test rather than assumed to persist. seedPermissions/
// seedRoles are find-or-create, so repeat calls are cheap and safe.
export async function ensureRbacSeeded() {
  return seedRbacCatalog();
}

let userCounter = 0;

/**
 * Creates a user assigned to `roleName` ("admin" | "manager" | "staff")
 * and mints a real JWT for it via the actual signToken utility (payload
 * shape matches authService.js: { sub: user._id.toString() }).
 */
export async function createUserWithRole(roleName, overrides = {}) {
  await ensureRbacSeeded();

  const role = await rbacRepository.findRoleByName(roleName);
  if (!role) throw new Error(`Unknown role: ${roleName}`);

  userCounter += 1;
  const passwordHash = await hashPassword("Password123!");
  const user = await User.create({
    name: `Test ${roleName} ${userCounter}`,
    email: `${roleName}${userCounter}@test.local`,
    passwordHash,
    ...overrides,
  });

  await rbacRepository.assignRoleToUser(user._id, role._id);

  const token = signToken({ sub: user._id.toString() });

  return { user, token };
}
