import fs from "node:fs";
import path from "node:path";

export default async function globalTeardown() {
  const mongod = global.__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }
  // Invoice-upload tests write real files under the default uploads dir
  // (env.js's INVOICE_UPLOAD_DIR default); remove them once the whole run is done.
  fs.rmSync(path.resolve("uploads"), { recursive: true, force: true });
}
