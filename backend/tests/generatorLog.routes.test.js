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

    it("rejects unauthenticated corrections too (401)", async () => {
      expect((await anonymous.patch(`/logs/${UNKNOWN_ID}`, { hoursRun: 1 })).status).toBe(401);
    });

    it("staff can list and record logs, but not correct or delete them", async () => {
      const { admin, staff } = await makeUsers();
      const gen = await createGenerator();
      const log = (await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 2 })).body.data.log;

      expect((await as(staff).get("/logs")).status).toBe(200);
      const recorded = await as(staff).post("/logs", { generatorId: gen._id, hoursRun: 1 });
      expect(recorded.status).toBe(201);
      expect(recorded.body.data.log.recordedBy).toBe(staff.user._id.toString());
      expect((await as(staff).patch(`/logs/${log._id}`, { hoursRun: 9 })).status).toBe(403);
      expect((await as(staff).delete(`/logs/${log._id}`)).status).toBe(403);
      expect(await hoursOf(gen._id)).toBe(3); // 2 + 1: only the allowed request changed anything
      expect((await GeneratorLog.findById(log._id)).hoursRun).toBe(2);
    });

    it("a manager can record, correct and delete logs", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = (await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 4 })).body.data.log;

      expect((await as(manager).patch(`/logs/${log._id}`, { hoursRun: 3 })).status).toBe(200);
      expect((await as(manager).delete(`/logs/${log._id}`)).status).toBe(200);
      expect(await hoursOf(gen._id)).toBe(0);
    });

    it("an admin can record, correct and delete logs", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      const log = (await as(admin).post("/logs", { generatorId: gen._id, hoursRun: 4 })).body.data.log;

      expect((await as(admin).patch(`/logs/${log._id}`, { hoursRun: 3 })).status).toBe(200);
      expect((await as(admin).delete(`/logs/${log._id}`)).status).toBe(200);
    });

    it("staff still cannot create, edit or delete generators themselves", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator();

      expect((await as(staff).post("/", { tag: "NEW-1", name: "New" })).status).toBe(403);
      expect((await as(staff).patch(`/${gen._id}`, { name: "Renamed" })).status).toBe(403);
      expect((await as(staff).delete(`/${gen._id}`)).status).toBe(403);
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

    it("derives fuel consumed and cost from the readings, ignoring client-sent values, and trims the vendor", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", {
        generatorId: gen._id,
        hoursRun: 3,
        openingFuelLiters: 100,
        fuelAddedLiters: 50,
        closingFuelLiters: 120,
        fuelCostPerLiter: 285.5,
        fuelVendor: "  PSO Pump  ",
        fuelConsumedLiters: 999, // spoof attempt
        fuelCostTotal: 1, // spoof attempt
      });

      expect(res.status).toBe(201);
      expect(res.body.data.log).toMatchObject({
        openingFuelLiters: 100,
        closingFuelLiters: 120,
        fuelAddedLiters: 50,
        fuelConsumedLiters: 30,
        fuelCostPerLiter: 285.5,
        fuelCostTotal: 14275,
        fuelVendor: "PSO Pump",
      });
      expect(await GeneratorLog.findById(res.body.data.log._id)).toMatchObject({ fuelConsumedLiters: 30, fuelCostTotal: 14275 }); // persisted
    });

    it("keeps a client-sent consumed figure and total when they cannot be derived", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 1, fuelAddedLiters: 20, fuelConsumedLiters: 8, fuelCostTotal: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.data.log).toMatchObject({ fuelConsumedLiters: 8, fuelCostTotal: 5000 });
    });

    it("accepts a closing reading exactly equal to opening + added", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 1, openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 150 });

      expect(res.status).toBe(201);
      expect(res.body.data.log.fuelConsumedLiters).toBe(0);
    });

    it("leaves the new fuel fields unset when the request does not send them", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 2, fuelAddedLiters: 10 });

      expect(res.status).toBe(201);
      expect(res.body.data.log.openingFuelLiters).toBeUndefined();
      expect(res.body.data.log.fuelCostTotal).toBeUndefined();
      expect(res.body.data.log.fuelVendor).toBeUndefined();
      expect(res.body.data.log.fuelConsumedLiters).toBe(0);
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
      ["a negative opening reading", (id) => ({ generatorId: id, hoursRun: 1, openingFuelLiters: -1 })],
      ["a negative closing reading", (id) => ({ generatorId: id, hoursRun: 1, closingFuelLiters: -1 })],
      ["a non-numeric opening reading", (id) => ({ generatorId: id, hoursRun: 1, openingFuelLiters: "abc" })],
      ["a closing reading above opening + added", (id) => ({ generatorId: id, hoursRun: 1, openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 151 })],
      ["a closing reading above opening with no fuel added", (id) => ({ generatorId: id, hoursRun: 1, openingFuelLiters: 100, closingFuelLiters: 101 })],
      ["a negative price per litre", (id) => ({ generatorId: id, hoursRun: 1, fuelAddedLiters: 10, fuelCostPerLiter: -2 })],
      ["a price per litre with no fuel added", (id) => ({ generatorId: id, hoursRun: 1, fuelCostPerLiter: 285 })],
      ["a price per litre with 0 fuel added", (id) => ({ generatorId: id, hoursRun: 1, fuelAddedLiters: 0, fuelCostPerLiter: 285 })],
      ["a negative total cost", (id) => ({ generatorId: id, hoursRun: 1, fuelCostTotal: -1 })],
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

  describe("correcting a log (PATCH /logs/:logId)", () => {
    const record = async (user, gen, body) => (await as(user).post("/logs", { generatorId: gen._id, hoursRun: 4, ...body })).body.data.log;

    it("changes the given fields, leaves the rest alone, and returns the log and the generator", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { reason: "typo", fuelVendor: "PSO", notes: "keep me" });

      const res = await as(manager).patch(`/logs/${log._id}`, { reason: "power outage", fuelVendor: "  Shell  " });

      expect(res.status).toBe(200);
      expect(res.body.data.log).toMatchObject({ reason: "power outage", fuelVendor: "Shell", notes: "keep me", hoursRun: 4 });
      expect(res.body.data.generator.runningHoursTotal).toBe(4);
      expect(await GeneratorLog.findById(log._id)).toMatchObject({ reason: "power outage", fuelVendor: "Shell" }); // persisted
    });

    it("applies a change of hours run to the generator's running-hours total, up and down", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      await record(manager, gen, { hoursRun: 2 });
      const log = await record(manager, gen, { hoursRun: 4 });
      expect(await hoursOf(gen._id)).toBe(6);

      const up = await as(manager).patch(`/logs/${log._id}`, { hoursRun: 10 });
      expect(up.body.data.generator.runningHoursTotal).toBe(12);
      expect(await hoursOf(gen._id)).toBe(12);

      const down = await as(manager).patch(`/logs/${log._id}`, { hoursRun: 0.5 });
      expect(down.body.data.generator.runningHoursTotal).toBe(2.5);
      expect(await hoursOf(gen._id)).toBe(2.5);
    });

    it("does not touch the total when hours run is not part of the change or stays the same", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { hoursRun: 4 });

      await as(manager).patch(`/logs/${log._id}`, { reason: "x" });
      await as(manager).patch(`/logs/${log._id}`, { hoursRun: 4 });

      expect(await hoursOf(gen._id)).toBe(4);
    });

    it("a later delete takes off the corrected hours, not the original ones", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(admin, gen, { hoursRun: 4 });
      await as(admin).patch(`/logs/${log._id}`, { hoursRun: 7 });

      await as(admin).delete(`/logs/${log._id}`);

      expect(await hoursOf(gen._id)).toBe(0);
    });

    it("recalculates consumption and cost from the corrected readings", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 120, fuelCostPerLiter: 285.5 });
      expect(log).toMatchObject({ fuelConsumedLiters: 30, fuelCostTotal: 14275 });

      const res = await as(manager).patch(`/logs/${log._id}`, { closingFuelLiters: 100, fuelCostPerLiter: 300, fuelConsumedLiters: 999 });

      expect(res.status).toBe(200);
      expect(res.body.data.log).toMatchObject({ closingFuelLiters: 100, fuelConsumedLiters: 50, fuelCostTotal: 15000 }); // 999 ignored
    });

    it("clears an optional field when it is sent as null", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { fuelVendor: "PSO", reason: "outage", meterReadingHours: 100 });

      const res = await as(manager).patch(`/logs/${log._id}`, { fuelVendor: null, meterReadingHours: null });

      expect(res.status).toBe(200);
      expect(res.body.data.log.fuelVendor).toBeUndefined();
      expect(res.body.data.log.meterReadingHours).toBeUndefined();
      expect(res.body.data.log.reason).toBe("outage");
      const stored = await GeneratorLog.findById(log._id).lean();
      expect("fuelVendor" in stored).toBe(false);
    });

    it("drops consumption and cost that can no longer be worked out, instead of leaving stale figures", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 120, fuelCostPerLiter: 285.5 });

      const res = await as(manager).patch(`/logs/${log._id}`, { closingFuelLiters: null, fuelCostPerLiter: null });

      expect(res.status).toBe(200);
      expect(res.body.data.log.fuelConsumedLiters).toBe(0);
      expect(res.body.data.log.fuelCostTotal).toBeUndefined();
    });

    it("ignores an attempt to change the generator, who recorded it, or the running total", async () => {
      const { manager, staff } = await makeUsers();
      const gen = await createGenerator();
      const other = await createGenerator();
      const log = await record(manager, gen, { hoursRun: 4 });

      const res = await as(manager).patch(`/logs/${log._id}`, { reason: "ok", generator: other._id, generatorId: other._id, recordedBy: staff.user._id, runningHoursTotal: 999 });

      expect(res.status).toBe(200);
      const stored = await GeneratorLog.findById(log._id);
      expect(stored.generator.toString()).toBe(gen._id.toString());
      expect(stored.recordedBy.toString()).toBe(manager.user._id.toString());
      expect(await hoursOf(gen._id)).toBe(4);
      expect(await hoursOf(other._id)).toBe(0);
    });

    it("an empty change is accepted and changes nothing", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { hoursRun: 4, reason: "keep" });

      const res = await as(manager).patch(`/logs/${log._id}`, {});

      expect(res.status).toBe(200);
      expect(res.body.data.log).toMatchObject({ hoursRun: 4, reason: "keep" });
      expect(await hoursOf(gen._id)).toBe(4);
    });

    it("returns 404 for an unknown log and changes no hours", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      await record(manager, gen, { hoursRun: 4 });

      expect((await as(manager).patch(`/logs/${UNKNOWN_ID}`, { hoursRun: 9 })).status).toBe(404);
      expect(await hoursOf(gen._id)).toBe(4);
    });

    it.each([
      ["a negative hoursRun", { hoursRun: -1 }],
      ["hoursRun sent as null (it cannot be cleared)", { hoursRun: null }],
      ["a non-numeric hoursRun", { hoursRun: "lots" }],
      ["an invalid date", { date: "not a date" }],
      ["a negative fuel added", { fuelAddedLiters: -5 }],
      ["a negative price per litre", { fuelCostPerLiter: -1 }],
      ["a non-numeric opening reading", { openingFuelLiters: "abc" }],
      ["a closing reading above opening + added", { closingFuelLiters: 200 }],
      ["a price per litre when no fuel was added", { fuelAddedLiters: null, fuelCostPerLiter: 285 }],
    ])("rejects %s with 400 and changes nothing", async (_label, change) => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { hoursRun: 4, openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 120 });

      const res = await as(manager).patch(`/logs/${log._id}`, change);

      expect(res.status).toBe(400);
      expect(await hoursOf(gen._id)).toBe(4);
      expect(await GeneratorLog.findById(log._id)).toMatchObject({ hoursRun: 4, closingFuelLiters: 120, fuelAddedLiters: 50 });
    });

    it("judges the whole entry: lowering the opening reading below the stored closing reading is rejected", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const log = await record(manager, gen, { openingFuelLiters: 100, closingFuelLiters: 80 });

      expect((await as(manager).patch(`/logs/${log._id}`, { openingFuelLiters: 50 })).status).toBe(400);
      expect((await as(manager).patch(`/logs/${log._id}`, { openingFuelLiters: 90 })).status).toBe(200);
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
