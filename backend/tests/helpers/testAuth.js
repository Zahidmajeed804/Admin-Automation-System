import { seedRbacCatalog } from "../../src/seeders/index.js";
import { rbacRepository } from "../../src/repositories/rbacRepository.js";
import { hashPassword } from "../../src/utils/password.js";
import { signToken } from "../../src/utils/jwt.js";
import { User } from "../../src/models/index.js";

// tests/setup.js keeps the RBAC catalog between tests, so it only has to be
// seeded once per test file. (Seeding is find-or-create, so it is also safe
// if a previous file already did it.)
let seeding = null;
export function ensureRbacSeeded() {
  seeding ??= seedRbacCatalog();
  return seeding;
}

// bcrypt at 12 rounds costs ~250ms; tests never log in, they only need a
// valid stored hash, so compute it once per file and reuse it.
let passwordHash = null;
async function testPasswordHash() {
  passwordHash ??= await hashPassword("Password123!");
  return passwordHash;
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
  const user = await User.create({
    name: `Test ${roleName} ${userCounter}`,
    email: `${roleName}${userCounter}@test.local`,
    passwordHash: await testPasswordHash(),
    ...overrides,
  });

  await rbacRepository.assignRoleToUser(user._id, role._id);

  const token = signToken({ sub: user._id.toString() });

  return { user, token };
}
