import fs from "node:fs";
import { as, anonymous, makeUsers, createGenerator, inDays, UNKNOWN_ID } from "./helpers/generatorTestUtils.js";
import { Generator, GeneratorMaintenance } from "../src/models/index.js";
import { invoiceUploadDir } from "../src/middleware/uploadInvoice.js";

// Direct insert (bypasses the API) so a test can set any state it needs.
const insertJob = (generator, overrides = {}) =>
  GeneratorMaintenance.create({ generator: generator._id, description: "Service", scheduledDate: inDays(10), ...overrides });

describe("Generator maintenance API — /api/v1/generator/maintenance", () => {
  describe("authentication and permissions", () => {
    it("rejects requests without a token (401)", async () => {
      expect((await anonymous.get("/maintenance")).status).toBe(401);
      expect((await anonymous.get("/maintenance/alerts")).status).toBe(401);
      expect((await anonymous.post("/maintenance", {})).status).toBe(401);
      expect((await anonymous.patch(`/maintenance/${UNKNOWN_ID}`, {})).status).toBe(401);
      expect((await anonymous.delete(`/maintenance/${UNKNOWN_ID}`)).status).toBe(401);
      expect((await anonymous.postFile(`/maintenance/${UNKNOWN_ID}/invoice`)).status).toBe(401);
      expect((await anonymous.get(`/maintenance/${UNKNOWN_ID}/invoice`)).status).toBe(401);
      expect((await anonymous.delete(`/maintenance/${UNKNOWN_ID}/invoice`)).status).toBe(401);
    });

    it("staff can read (list and alerts) but not schedule, change or delete", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator();
      const job = await insertJob(gen);

      expect((await as(staff).get("/maintenance")).status).toBe(200);
      expect((await as(staff).get("/maintenance/alerts")).status).toBe(200);
      expect((await as(staff).post("/maintenance", { generatorId: gen._id, description: "x", scheduledDate: inDays(1) })).status).toBe(403);
      expect((await as(staff).patch(`/maintenance/${job._id}`, { notes: "x" })).status).toBe(403);
      expect((await as(staff).patch(`/maintenance/${job._id}`, { status: "completed" })).status).toBe(403);
      expect((await as(staff).delete(`/maintenance/${job._id}`)).status).toBe(403);
    });

    it("a manager can schedule, edit, cancel and complete, but only an admin can delete", async () => {
      const { admin, manager } = await makeUsers();
      const gen = await createGenerator();
      const job = await insertJob(gen);

      expect((await as(manager).post("/maintenance", { generatorId: gen._id, description: "x", scheduledDate: inDays(1) })).status).toBe(201);
      expect((await as(manager).patch(`/maintenance/${job._id}`, { notes: "edited" })).status).toBe(200);
      expect((await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" })).status).toBe(200);
      expect((await as(manager).delete(`/maintenance/${job._id}`)).status).toBe(403);
      expect((await as(admin).delete(`/maintenance/${job._id}`)).status).toBe(200);
    });
  });

  describe("scheduling a job (POST /maintenance)", () => {
    it("creates a scheduled job with defaults and records who created it", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/maintenance", { generatorId: gen._id, description: "Oil change", scheduledDate: inDays(30), cost: 120, vendor: "  PSO Services  " });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        description: "Oil change",
        cost: 120,
        status: "scheduled",
        type: "scheduled",
        alertThresholdDays: 7,
        vendor: "PSO Services",
        createdBy: manager.user._id.toString(),
      });
      expect(res.body.data.completedDate).toBeUndefined();
    });

    it("always creates a job as scheduled — a client cannot pre-complete it or set createdBy", async () => {
      const { manager, staff } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/maintenance", {
        generatorId: gen._id,
        description: "Sneaky",
        scheduledDate: inDays(5),
        status: "completed", // spoof attempt
        completedDate: inDays(-1), // spoof attempt
        createdBy: staff.user._id, // spoof attempt
        hoursAtService: 999, // spoof attempt — only makes sense when completing a job
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("scheduled");
      expect(res.body.data.completedDate).toBeUndefined();
      expect(res.body.data.createdBy).toBe(manager.user._id.toString());
      expect(res.body.data.hoursAtService).toBeUndefined();
      expect((await Generator.findById(gen._id)).lastServiceDate).toBeUndefined(); // nothing was "serviced"
    });

    it("returns 404 for an unknown or deleted generator", async () => {
      const { manager } = await makeUsers();
      const deleted = await createGenerator({ isActive: false });
      const body = (generatorId) => ({ generatorId, description: "x", scheduledDate: inDays(1) });

      expect((await as(manager).post("/maintenance", body(UNKNOWN_ID))).status).toBe(404);
      expect((await as(manager).post("/maintenance", body(deleted._id))).status).toBe(404);
      expect(await GeneratorMaintenance.countDocuments()).toBe(0);
    });

    it.each([
      ["a missing description", (id) => ({ generatorId: id, scheduledDate: inDays(1) })],
      ["a blank description", (id) => ({ generatorId: id, description: "  ", scheduledDate: inDays(1) })],
      ["a missing date", (id) => ({ generatorId: id, description: "x" })],
      ["an invalid date", (id) => ({ generatorId: id, description: "x", scheduledDate: "whenever" })],
      ["a malformed generatorId", () => ({ generatorId: "nope", description: "x", scheduledDate: inDays(1) })],
      ["intervalDays of 0", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), intervalDays: 0 })],
      ["a fractional intervalDays", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), intervalDays: 1.5 })],
      ["a negative alert threshold", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), alertThresholdDays: -1 })],
      ["an unknown type", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), type: "surprise" })],
      ["a negative cost", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), cost: -5 })],
      ["intervalHours of 0", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), intervalHours: 0 })],
      ["a negative alertThresholdHours", (id) => ({ generatorId: id, description: "x", scheduledDate: inDays(1), alertThresholdHours: -1 })],
    ])("rejects %s with 400", async (_label, buildPayload) => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(manager).post("/maintenance", buildPayload(gen._id));

      expect(res.status).toBe(400);
      expect(await GeneratorMaintenance.countDocuments()).toBe(0);
    });

    it("defaults hoursAtScheduling to the generator's current running hours when intervalHours is given", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator({ runningHoursTotal: 800 });

      const res = await as(manager).post("/maintenance", { generatorId: gen._id, description: "Belt", scheduledDate: inDays(30), intervalHours: 250 });

      expect(res.status).toBe(201);
      expect(res.body.data.hoursAtScheduling).toBe(800);
    });
  });

  describe("listing jobs (GET /maintenance)", () => {
    it("attaches alertStatus and daysUntilDue to every job", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator();
      await insertJob(gen, { description: "late", scheduledDate: inDays(-3) });
      await insertJob(gen, { description: "soon", scheduledDate: inDays(3) });
      await insertJob(gen, { description: "far", scheduledDate: inDays(60) });
      await insertJob(gen, { description: "done", scheduledDate: inDays(-30), status: "completed" });
      await insertJob(gen, { description: "off", scheduledDate: inDays(-30), status: "cancelled" });

      const res = await as(staff).get("/maintenance?pageSize=50");
      const byName = Object.fromEntries(res.body.data.map((j) => [j.description, j]));

      expect(byName.late.alertStatus).toBe("overdue");
      expect(byName.late.daysUntilDue).toBeLessThan(0);
      expect(byName.soon.alertStatus).toBe("upcoming");
      expect(byName.far.alertStatus).toBe("scheduled");
      expect(byName.done.alertStatus).toBe("completed");
      expect(byName.off.alertStatus).toBe("cancelled");
      expect(byName.soon.generator).toMatchObject({ tag: gen.tag, name: gen.name });
    });

    it("lists open jobs soonest-due first and other views most recent first", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator();
      await insertJob(gen, { description: "third", scheduledDate: inDays(30) });
      await insertJob(gen, { description: "first", scheduledDate: inDays(2) });
      await insertJob(gen, { description: "second", scheduledDate: inDays(9) });
      await insertJob(gen, { description: "old-done", scheduledDate: inDays(-50), status: "completed" });
      await insertJob(gen, { description: "newer-done", scheduledDate: inDays(-5), status: "completed" });

      const open = await as(staff).get("/maintenance?status=scheduled");
      expect(open.body.data.map((j) => j.description)).toEqual(["first", "second", "third"]);

      const done = await as(staff).get("/maintenance?status=completed");
      expect(done.body.data.map((j) => j.description)).toEqual(["newer-done", "old-done"]);
    });

    it("filters by generator and status, and paginates", async () => {
      const { staff } = await makeUsers();
      const a = await createGenerator();
      const b = await createGenerator();
      for (let i = 0; i < 3; i++) await insertJob(a, { description: `a${i}` });
      await insertJob(a, { description: "a-done", status: "completed" });
      await insertJob(b, { description: "b0" });

      expect((await as(staff).get(`/maintenance?generatorId=${a._id}`)).body.meta.totalItems).toBe(4);
      expect((await as(staff).get(`/maintenance?generatorId=${a._id}&status=scheduled`)).body.meta.totalItems).toBe(3);
      expect((await as(staff).get(`/maintenance?generatorId=${b._id}`)).body.data).toHaveLength(1);

      const page = await as(staff).get(`/maintenance?generatorId=${a._id}&page=2&pageSize=3`);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toEqual({ page: 2, pageSize: 3, totalItems: 4, totalPages: 2 });
    });

    it("is not mistaken for GET /:id, which still works", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator();

      expect((await as(staff).get("/maintenance")).body.meta).toBeDefined();
      expect((await as(staff).get(`/${gen._id}`)).body.data.tag).toBe(gen.tag);
    });
  });

  describe("editing and cancelling (PATCH /maintenance/:id)", () => {
    it("edits the given fields and leaves the job scheduled", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator(), { description: "Before" });
      const newDate = inDays(45).toISOString();

      const res = await as(manager).patch(`/maintenance/${job._id}`, { description: "After", scheduledDate: newDate, cost: 75 });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ description: "After", cost: 75, status: "scheduled", scheduledDate: newDate });
    });

    it("cancels a scheduled job and keeps it as history", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());

      const res = await as(manager).patch(`/maintenance/${job._id}`, { status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: "Maintenance cancelled" });
      expect(res.body.data.status).toBe("cancelled");
      expect(await GeneratorMaintenance.findById(job._id)).not.toBeNull();
    });

    it("stops a recurring job repeating when intervalDays is set to null", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator(), { intervalDays: 30 });

      await as(manager).patch(`/maintenance/${job._id}`, { intervalDays: null });
      const completed = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" });

      expect(completed.body.data.next).toBeNull();
    });

    it("edits alertThresholdHours, and can clear intervalHours with null", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator(), { intervalDays: 30, intervalHours: 250 });

      const edited = await as(manager).patch(`/maintenance/${job._id}`, { alertThresholdHours: 40 });
      expect(edited.status).toBe(200);
      expect(edited.body.data.alertThresholdHours).toBe(40);

      await as(manager).patch(`/maintenance/${job._id}`, { intervalHours: null });
      const completed = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" });
      expect(completed.body.data.next.intervalHours).toBeFalsy(); // stopped tracking hours on the next occurrence too
    });

    it("intervalHours cannot be mixed with completing", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());

      const res = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed", intervalHours: 500 });

      expect(res.status).toBe(400);
    });

    it("treats completed and cancelled jobs as history: any further change is 409", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const cancelled = await insertJob(gen, { status: "cancelled" });
      const completed = await insertJob(gen, { status: "completed" });

      for (const job of [cancelled, completed]) {
        expect((await as(manager).patch(`/maintenance/${job._id}`, { description: "edit" })).status).toBe(409);
        expect((await as(manager).patch(`/maintenance/${job._id}`, { status: "cancelled" })).status).toBe(409);
        expect((await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" })).status).toBe(409);
      }
    });

    it("returns 404 for an unknown job and 400 for a malformed id", async () => {
      const { manager } = await makeUsers();

      expect((await as(manager).patch(`/maintenance/${UNKNOWN_ID}`, { notes: "x" })).status).toBe(404);
      expect((await as(manager).patch(`/maintenance/${UNKNOWN_ID}`, { status: "completed" })).status).toBe(404);
      expect((await as(manager).patch("/maintenance/not-an-id", { notes: "x" })).status).toBe(400);
    });

    it.each([
      ["status set back to scheduled", { status: "scheduled" }],
      ["a status that is computed, not stored", { status: "overdue" }],
      ["completing while also changing the schedule", { status: "completed", scheduledDate: inDays(5).toISOString() }],
      ["completing while also changing the description", { status: "completed", description: "x" }],
      ["a completedDate without completing", { completedDate: inDays(-1).toISOString() }],
      ["an invalid completedDate", { status: "completed", completedDate: "later" }],
      ["a blank description", { description: "" }],
      ["intervalDays of 0", { intervalDays: 0 }],
      ["a negative cost", { cost: -5 }],
      ["an unknown type", { type: "surprise" }],
      ["hoursAtService without completing", { hoursAtService: 10 }],
      ["a negative hoursAtService while completing", { status: "completed", hoursAtService: -1 }],
    ])("rejects %s with 400 and changes nothing", async (_label, payload) => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator(), { description: "Untouched" });

      const res = await as(manager).patch(`/maintenance/${job._id}`, payload);

      expect(res.status).toBe(400);
      const after = await GeneratorMaintenance.findById(job._id);
      expect(after.status).toBe("scheduled");
      expect(after.description).toBe("Untouched");
      expect(after.completedDate).toBeUndefined();
    });
  });

  describe("completing a job (PATCH with status: completed)", () => {
    it("completes a one-off job, saves the completion details, and updates the generator's last service date", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const job = await insertJob(gen);

      const res = await as(manager).patch(`/maintenance/${job._id}`, {
        status: "completed",
        completedDate: "2026-11-03T09:00:00Z",
        performedBy: "ACME Power",
        vendor: "  ACME Corp  ",
        hoursAtService: 812.5,
        cost: 240,
        partsReplaced: "oil filter",
        notes: "all good",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.maintenance).toMatchObject({
        status: "completed",
        completedDate: "2026-11-03T09:00:00.000Z",
        performedBy: "ACME Power",
        vendor: "ACME Corp",
        hoursAtService: 812.5,
        cost: 240,
        partsReplaced: "oil filter",
        notes: "all good",
      });
      expect(res.body.data.next).toBeNull();
      expect(res.body.data.generator.lastServiceDate).toBe("2026-11-03T09:00:00.000Z");
      expect(await GeneratorMaintenance.countDocuments({ generator: gen._id })).toBe(1);
    });

    it("defaults hoursAtService to the generator's current running hours when none is sent", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator({ runningHoursTotal: 350.25 });
      const job = await insertJob(gen);

      const res = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" });

      expect(res.body.data.maintenance.hoursAtService).toBe(350.25);
    });

    it("defaults the completion date to now", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());
      const before = Date.now();

      const res = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" });

      const completedAt = new Date(res.body.data.maintenance.completedDate).getTime();
      expect(completedAt).toBeGreaterThanOrEqual(before);
      expect(completedAt).toBeLessThanOrEqual(Date.now());
    });

    it("schedules the next occurrence intervalDays after the completion date, copying the job's settings", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const job = await insertJob(gen, {
        description: "Quarterly service",
        type: "inspection",
        intervalDays: 90,
        alertThresholdDays: 14,
        intervalHours: 250,
        alertThresholdHours: 20,
        createdBy: manager.user._id,
        performedBy: "Someone else", // per-visit details are NOT carried over
        vendor: "Recurring Vendor Ltd", // ...but the vendor is, since it usually repeats
        cost: 500,
      });

      const res = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed", completedDate: "2026-10-05T00:00:00Z", hoursAtService: 77 });

      const { next } = res.body.data;
      expect(next).toMatchObject({
        generator: gen._id.toString(),
        description: "Quarterly service",
        type: "inspection",
        intervalDays: 90,
        alertThresholdDays: 14,
        intervalHours: 250,
        alertThresholdHours: 20,
        hoursAtScheduling: 77, // starts counting from this job's own resolved hoursAtService
        status: "scheduled",
        createdBy: manager.user._id.toString(),
        vendor: "Recurring Vendor Ltd",
        scheduledDate: "2027-01-03T00:00:00.000Z", // 5 Oct + 90 days
      });
      expect(next.completedDate).toBeUndefined();
      expect(next.performedBy).toBeUndefined();
      expect(next.cost).toBeUndefined();
      expect(next.hoursAtService).toBeUndefined(); // hoursAtService is per-visit, not carried over
      expect(await GeneratorMaintenance.countDocuments({ generator: gen._id })).toBe(2);
    });

    it("keeps recurring: completing the next occurrence schedules the one after it", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator(), { intervalDays: 30 });

      const first = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed", completedDate: "2026-10-01T00:00:00Z" });
      const second = await as(manager).patch(`/maintenance/${first.body.data.next._id}`, { status: "completed", completedDate: "2026-10-31T00:00:00Z" });

      expect(second.body.data.next.scheduledDate).toBe("2026-11-30T00:00:00.000Z");
    });

    it("never moves the generator's last service date backwards", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const recent = await insertJob(gen);
      const late = await insertJob(gen, { description: "Recorded late" });

      await as(manager).patch(`/maintenance/${recent._id}`, { status: "completed", completedDate: "2026-11-20T00:00:00Z" });
      const res = await as(manager).patch(`/maintenance/${late._id}`, { status: "completed", completedDate: "2026-11-02T00:00:00Z" });

      expect(res.body.data.generator.lastServiceDate).toBe("2026-11-20T00:00:00.000Z");
    });

    it("cannot complete the same job twice (409) and does not create a second next occurrence", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator();
      const job = await insertJob(gen, { intervalDays: 30 });
      await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" });

      const again = await as(manager).patch(`/maintenance/${job._id}`, { status: "completed" });

      expect(again.status).toBe(409);
      expect(await GeneratorMaintenance.countDocuments({ generator: gen._id })).toBe(2); // original + one next
    });
  });

  describe("deleting a job (DELETE /maintenance/:id)", () => {
    it("permanently removes it, then returns 404", async () => {
      const { admin } = await makeUsers();
      const job = await insertJob(await createGenerator());

      expect((await as(admin).delete(`/maintenance/${job._id}`)).status).toBe(200);
      expect(await GeneratorMaintenance.findById(job._id)).toBeNull();
      expect((await as(admin).delete(`/maintenance/${job._id}`)).status).toBe(404);
      expect((await as(admin).delete(`/maintenance/${UNKNOWN_ID}`)).status).toBe(404);
    });
  });

  describe("alerts feed (GET /maintenance/alerts)", () => {
    // Fixtures are kept well away from any day boundary (3, 20 and 60 days out;
    // 1 and 5 days back), so the test can't flip if it runs across midnight UTC.
    async function seedAlerts() {
      const users = await makeUsers();
      const gen = await createGenerator();
      const deletedGen = await createGenerator({ isActive: false });
      await insertJob(gen, { description: "overdue-5", scheduledDate: inDays(-5) });
      await insertJob(gen, { description: "overdue-1", scheduledDate: inDays(-1) });
      await insertJob(gen, { description: "due-3", scheduledDate: inDays(3) });
      await insertJob(gen, { description: "due-20-own-threshold-30", scheduledDate: inDays(20), alertThresholdDays: 30 });
      await insertJob(gen, { description: "far-60", scheduledDate: inDays(60) });
      await insertJob(gen, { description: "done", scheduledDate: inDays(-40), status: "completed" });
      await insertJob(gen, { description: "cancelled", scheduledDate: inDays(-40), status: "cancelled" });
      await insertJob(deletedGen, { description: "on-a-deleted-generator", scheduledDate: inDays(-9) });
      return { ...users, gen };
    }
    const names = (list) => list.map((j) => j.description);

    it("splits open jobs into overdue and upcoming using each job's own alert threshold", async () => {
      const { staff } = await seedAlerts();

      const res = await as(staff).get("/maintenance/alerts");

      expect(res.status).toBe(200);
      expect(names(res.body.data.overdue)).toEqual(["overdue-5", "overdue-1"]); // most overdue first
      expect(names(res.body.data.upcoming)).toEqual(["due-3", "due-20-own-threshold-30"]); // soonest first
      expect(res.body.data.counts).toEqual({ overdue: 2, upcoming: 2 });
    });

    it("leaves out completed and cancelled jobs, far-off jobs, and jobs on deleted generators", async () => {
      const { staff } = await seedAlerts();

      const res = await as(staff).get("/maintenance/alerts");
      const everything = [...names(res.body.data.overdue), ...names(res.body.data.upcoming)];

      for (const excluded of ["done", "cancelled", "far-60", "on-a-deleted-generator"]) {
        expect(everything).not.toContain(excluded);
      }
    });

    it("describes each alert: status, days until due, and the generator", async () => {
      const { staff, gen } = await seedAlerts();

      const { overdue, upcoming } = (await as(staff).get("/maintenance/alerts")).body.data;

      expect(overdue[0]).toMatchObject({ alertStatus: "overdue", generator: { tag: gen.tag, name: gen.name } });
      expect(overdue[0].daysUntilDue).toBeLessThan(0);
      expect(upcoming[0].alertStatus).toBe("upcoming");
      expect(upcoming[0].daysUntilDue).toBeGreaterThanOrEqual(0);
    });

    it("lets ?withinDays override every job's own threshold", async () => {
      const { staff } = await seedAlerts();
      const upcoming = async (qs) => names((await as(staff).get(`/maintenance/alerts?${qs}`)).body.data.upcoming);

      expect(await upcoming("withinDays=90")).toEqual(["due-3", "due-20-own-threshold-30", "far-60"]); // looks further ahead
      expect(await upcoming("withinDays=10")).toEqual(["due-3"]); // due-20 is now outside the window despite its own 30-day threshold
      expect(await upcoming("withinDays=1")).toEqual([]);
    });

    it("never hides overdue jobs, whatever the window", async () => {
      const { staff } = await seedAlerts();

      const res = await as(staff).get("/maintenance/alerts?withinDays=0");

      expect(names(res.body.data.overdue)).toEqual(["overdue-5", "overdue-1"]);
    });

    it("returns empty lists when nothing needs attention", async () => {
      const { staff } = await makeUsers();

      const res = await as(staff).get("/maintenance/alerts");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ counts: { overdue: 0, upcoming: 0 }, overdue: [], upcoming: [] });
    });

    it.each(["abc", "-1", "1.5", "366", ""])("rejects withinDays=%j with 400", async (value) => {
      const { staff } = await makeUsers();

      expect((await as(staff).get(`/maintenance/alerts?withinDays=${value}`)).status).toBe(400);
    });

    it("is not mistaken for /maintenance/:id", async () => {
      const { staff } = await makeUsers();

      const res = await as(staff).get("/maintenance/alerts");

      expect(res.body.data.counts).toBeDefined();
    });

    it("flags a job overdue by running hours even though its date is far off, and the list endpoint agrees", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator({ runningHoursTotal: 520 });
      const job = await insertJob(gen, { scheduledDate: inDays(3650), intervalHours: 500, hoursAtScheduling: 0 });

      const alerts = await as(staff).get("/maintenance/alerts");
      const found = alerts.body.data.overdue.find((j) => j._id === job._id.toString());
      expect(found).toBeTruthy();
      expect(found.hoursUntilDue).toBe(-20);

      const list = await as(staff).get(`/maintenance?generatorId=${gen._id}`);
      const listed = list.body.data.find((j) => j._id === job._id.toString());
      expect(listed.alertStatus).toBe("overdue"); // the list endpoint isn't left showing a stale status
    });
  });

  describe("invoice attachment (POST/GET/DELETE /maintenance/:id/invoice)", () => {
    const attach = (req, filename = "invoice.pdf", contentType = "application/pdf", contents = "%PDF fake") =>
      req.attach("invoice", Buffer.from(contents), { filename, contentType });

    // Clears what a test wrote, but keeps the folder itself — uploadInvoice.js
    // only creates it once, at import time, so deleting the folder itself
    // would break every upload after the first test in this block.
    afterEach(() => {
      if (!fs.existsSync(invoiceUploadDir)) return;
      for (const name of fs.readdirSync(invoiceUploadDir)) fs.rmSync(`${invoiceUploadDir}/${name}`, { force: true });
    });

    it("a manager can upload one, and staff can only download it", async () => {
      const { manager, staff } = await makeUsers();
      const job = await insertJob(await createGenerator());

      const uploaded = await attach(as(manager).postFile(`/maintenance/${job._id}/invoice`), "receipt.pdf");
      expect(uploaded.status).toBe(200);
      expect(uploaded.body.data.invoice).toMatchObject({ fileName: "receipt.pdf", mimeType: "application/pdf" });
      expect(uploaded.body.data.invoice.storedName).not.toBe("receipt.pdf"); // never the client-supplied name

      expect((await attach(as(staff).postFile(`/maintenance/${job._id}/invoice`))).status).toBe(403);

      const downloaded = await as(staff).get(`/maintenance/${job._id}/invoice`);
      expect(downloaded.status).toBe(200);
      expect(downloaded.headers["content-disposition"]).toContain("receipt.pdf"); // the ORIGINAL name, not the stored one
      expect(downloaded.headers["content-type"]).toBe("application/pdf");

      expect((await as(staff).delete(`/maintenance/${job._id}/invoice`)).status).toBe(403);
    });

    it("rejects a file that isn't a PDF/JPG/PNG, and one over the size limit", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());

      const wrongType = await attach(as(manager).postFile(`/maintenance/${job._id}/invoice`), "notes.txt", "text/plain");
      expect(wrongType.status).toBe(400);

      const tooBig = await as(manager)
        .postFile(`/maintenance/${job._id}/invoice`)
        .attach("invoice", Buffer.alloc(6 * 1024 * 1024, 1), { filename: "big.pdf", contentType: "application/pdf" });
      expect(tooBig.status).toBe(400);

      const noFile = await as(manager).postFile(`/maintenance/${job._id}/invoice`);
      expect(noFile.status).toBe(400);

      expect((await GeneratorMaintenance.findById(job._id)).invoice).toBeUndefined();
    });

    it("uploading to an unknown job is 404, and the file it had already written to disk does not linger", async () => {
      const { manager } = await makeUsers();

      const res = await attach(as(manager).postFile(`/maintenance/${UNKNOWN_ID}/invoice`));

      expect(res.status).toBe(404);
      expect(fs.existsSync(invoiceUploadDir) ? fs.readdirSync(invoiceUploadDir) : []).toHaveLength(0);
    });

    it("uploading again replaces the invoice — the old file is removed, the new one takes over", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());
      await attach(as(manager).postFile(`/maintenance/${job._id}/invoice`), "first.pdf");
      const firstStoredName = (await GeneratorMaintenance.findById(job._id)).invoice.storedName;

      const replaced = await attach(as(manager).postFile(`/maintenance/${job._id}/invoice`), "second.pdf");

      expect(replaced.body.data.invoice.fileName).toBe("second.pdf");
      expect(fs.existsSync(`${invoiceUploadDir}/${firstStoredName}`)).toBe(false);
      expect(fs.readdirSync(invoiceUploadDir)).toHaveLength(1);
    });

    it("downloading is 404 for an unknown job and for a job with no invoice", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());

      expect((await as(manager).get(`/maintenance/${UNKNOWN_ID}/invoice`)).status).toBe(404);
      expect((await as(manager).get(`/maintenance/${job._id}/invoice`)).status).toBe(404);
    });

    it("a manager can delete the invoice, leaving the maintenance job itself untouched", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator(), { notes: "keep me" });
      await attach(as(manager).postFile(`/maintenance/${job._id}/invoice`));
      const storedName = (await GeneratorMaintenance.findById(job._id)).invoice.storedName;

      const res = await as(manager).delete(`/maintenance/${job._id}/invoice`);

      expect(res.status).toBe(200);
      expect(res.body.data.invoice).toBeUndefined();
      expect(res.body.data.notes).toBe("keep me");
      expect(fs.existsSync(`${invoiceUploadDir}/${storedName}`)).toBe(false);
    });

    it("deleting is 404 for an unknown job and for a job with no invoice, and changes nothing", async () => {
      const { manager } = await makeUsers();
      const job = await insertJob(await createGenerator());

      expect((await as(manager).delete(`/maintenance/${UNKNOWN_ID}/invoice`)).status).toBe(404);
      expect((await as(manager).delete(`/maintenance/${job._id}/invoice`)).status).toBe(404);
    });

    it("deleting the whole maintenance job also removes its invoice file", async () => {
      const { admin, manager } = await makeUsers();
      const job = await insertJob(await createGenerator());
      await attach(as(manager).postFile(`/maintenance/${job._id}/invoice`));
      const storedName = (await GeneratorMaintenance.findById(job._id)).invoice.storedName;

      expect((await as(admin).delete(`/maintenance/${job._id}`)).status).toBe(200);

      expect(fs.existsSync(`${invoiceUploadDir}/${storedName}`)).toBe(false);
    });
  });
});
