import request from "supertest";
import app from "../src/app.js";
import { makeUsers } from "./helpers/generatorTestUtils.js";
import { createUserWithRole } from "./helpers/testAuth.js";
import { leaveService } from "../src/services/leaveService.js";
import { LeaveRequest } from "../src/models/index.js";

const API = "/api/v1";
const UNKNOWN_ID = "64b1f0c0c0c0c0c0c0c0c0c0";

const as = (user) => ({
  get: (path) => request(app).get(API + path).set("Authorization", `Bearer ${user.token}`),
});
const anonymous = { get: (path) => request(app).get(API + path) };

const toQuery = (params) => (Object.keys(params).length ? `?${new URLSearchParams(params)}` : "");

describe("Leave Usage report API — /api/v1/reports/leave-usage", () => {
  describe("authentication and permissions", () => {
    it("rejects without a token (401)", async () => {
      expect((await anonymous.get("/reports/leave-usage")).status).toBe(401);
      expect((await anonymous.get("/reports/leave-usage/export")).status).toBe(401);
    });

    it("staff cannot read the report or export it (403)", async () => {
      const { staff } = await makeUsers();
      expect((await as(staff).get("/reports/leave-usage")).status).toBe(403);
      expect((await as(staff).get("/reports/leave-usage/export")).status).toBe(403);
    });

    it("manager and admin can read the report (200)", async () => {
      const { admin, manager } = await makeUsers();
      expect((await as(manager).get("/reports/leave-usage")).status).toBe(200);
      expect((await as(admin).get("/reports/leave-usage")).status).toBe(200);
    });
  });

  describe("validation", () => {
    it("rejects an invalid employeeId", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/leave-usage?employeeId=not-an-id")).status).toBe(400);
    });

    it("rejects an out-of-range year", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/leave-usage?year=1800")).status).toBe(400);
    });

    it("404s a report scoped to an employeeId that doesn't exist", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get(`/reports/leave-usage?employeeId=${UNKNOWN_ID}`)).status).toBe(404);
    });

    it("rejects an unsupported export format", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/leave-usage/export?format=xml")).status).toBe(400);
    });
  });

  describe("usage aggregation (real leave requests, per status)", () => {
    it("aggregates per-leaveType, per-status days and request counts for a scoped employee", async () => {
      const { admin } = await makeUsers();
      const { user: alice } = await createUserWithRole("staff", { name: "Alice", leaveAllocation: { casual: 10, sick: 5, annual: 15 } });

      await LeaveRequest.create({ user: alice._id, leaveType: "casual", startDate: new Date("2026-02-01"), endDate: new Date("2026-02-03"), totalDays: 3, status: "approved" });
      await LeaveRequest.create({ user: alice._id, leaveType: "casual", startDate: new Date("2026-03-01"), endDate: new Date("2026-03-01"), totalDays: 1, status: "pending" });
      await LeaveRequest.create({ user: alice._id, leaveType: "sick", startDate: new Date("2026-04-01"), endDate: new Date("2026-04-02"), totalDays: 2, status: "rejected" });

      const res = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(alice._id), year: "2026" })}`);
      expect(res.status).toBe(200);
      const casual = res.body.data.employees[0].leaveTypes.casual;
      expect(casual.approvedDays).toBe(3);
      expect(casual.pendingDays).toBe(1);
      expect(casual.requestCount).toBe(2);
      const sick = res.body.data.employees[0].leaveTypes.sick;
      expect(sick.rejectedDays).toBe(2);
      expect(sick.requestCount).toBe(1);
      expect(res.body.data.totalApprovedDays).toBe(3);
    });

    it("a request straddling the year boundary is clipped to each year", async () => {
      const { admin } = await makeUsers();
      const { user: bob } = await createUserWithRole("staff", { name: "Bob", leaveAllocation: { casual: 10, sick: 5, annual: 15 } });
      await LeaveRequest.create({ user: bob._id, leaveType: "annual", startDate: new Date("2025-12-28"), endDate: new Date("2026-01-03"), totalDays: 7, status: "approved" });

      const res2025 = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(bob._id), year: "2025" })}`);
      const res2026 = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(bob._id), year: "2026" })}`);
      expect(res2025.body.data.employees[0].leaveTypes.annual.approvedDays).toBe(4);
      expect(res2026.body.data.employees[0].leaveTypes.annual.approvedDays).toBe(3);
    });
  });

  describe("balance parity check (reportsService must match leaveService.getBalanceForYear exactly)", () => {
    it("used/pending/remaining for every quota leave type match leaveService.getBalanceForYear directly", async () => {
      const { admin } = await makeUsers();
      const { user: carol } = await createUserWithRole("staff", { name: "Carol", leaveAllocation: { casual: 8, sick: 6, annual: 20 } });

      await LeaveRequest.create({ user: carol._id, leaveType: "casual", startDate: new Date("2026-05-01"), endDate: new Date("2026-05-02"), totalDays: 2, status: "approved" });
      await LeaveRequest.create({ user: carol._id, leaveType: "sick", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01"), totalDays: 1, status: "pending" });
      await LeaveRequest.create({ user: carol._id, leaveType: "annual", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), totalDays: 5, status: "approved" });

      const res = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(carol._id), year: "2026" })}`);
      const row = res.body.data.employees[0];

      for (const [type, allocated] of [["casual", 8], ["sick", 6], ["annual", 20]]) {
        const direct = await leaveService.getBalanceForYear(carol._id, type, 2026, allocated);
        expect(row.leaveTypes[type]).toMatchObject({ allocated: direct.allocated, used: direct.used, pending: direct.pending, remaining: direct.remaining });
      }
    });

    it("unpaid leave carries no balance fields (no allocation to check)", async () => {
      const { admin } = await makeUsers();
      const { user: dana } = await createUserWithRole("staff", { name: "Dana" });
      await LeaveRequest.create({ user: dana._id, leaveType: "unpaid", startDate: new Date("2026-05-01"), endDate: new Date("2026-05-01"), totalDays: 1, status: "approved" });

      const res = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(dana._id), year: "2026" })}`);
      const unpaid = res.body.data.employees[0].leaveTypes.unpaid;
      expect(unpaid.approvedDays).toBe(1);
      expect(unpaid.allocated).toBeUndefined();
      expect(unpaid.remaining).toBeUndefined();
    });
  });

  describe("zero-row and scoping", () => {
    it("an employee with no leave requests in the year still appears, zeroed for every leave type", async () => {
      const { admin } = await makeUsers();
      const { user: eve } = await createUserWithRole("staff", { name: "Eve" });

      const res = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(eve._id), year: "2026" })}`);
      expect(res.status).toBe(200);
      const leaveTypes = res.body.data.employees[0].leaveTypes;
      for (const type of ["casual", "sick", "annual", "unpaid"]) {
        expect(leaveTypes[type]).toMatchObject({ requestCount: 0, approvedDays: 0, pendingDays: 0, rejectedDays: 0 });
      }
      expect(res.body.data.totalApprovedDays).toBe(0);
    });

    it("without employeeId, every employee appears (company-wide)", async () => {
      const { admin } = await makeUsers();
      await createUserWithRole("staff", { name: "Frank" });
      await createUserWithRole("staff", { name: "Grace" });

      const res = await as(admin).get("/reports/leave-usage");
      expect(res.status).toBe(200);
      const names = res.body.data.employees.map((e) => e.employee.name);
      expect(names).toEqual(expect.arrayContaining(["Frank", "Grace"]));
    });

    it("scoping to one employeeId excludes every other employee's row", async () => {
      const { admin } = await makeUsers();
      const { user: heidi } = await createUserWithRole("staff", { name: "Heidi" });
      await createUserWithRole("staff", { name: "Ivan" });

      const res = await as(admin).get(`/reports/leave-usage${toQuery({ employeeId: String(heidi._id) })}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      expect(res.body.data.employees[0].employee.name).toBe("Heidi");
    });
  });

  describe("export headers", () => {
    it("csv export: correct content-type/content-disposition and a flattened CSV body", async () => {
      const { admin } = await makeUsers();
      const { user: alice } = await createUserWithRole("staff", { name: "Alice", leaveAllocation: { casual: 10, sick: 5, annual: 15 } });

      const res = await as(admin).get(`/reports/leave-usage/export${toQuery({ format: "csv", employeeId: String(alice._id), year: "2026" })}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="leave-usage-2026\.csv"$/);
      expect(res.text).toContain("Alice");
      expect(res.text).toContain("Casual Allocated");
      expect(res.text).toContain("Unpaid Used");
    });

    it("pdf export: correct content-type/content-disposition and a real PDF body", async () => {
      const { admin } = await makeUsers();
      const res = await request(app)
        .get(`${API}/reports/leave-usage/export?format=pdf&year=2026`)
        .set("Authorization", `Bearer ${admin.token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="leave-usage-2026\.pdf"$/);
      expect(res.body.slice(0, 4).toString()).toBe("%PDF");
    });

    it("defaults to csv when format is omitted", async () => {
      const { admin } = await makeUsers();
      const res = await as(admin).get("/reports/leave-usage/export");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
    });
  });
});
