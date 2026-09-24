import request from "supertest";
import app from "../../src/app.js";
import { createUserWithRole } from "./testAuth.js";
import { Generator } from "../../src/models/index.js";

export const API = "/api/v1/generator";
export const DAY = 24 * 60 * 60 * 1000;

/** A Date `n` days from now (negative = in the past). */
export const inDays = (n) => new Date(Date.now() + n * DAY);

/**
 * `as(user).get("/logs")` etc. — a request to the generator API,
 * authenticated as that user. `anonymous` sends no token.
 */
export const as = (user) => ({
  get: (path) => request(app).get(API + path).set("Authorization", `Bearer ${user.token}`),
  post: (path, body) => request(app).post(API + path).set("Authorization", `Bearer ${user.token}`).send(body),
  patch: (path, body) => request(app).patch(API + path).set("Authorization", `Bearer ${user.token}`).send(body),
  delete: (path) => request(app).delete(API + path).set("Authorization", `Bearer ${user.token}`),
});
export const anonymous = {
  get: (path) => request(app).get(API + path),
  post: (path, body) => request(app).post(API + path).send(body),
  patch: (path, body) => request(app).patch(API + path).send(body),
  delete: (path) => request(app).delete(API + path),
};

/** One user of each role: { admin, manager, staff }, each `{ user, token }`. */
export async function makeUsers() {
  const admin = await createUserWithRole("admin");
  const manager = await createUserWithRole("manager");
  const staff = await createUserWithRole("staff");
  return { admin, manager, staff };
}

let generatorCounter = 0;
/** Inserts a generator directly (bypassing the API) with a unique tag. */
export function createGenerator(overrides = {}) {
  generatorCounter += 1;
  return Generator.create({ tag: `GEN-${generatorCounter}`, name: `Generator ${generatorCounter}`, ...overrides });
}

/** A syntactically valid ObjectId that no document has. */
export const UNKNOWN_ID = "64b1f0c0c0c0c0c0c0c0c0c0";
