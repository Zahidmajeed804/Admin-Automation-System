import { as, anonymous, makeUsers, createGenerator, UNKNOWN_ID } from "./helpers/generatorTestUtils.js";
import { GeneratorLog, GeneratorMaintenance } from "../src/models/index.js";

// Every report endpoint, and the query each needs to pass validation cleanly.
const ENDPOINTS = [
  ["/reports/running-hours", {}],
  ["/reports/diesel-consumption", {}],
  ["/reports/fuel-cost", {}],
  ["/reports/maintenance-cost", {}],
  ["/reports/operating-cost", {}],
  ["/reports/service-history", {}],
  ["/reports/cost-summary", {}],
];
const toQuery = (params) => (Object.keys(params).length ? `?${new URLSearchParams(params)}` : "");

describe("Generator reports API — /api/v1/generator/reports", () => {
  describe("authentication and permissions", () => {
    it("rejects every report without a token (401)", async () => {
      for (const [path] of ENDPOINTS) {
        expect((await anonymous.get(path)).status).toBe(401);
      }
    });

    it("staff cannot read any report (403) even though staff can read generators/logs/maintenance", async () => {
      const { staff } = await makeUsers();
      for (const [path] of ENDPOINTS) {
        expect((await as(staff).get(path)).status).toBe(403);
      }
    });

    it("manager and admin can read every report (200)", async () => {
      const { admin, manager } = await makeUsers();
      for (const [path] of ENDPOINTS) {
        expect((await as(manager).get(path)).status).toBe(200);
        expect((await as(admin).get(path)).status).toBe(200);
      }
    });
  });

  describe("validation", () => {
    it("rejects a malformed month (running-hours, fuel-cost)", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/running-hours?month=2026-13")).status).toBe(400);
      expect((await as(admin).get("/reports/fuel-cost?month=not-a-month")).status).toBe(400);
    });

    it("rejects an invalid generatorId", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/diesel-consumption?generatorId=not-an-id")).status).toBe(400);
    });

    it("rejects an out-of-range year (operating-cost)", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/operating-cost?year=1800")).status).toBe(400);
    });

    it("rejects an invalid status (service-history)", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/service-history?status=bogus")).status).toBe(400);
    });

    it("rejects a from after to (diesel-consumption, maintenance-cost, cost-summary)", async () => {
      const { admin } = await makeUsers();
      const badRange = toQuery({ from: "2026-05-01", to: "2026-01-01" });
      expect((await as(admin).get(`/reports/diesel-consumption${badRange}`)).status).toBe(400);
      expect((await as(admin).get(`/reports/maintenance-cost${badRange}`)).status).toBe(400);
      expect((await as(admin).get(`/reports/cost-summary${badRange}`)).status).toBe(400);
    });

    it("404s a report scoped to a generator that doesn't exist", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get(`/reports/running-hours?generatorId=${UNKNOWN_ID}`)).status).toBe(404);
    });
  });

  describe("end-to-end wiring (spot checks over real HTTP)", () => {
    it("running-hours report reflects a real logged entry", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      await GeneratorLog.create({ generator: gen._id, date: new Date(), hoursRun: 12, recordedBy: gen._id });

      const res = await as(admin).get("/reports/running-hours");
      expect(res.status).toBe(200);
      const row = res.body.data.generators.find((g) => g.generator.id === String(gen._id));
      expect(row.hoursRun).toBe(12);
    });

    it("cost-summary report reflects a real completed maintenance job", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      await GeneratorMaintenance.create({ generator: gen._id, description: "Service", status: "completed", scheduledDate: new Date(), completedDate: new Date(), cost: 250 });

      const res = await as(admin).get("/reports/cost-summary");
      expect(res.status).toBe(200);
      const row = res.body.data.generators.find((g) => g.generator.id === String(gen._id));
      expect(row.maintenanceCost).toBe(250);
      expect(row.totalCost).toBe(250);
    });

    it("service-history report is paginated the same way as the other list endpoints (meta on the envelope)", async () => {
      const { admin } = await makeUsers();
      const gen = await createGenerator();
      await GeneratorMaintenance.create({ generator: gen._id, description: "Service", status: "completed", scheduledDate: new Date(), completedDate: new Date() });

      const res = await as(admin).get("/reports/service-history?pageSize=1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1 });
    });
  });
});
