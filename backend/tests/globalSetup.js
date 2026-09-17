import { MongoMemoryServer } from "mongodb-memory-server";

// Deliberately does not import anything from src/ (e.g. config/env.js) —
// env.js reads process.env.MONGO_URI eagerly at import time, so it must
// not be loaded until after this file has set it below.
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  // globalSetup and globalTeardown run in the same long-lived parent
  // process, so stashing the instance on `global` here is safe and is
  // how globalTeardown gets a handle to stop it.
  global.__MONGOD__ = mongod;
  process.env.MONGO_URI = mongod.getUri();
}
