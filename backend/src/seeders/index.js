import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { setServers } from "node:dns/promises";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { rbacRepository } from "../repositories/rbacRepository.js";
import { permissionsCatalog, defaultRoles } from "../constants/permissions.js";
import { hashPassword } from "../utils/password.js";
import { User, Generator } from "../models/index.js";
import { logger } from "../utils/logger.js";

export async function seedPermissions() {
  const permissionIdByName = {};
  for (const p of permissionsCatalog) {
    const name = `${p.resource}.${p.action}`;
    let permission = await rbacRepository.findPermissionByName(name);
    if (!permission) {
      permission = await rbacRepository.createPermission({
        name,
        resource: p.resource,
        action: p.action,
        description: p.description,
      });
      logger.info(`Created permission: ${name}`);
    }
    permissionIdByName[name] = permission._id;
  }
  return permissionIdByName;
}

export async function seedRoles(permissionIdByName) {
  for (const r of defaultRoles) {
    let role = await rbacRepository.findRoleByName(r.name);
    if (!role) {
      role = await rbacRepository.createRole({
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      });
      logger.info(`Created role: ${r.name}`);
    }
    for (const permName of r.permissions) {
      const permissionId = permissionIdByName[permName];
      if (!permissionId) continue; // unknown permission name in catalog — skip safely
      await rbacRepository.assignPermissionToRole(role._id, permissionId);
    }
  }
}

export async function seedDefaultAdmin() {
  const existing = await User.findOne({ email: "admin@admin-automation.local" });
  if (existing) return;

  const passwordHash = await hashPassword("ChangeMe123!");
  const admin = await User.create({
    name: "System Administrator",
    email: "admin@admin-automation.local",
    passwordHash,
  });

  const adminRole = await rbacRepository.findRoleByName("admin");
  if (adminRole) {
    await rbacRepository.assignRoleToUser(admin._id, adminRole._id);
  }

  logger.info("Created default admin user: admin@admin-automation.local / ChangeMe123! (change this password immediately)");
}

// Convenience wrapper the test suite reuses so it never has to duplicate
// seedPermissions/seedRoles ordering logic.
export async function seedRbacCatalog() {
  const permissionIdByName = await seedPermissions();
  await seedRoles(permissionIdByName);
  return permissionIdByName;
}

// "gas" was renamed to "cng" when CNG support (measured in kg) was added.
// Idempotent: a second run matches zero documents once migrated.
export async function migrateGasFuelTypeToCng() {
  const result = await Generator.updateMany({ fuelType: "gas" }, { $set: { fuelType: "cng" } });
  if (result.modifiedCount > 0) {
    logger.info(`Migrated ${result.modifiedCount} generator(s) from fuelType "gas" to "cng"`);
  }
  return result.modifiedCount;
}

// The generator tag's unique index used to apply to every document, so a
// soft-deleted/leftover isActive:false row (from before deletion became
// permanent) could block a new generator from reusing its tag. The model
// now declares a partial unique index (isActive:true only) instead, but
// Mongoose's autoIndex never drops/replaces an existing index of the same
// name with different options — it has to be dropped explicitly first.
// Idempotent: a second run finds no plain "tag_1" index left to drop.
export async function migrateGeneratorTagPartialIndex() {
  const indexes = await Generator.collection.indexes();
  const oldIndex = indexes.find((i) => i.name === "tag_1" && !i.partialFilterExpression);
  if (oldIndex) {
    await Generator.collection.dropIndex("tag_1");
    logger.info('Dropped the non-partial "tag_1" unique index on generators');
  }
  await Generator.collection.createIndex({ tag: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
}

async function run() {
  // Same resolver override as server.js, so mongodb+srv:// Atlas URIs resolve
  // on networks whose default DNS refuses SRV lookups. Kept inside run() (not
  // top-level) so merely importing this module from tests has no side effect.
  setServers(["1.1.1.1", "8.8.8.8"]);
  await connectDatabase();
  logger.info("Seeding RBAC data...");
  await seedRbacCatalog();
  await seedDefaultAdmin();
  await migrateGasFuelTypeToCng();
  await migrateGeneratorTagPartialIndex();
  logger.info("RBAC seeding complete.");
  await disconnectDatabase();
  await mongoose.disconnect();
  process.exit(0);
}

// ESM equivalent of `require.main === module` — only self-run when invoked
// directly (`node src/seeders/index.js` / `npm run seed`), never on import.
// pathToFileURL (not a manual `file://` + string concat) is required here:
// process.argv[1] can be relative and uses OS-native separators, so on
// Windows a naive comparison against import.meta.url never matches and this
// guard silently never fires.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((err) => {
    logger.error(`Seeding failed: ${err.message}`);
    process.exit(1);
  });
}
