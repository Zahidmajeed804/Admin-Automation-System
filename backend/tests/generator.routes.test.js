import { as, anonymous, makeUsers, createGenerator, UNKNOWN_ID } from "./helpers/generatorTestUtils.js";
import { jest } from "@jest/globals";
import { Generator, GeneratorLog, GeneratorMaintenance } from "../src/models/index.js";
import { generatorMaintenanceRepository } from "../src/repositories/generatorMaintenanceRepository.js";

describe("Generator registry API — /api/v1/generator", () => {
  describe("authentication and permissions", () => {
    it("rejects every request without a token (401)", async () => {
      expect((await anonymous.get("/")).status).toBe(401);
      expect((await anonymous.post("/", { tag: "X", name: "X" })).status).toBe(401);
      expect((await anonymous.get(`/${UNKNOWN_ID}`)).status).toBe(401);
      expect((await anonymous.patch(`/${UNKNOWN_ID}`, {})).status).toBe(401);
      expect((await anonymous.delete(`/${UNKNOWN_ID}`)).status).toBe(401);
    });

    it("staff can read but not create, update or delete", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator();

      expect((await as(staff).get("/")).status).toBe(200);
      expect((await as(staff).get(`/${gen._id}`)).status).toBe(200);
      expect((await as(staff).post("/", { tag: "S-1", name: "Nope" })).status).toBe(403);
      expect((await as(staff).patch(`/${gen._id}`, { status: "faulty" })).status).toBe(403);
      expect((await as(staff).delete(`/${gen._id}`)).status).toBe(403);
    });

    it("a manager can create and update but not delete", async () => {
      const { manager } = await makeUsers();

      const created = await as(manager).post("/", { tag: "M-1", name: "Managed" });
      expect(created.status).toBe(201);
      const id = created.body.data._id;
      expect((await as(manager).patch(`/${id}`, { status: "under_maintenance" })).status).toBe(200);
      expect((await as(manager).delete(`/${id}`)).status).toBe(403);
    });
  });

  describe("create (POST /)", () => {
    it("creates a generator, applies the defaults and records who created it", async () => {
      const { admin } = await makeUsers();

      const res = await as(admin).post("/", { tag: "GEN-01", name: "Main Hall", location: "Basement", capacityKVA: 50 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true, message: "Generator created" });
      expect(res.body.data).toMatchObject({
        tag: "GEN-01",
        name: "Main Hall",
        location: "Basement",
        capacityKVA: 50,
        status: "operational",
        fuelType: "diesel",
        runningHoursTotal: 0,
        isActive: true,
        createdBy: admin.user._id.toString(),
      });
    });

    it("rejects a duplicate tag with 409", async () => {
      const { admin } = await makeUsers();
      await Generator.init(); // make sure the unique index exists before relying on it
      await as(admin).post("/", { tag: "DUP", name: "First" });

      const res = await as(admin).post("/", { tag: "DUP", name: "Second" });

      expect(res.status).toBe(409);
    });

    it.each([
      ["a missing tag", { name: "No tag" }],
      ["a missing name", { tag: "T-1" }],
      ["a blank tag", { tag: "   ", name: "Blank" }],
      ["an unknown status", { tag: "T-2", name: "N", status: "on_fire" }],
      ["an unknown fuel type", { tag: "T-3", name: "N", fuelType: "unobtainium" }],
      ["a negative capacity", { tag: "T-4", name: "N", capacityKVA: -1 }],
      ["a negative tank size", { tag: "T-5", name: "N", fuelTankCapacityLiters: -10 }],
      ["an invalid installation date", { tag: "T-6", name: "N", installationDate: "yesterday-ish" }],
    ])("rejects %s with 400", async (_label, payload) => {
      const { admin } = await makeUsers();

      const res = await as(admin).post("/", payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(await Generator.countDocuments()).toBe(0);
    });
  });

  describe("read (GET / and GET /:id)", () => {
    it("lists generators with pagination metadata", async () => {
      const { staff } = await makeUsers();
      for (let i = 0; i < 5; i++) await createGenerator();

      const res = await as(staff).get("/?page=2&pageSize=2");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ page: 2, pageSize: 2, totalItems: 5, totalPages: 3 });
    });

    it("filters by status and location, and searches name and tag case-insensitively", async () => {
      const { staff } = await makeUsers();
      await createGenerator({ tag: "NORTH-1", name: "North Wing", location: "North", status: "operational" });
      await createGenerator({ tag: "NORTH-2", name: "Spare", location: "North", status: "faulty" });
      await createGenerator({ tag: "SOUTH-1", name: "Warehouse Unit", location: "South", status: "operational" });

      const tags = async (query) => (await as(staff).get(`/?${query}`)).body.data.map((g) => g.tag).sort();

      expect(await tags("status=faulty")).toEqual(["NORTH-2"]);
      expect(await tags("location=South")).toEqual(["SOUTH-1"]);
      expect(await tags("status=operational&location=North")).toEqual(["NORTH-1"]);
      expect(await tags("search=warehouse")).toEqual(["SOUTH-1"]); // matches name
      expect(await tags("search=north-2")).toEqual(["NORTH-2"]); // matches tag
      expect(await tags("search=nothing-matches")).toEqual([]);
    });

    it("returns one generator by id, and 404 for an unknown id", async () => {
      const { staff } = await makeUsers();
      const gen = await createGenerator({ name: "Findable" });

      const found = await as(staff).get(`/${gen._id}`);
      expect(found.status).toBe(200);
      expect(found.body.data.name).toBe("Findable");

      expect((await as(staff).get(`/${UNKNOWN_ID}`)).status).toBe(404);
    });

    it("returns 400 (not a server error) for a malformed id", async () => {
      const { staff } = await makeUsers();

      expect((await as(staff).get("/not-an-id")).status).toBe(400);
    });
  });

  describe("update (PATCH /:id)", () => {
    it("updates the given fields and records who updated it", async () => {
      const { manager } = await makeUsers();
      const gen = await createGenerator({ name: "Before", location: "Old" });

      const res = await as(manager).patch(`/${gen._id}`, { name: "After", status: "faulty" });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ name: "After", status: "faulty", location: "Old", updatedBy: manager.user._id.toString() });
      expect((await Generator.findById(gen._id)).name).toBe("After");
    });

    it("returns 404 for an unknown id and 409 when changing a tag to one already used", async () => {
      const { manager } = await makeUsers();
      await Generator.init();
      await createGenerator({ tag: "TAKEN" });
      const other = await createGenerator({ tag: "FREE" });

      expect((await as(manager).patch(`/${UNKNOWN_ID}`, { name: "x" })).status).toBe(404);
      expect((await as(manager).patch(`/${other._id}`, { tag: "TAKEN" })).status).toBe(409);
    });

    it.each([
      ["a blank name", { name: "" }],
      ["an unknown status", { status: "haunted" }],
      ["a negative capacity", { capacityKVA: -5 }],
    ])("rejects %s with 400 and changes nothing", async (_label, payload) => {
      const { manager } = await makeUsers();
      const gen = await createGenerator({ name: "Stable", status: "operational" });

      const res = await as(manager).patch(`/${gen._id}`, payload);

      expect(res.status).toBe(400);
      const after = await Generator.findById(gen._id);
      expect(after.name).toBe("Stable");
      expect(after.status).toBe("operational");
    });
  });

  describe("delete (DELETE /:id)", () => {
    afterEach(() => jest.restoreAllMocks());

    it("deletes permanently: gone from reads and gone from the database", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(admin).delete(`/${gen._id}`);

      expect(res.status).toBe(200);
      expect((await as(admin).get(`/${gen._id}`)).status).toBe(404);
      expect((await as(admin).get("/")).body.meta.totalItems).toBe(0);
      expect(await Generator.findById(gen._id)).toBeNull(); // not kept as an inactive record
      expect(await Generator.countDocuments()).toBe(0);
    });

    it("also deletes the generator's logs and maintenance records, and only its own", async () => {
      const { admin, manager } = await makeUsers();
      const gone = await createGenerator();
      const kept = await createGenerator();
      for (const gen of [gone, kept]) {
        await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 2 });
        await as(manager).post("/logs", { generatorId: gen._id, hoursRun: 3 });
        await GeneratorMaintenance.create({ generator: gen._id, description: "Oil change", scheduledDate: new Date("2027-01-01") });
      }

      const res = await as(admin).delete(`/${gone._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toEqual({ logs: 2, maintenance: 1 });
      expect(await GeneratorLog.countDocuments({ generator: gone._id })).toBe(0);
      expect(await GeneratorMaintenance.countDocuments({ generator: gone._id })).toBe(0);
      expect(await GeneratorLog.countDocuments({ generator: kept._id })).toBe(2);
      expect(await GeneratorMaintenance.countDocuments({ generator: kept._id })).toBe(1);
      expect((await Generator.findById(kept._id)).runningHoursTotal).toBe(5);
    });

    it("deleting a generator with no logs or maintenance works and reports zero", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();

      const res = await as(admin).delete(`/${gen._id}`);

      expect(res.body.data.deleted).toEqual({ logs: 0, maintenance: 0 });
    });

    it("frees the tag, so a generator with the same tag can be added again", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator({ tag: "GEN-REUSE" });
      await as(admin).delete(`/${gen._id}`);

      const again = await as(admin).post("/", { tag: "GEN-REUSE", name: "Replacement" });

      expect(again.status).toBe(201);
      expect(again.body.data.name).toBe("Replacement");
    });

    it("leaves the generator in place if clearing its records fails, so the delete can be repeated", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      await GeneratorMaintenance.create({ generator: gen._id, description: "x", scheduledDate: new Date("2027-01-01") });
      const spy = jest.spyOn(generatorMaintenanceRepository, "deleteByGenerator").mockRejectedValueOnce(new Error("database hiccup"));

      const failed = await as(admin).delete(`/${gen._id}`);

      expect(failed.status).toBe(500);
      expect(await Generator.findById(gen._id)).not.toBeNull();
      spy.mockRestore();
      expect((await as(admin).delete(`/${gen._id}`)).status).toBe(200);
      expect(await Generator.findById(gen._id)).toBeNull();
      expect(await GeneratorMaintenance.countDocuments({ generator: gen._id })).toBe(0);
    });

    it("still treats a generator deleted the old way (isActive false) as not found, and cannot delete it again", async () => {
      const { admin } = await makeUsers();
      const legacy = await createGenerator({ isActive: false });

      expect((await as(admin).get(`/${legacy._id}`)).status).toBe(404);
      expect((await as(admin).delete(`/${legacy._id}`)).status).toBe(404);
    });

    it("returns 404 for an unknown id or one that is already deleted", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      await as(admin).delete(`/${gen._id}`);

      expect((await as(admin).delete(`/${gen._id}`)).status).toBe(404);
      expect((await as(admin).delete(`/${UNKNOWN_ID}`)).status).toBe(404);
    });

    it("a deleted generator can no longer be updated", async () => {
      const { admin, manager } = await makeUsers();
      const gen = await createGenerator();
      await as(admin).delete(`/${gen._id}`);

      expect((await as(manager).patch(`/${gen._id}`, { name: "Zombie" })).status).toBe(404);
    });
  });

  // Known gap, documented rather than hidden: create/update spread the whole
  // request body into the database write, so a client can set fields the
  // service is meant to own. These become real tests once the controller
  // whitelists its editable fields.
  it.todo("ignores runningHoursTotal, lastServiceDate and isActive supplied by the client on create");
  it.todo("ignores runningHoursTotal, lastServiceDate and isActive supplied by the client on update");
});
