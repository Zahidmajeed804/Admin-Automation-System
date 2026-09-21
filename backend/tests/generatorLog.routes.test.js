import { as, anonymous, makeUsers, createGenerator, UNKNOWN_ID } from "./helpers/generatorTestUtils.js";
import { Generator, GeneratorLog } from "../src/models/index.js";

const hoursOf = async (id) => (await Generator.findById(id)).runningHoursTotal;

describe("Generator usage logs API — /api/v1/generator/logs", () => {
  describe("authentication and permissions", () => {
    it("rejects requests without a token (401)", async () => {
      expect((await anonymous.get("/logs")).status).toBe(401);
      expect((await anonymous.post("/logs", {})).status).toBe(401);
      expect((await anonymous.delete(`/logs/${UNKNOWN_ID}`)).status).toBe(401);
    });

    it("staff can list logs but not record or delete them", async () => {
      const { admin, staff } = await makeUsers();
      const gen = await createGenerator();
      const log = (await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 2 })).body.data.log;

      expect((await as(staff).get("/logs")).status).toBe(200);
      expect((await as(staff).post("/logs", { generatorId: gen._id, hoursRun: 1 })).status).toBe(403);
      expect((await as(staff).delete(`/logs/${log._id}`)).status).toBe(403);
      expect(await hoursOf(gen._id)).toBe(2); // the forbidden requests changed nothing
    });

    it("a manager can record a log but only an admin can delete one", async () => {
      const { admin, manager } = await makeUsers();
      const gen = await createGenerator();
      const log = (await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 4 })).body.data.log;

      expect((await as(manager).delete(`/logs/${log._id}`)).status).toBe(403);
      expect((await as(admin).delete(`/logs/${log._id}`)).status).toBe(200);
    });
  });

  describe("recording a log (POST /logs)", () => {
    it("stores the entry, applies defaults, and returns the generator's new running-hours total", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 3.5, fuelAddedLiters: 20, reason: "power outage" });

      expect(res.status).toBe(201);
      expect(res.body.data.log).toMatchObject({ hoursRun: 3.5, fuelAddedLiters: 20, fuelConsumedLiters: 0, reason: "power outage" });
      expect(res.body.data.generator.runningHoursTotal).toBe(3.5);
      expect(await hoursOf(gen._id)).toBe(3.5); // persisted, not just echoed
    });

    it("adds up across entries", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 3 });
      const second = await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 2.5 });

      expect(second.body.data.generator.runningHoursTotal).toBe(5.5);
      expect(await GeneratorLog.countDocuments({ generator: gen._id })).toBe(2);
    });

    it("records the authenticated user as recordedBy, ignoring anything the client sends", async () => {
      const { manager, staff } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", {
        generatorId: gen._id,
        hoursRun: 1,
        recordedBy: staff.user._id, // spoof attempt
        runningHoursTotal: 999, // spoof attempt
      });

      expect(res.status).toBe(201);
      expect(res.body.data.log.recordedBy).toBe(manager.user._id.toString());
      expect(res.body.data.generator.runningHoursTotal).toBe(1);
    });

    it("returns 404 for an unknown or deleted generator, and records nothing", async () => {
      const { manager } = await makeUsers();
      const deleted = await createGenerator({ isActive: false });

      expect((await as(manager).post("/logs", { generatorId: UNKNOWN_ID, hoursRun: 1 })).status).toBe(404);
      expect((await as(manager).post("/logs", { generatorId: deleted._id, hoursRun: 1 })).status).toBe(404);
      expect(await GeneratorLog.countDocuments()).toBe(0);
    });

    // Each case builds its complete payload from a real generator id, so the
    // "missing generatorId" case really omits it.
    it.each([
      ["a missing generatorId", () => ({ hoursRun: 1 })],
      ["a malformed generatorId", () => ({ generatorId: "nope", hoursRun: 1 })],
      ["missing hoursRun", (id) => ({ generatorId: id })],
      ["negative hoursRun", (id) => ({ generatorId: id, hoursRun: -1 })],
      ["a non-numeric hoursRun", (id) => ({ generatorId: id, hoursRun: "lots" })],
      ["negative fuel added", (id) => ({ generatorId: id, hoursRun: 1, fuelAddedLiters: -5 })],
      ["negative fuel consumed", (id) => ({ generatorId: id, hoursRun: 1, fuelConsumedLiters: -5 })],
      ["an invalid date", (id) => ({ generatorId: id, hoursRun: 1, date: "not a date" })],
    ])("rejects %s with 400", async (_label, buildPayload) => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", buildPayload(gen._id));

      expect(res.status).toBe(400);
      expect(await GeneratorLog.countDocuments()).toBe(0);
      expect(await hoursOf(gen._id)).toBe(0);
    });
  });

  describe("listing logs (GET /logs)", () => {
    async function seed() {
      const users = await makeUsers();
      const main = await createGenerator({ tag: "MAIN", name: "Main" });
      const annex = await createGenerator({ tag: "ANNEX", name: "Annex" });
      const log = (gen, date, hoursRun) => as(users.admin).post("/logs", { generatorId: gen._id, date, hoursRun });
      await log(main, "2026-09-10T08:00:00Z", 1);
      await log(main, "2026-09-15T08:00:00Z", 2);
      await log(main, "2026-09-20T08:00:00Z", 3);
      await log(annex, "2026-09-15T08:00:00Z", 4);
      return { ...users, main, annex };
    }

    it("lists everything newest-first, with the generator's tag and the recorder's name filled in", async () => {
      const { staff } = await seed();

      const res = await as(staff).get("/logs");

      expect(res.status).toBe(200);
      expect(res.body.meta.totalItems).toBe(4);
      const dates = res.body.data.map((l) => l.date);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(res.body.data[0].generator).toMatchObject({ tag: "MAIN", name: "Main" });
      expect(res.body.data[0].recordedBy.name).toMatch(/^Test admin/);
    });

    it("filters by generator", async () => {
      const { staff, main } = await seed();

      const res = await as(staff).get(`/logs?generatorId=${main._id}`);

      expect(res.body.meta.totalItems).toBe(3);
      expect(res.body.data.every((l) => l.generator.tag === "MAIN")).toBe(true);
    });

    it("filters by an inclusive date range", async () => {
      const { staff, main } = await seed();

      const window = await as(staff).get(`/logs?generatorId=${main._id}&from=2026-09-12&to=2026-09-18`);
      expect(window.body.data.map((l) => l.hoursRun)).toEqual([2]);

      const fromOnly = await as(staff).get(`/logs?generatorId=${main._id}&from=2026-09-15T08:00:00Z`);
      expect(fromOnly.body.data.map((l) => l.hoursRun)).toEqual([3, 2]); // boundary entry included

      const toOnly = await as(staff).get(`/logs?generatorId=${main._id}&to=2026-09-10T08:00:00Z`);
      expect(toOnly.body.data.map((l) => l.hoursRun)).toEqual([1]);
    });

    it("paginates", async () => {
      const { staff } = await seed();

      const res = await as(staff).get("/logs?page=2&pageSize=3");

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({ page: 2, pageSize: 3, totalItems: 4, totalPages: 2 });
    });

    it("is not mistaken for GET /:id, which still works", async () => {
      const { staff, main } = await seed();

      expect((await as(staff).get("/logs")).body.meta).toBeDefined(); // the list, not a "generator with id logs"
      expect((await as(staff).get(`/${main._id}`)).body.data.tag).toBe("MAIN");
    });
  });

  describe("deleting a log (DELETE /logs/:logId)", () => {
    it("removes the entry and takes its hours back off the generator's total", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      const keep = (await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 2 })).body.data.log;
      const mistake = (await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 5 })).body.data.log;
      expect(await hoursOf(gen._id)).toBe(7);

      const res = await as(admin).delete(`/logs/${mistake._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.generator.runningHoursTotal).toBe(2);
      expect(await hoursOf(gen._id)).toBe(2);
      expect(await GeneratorLog.findById(mistake._id)).toBeNull();
      expect(await GeneratorLog.findById(keep._id)).not.toBeNull();
    });

    it("returns 404 for an unknown or already-deleted log, and a second delete does not subtract twice", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 2 });
      const log = (await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 5 })).body.data.log;
      await as(admin).delete(`/logs/${log._id}`);

      expect((await as(admin).delete(`/logs/${log._id}`)).status).toBe(404);
      expect((await as(admin).delete(`/logs/${UNKNOWN_ID}`)).status).toBe(404);
      expect(await hoursOf(gen._id)).toBe(2);
    });
  });
});
