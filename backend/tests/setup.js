import mongoose from "mongoose";
import { Permission, Role, RolePermission } from "../src/models/index.js";
import { logger } from "../src/utils/logger.js";

// The seeder logs a line per permission/role it creates; under test that is
// hundreds of lines of noise. Warnings and errors are left alone.
logger.info = () => {};

// The RBAC catalog (permissions, roles, and which role has which permission)
// is reference data, identical for every test. Keeping it between tests lets
// helpers/testAuth.js seed it once per test file instead of once per test.
// Everything else — users, their role links, all generator data — is wiped.
const KEEP = new Set([Permission, Role, RolePermission].map((model) => model.collection.name));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    if (KEEP.has(name)) continue;
    await collections[name].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});
