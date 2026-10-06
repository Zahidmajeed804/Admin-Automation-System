import request from "supertest";
import app from "../src/app.js";
import { makeUsers } from "./helpers/generatorTestUtils.js";
import { createUserWithRole } from "./helpers/testAuth.js";
import { Attendance } from "../src/models/index.js";

const API = "/api/v1";
const UNKNOWN_ID = "64b1f0c0c0c0c0c0c0c0c0c0";

const as = (user) => ({
  get: (path) => request(app).get(API + path).set("Authorization", `Bearer ${user.token}`),
});
const anonymous = { get: (path) => request(app).get(API + path) };

const toQuery = (params) => (Object.keys(params).length ? `?${new URLSearchParams(params)}` : "");

const day = (s) => new Date(s); // "YYYY-MM-DD" is already midnight UTC, matching startOfDay's normalization

describe("Attendance Summary report API — /api/v1/reports/attendance-summary", () => {
  describe("authentication and permissions", () => {
    it("rejects without a token (401)", async () => {
      expect((await anonymous.get("/reports/attendance-summary")).status).toBe(401);
      expect((await anonymous.get("/reports/attendance-summary/export")).status).toBe(401);
    });

    it("staff cannot read the report or export it (403)", async () => {
      const { staff } = await makeUsers();
      expect((await as(staff).get("/reports/attendance-summary")).status).toBe(403);
      expect((await as(staff).get("/reports/attendance-summary/export")).status).toBe(403);
    });

    it("manager and admin can read the report (200)", async () => {
      const { admin, manager } = await makeUsers();
      expect((await as(manager).get("/reports/attendance-summary")).status).toBe(200);
      expect((await as(admin).get("/reports/attendance-summary")).status).toBe(200);
    });
  });

  describe("validation", () => {
    it("rejects an invalid employeeId", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/attendance-summary?employeeId=not-an-id")).status).toBe(400);
    });

    it("rejects a malformed from/to date", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/attendance-summary?from=not-a-date")).status).toBe(400);
    });

    it("rejects a from after to", async () => {
      const { admin } = await makeUsers();
      const badRange = toQuery({ from: "2026-05-01", to: "2026-01-01" });
      expect((await as(admin).get(`/reports/attendance-summary${badRange}`)).status).toBe(400);
    });

    it("404s a report scoped to an employeeId that doesn't exist", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get(`/reports/attendance-summary?employeeId=${UNKNOWN_ID}`)).status).toBe(404);
    });

    it("rejects an unsupported export format", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/attendance-summary/export?format=xml")).status).toBe(400);
    });
  });

  describe("counts and worked hours (real attendance records)", () => {
    it("aggregates per-status counts and worked hours for a scoped employee", async () => {
      const { admin } = await makeUsers();
      const { user: alice } = await createUserWithRole("staff", { name: "Alice", department: "Ops" });

      await Attendance.create({ user: alice._id, date: day("2026-03-01"), status: "present", workedMinutes: 480 });
      await Attendance.create({ user: alice._id, date: day("2026-03-02"), status: "late", workedMinutes: 420 });
      await Attendance.create({ user: alice._id, date: day("2026-03-03"), status: "half-day", workedMinutes: 180 });
      await Attendance.create({ user: alice._id, date: day("2026-03-04"), status: "absent", workedMinutes: 0 });

      const range = toQuery({ employeeId: String(alice._id), from: "2026-03-01", to: "2026-03-04" });
      const res = await as(admin).get(`/reports/attendance-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      const row = res.body.data.employees[0];
      expect(row.employee.name).toBe("Alice");
      expect(row.present).toBe(1);
      expect(row.late).toBe(1);
      expect(row.halfDay).toBe(1);
      expect(row.absent).toBe(1);
      expect(row.totalDays).toBe(4);
      expect(row.workedHours).toBe(18); // (480+420+180+0)/60
      expect(res.body.data.totalWorkedHours).toBe(18);
      expect(res.body.data.totalDays).toBe(4);
    });

    it("a record outside the range is not counted (range boundaries are inclusive, not beyond)", async () => {
      const { admin } = await makeUsers();
      const { user: bob } = await createUserWithRole("staff", { name: "Bob" });
      await Attendance.create({ user: bob._id, date: day("2026-03-01"), status: "present", workedMinutes: 60 });
      await Attendance.create({ user: bob._id, date: day("2026-03-05"), status: "present", workedMinutes: 60 }); // out of range below

      const range = toQuery({ employeeId: String(bob._id), from: "2026-03-01", to: "2026-03-01" });
      const res = await as(admin).get(`/reports/attendance-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees[0].totalDays).toBe(1);
      expect(res.body.data.employees[0].workedHours).toBe(1);
    });

    it("from === to (a single day) includes just that day's record", async () => {
      const { admin } = await makeUsers();
      const { user: carol } = await createUserWithRole("staff", { name: "Carol" });
      await Attendance.create({ user: carol._id, date: day("2026-03-02"), status: "present", workedMinutes: 300 });

      const range = toQuery({ employeeId: String(carol._id), from: "2026-03-02", to: "2026-03-02" });
      const res = await as(admin).get(`/reports/attendance-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees[0].totalDays).toBe(1);
      expect(res.body.data.employees[0].workedHours).toBe(5);
    });
  });

  describe("zero-row and scoping", () => {
    it("an employee with no attendance records in range still appears, zeroed", async () => {
      const { admin } = await makeUsers();
      const { user: dana } = await createUserWithRole("staff", { name: "Dana" });

      const range = toQuery({ employeeId: String(dana._id), from: "2026-03-01", to: "2026-03-31" });
      const res = await as(admin).get(`/reports/attendance-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      expect(res.body.data.employees[0]).toMatchObject({ present: 0, absent: 0, halfDay: 0, late: 0, totalDays: 0, workedHours: 0 });
    });

    it("without employeeId, every employee appears (company-wide)", async () => {
      const { admin } = await makeUsers();
      await createUserWithRole("staff", { name: "Eve" });
      await createUserWithRole("staff", { name: "Frank" });

      const res = await as(admin).get("/reports/attendance-summary");
      expect(res.status).toBe(200);
      const names = res.body.data.employees.map((e) => e.employee.name);
      expect(names).toEqual(expect.arrayContaining(["Eve", "Frank"]));
    });

    it("scoping to one employeeId excludes every other employee's row", async () => {
      const { admin } = await makeUsers();
      const { user: grace } = await createUserWithRole("staff", { name: "Grace" });
      await createUserWithRole("staff", { name: "Heidi" });

      const res = await as(admin).get(`/reports/attendance-summary${toQuery({ employeeId: String(grace._id) })}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      expect(res.body.data.employees[0].employee.name).toBe("Grace");
    });
  });

  describe("export headers", () => {
    it("csv export: correct content-type/content-disposition and a real CSV body", async () => {
      const { admin } = await makeUsers();
      const { user: alice } = await createUserWithRole("staff", { name: "Alice" });
      await Attendance.create({ user: alice._id, date: day("2026-03-01"), status: "present", workedMinutes: 60 });

      const res = await as(admin).get(`/reports/attendance-summary/export${toQuery({ format: "csv", employeeId: String(alice._id) })}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="attendance-summary-.*\.csv"$/);
      expect(res.text.split("\n")[0]).toBe("Employee,Employee ID,Department,Present,Absent,Half Day,Late,Total Days,Worked Hours");
      expect(res.text).toContain("Alice");
    });

    it("pdf export: correct content-type/content-disposition and a real PDF body", async () => {
      const { admin } = await makeUsers();
      const res = await request(app)
        .get(`${API}/reports/attendance-summary/export?format=pdf`)
        .set("Authorization", `Bearer ${admin.token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="attendance-summary-.*\.pdf"$/);
      expect(res.body.slice(0, 4).toString()).toBe("%PDF");
    });

    it("defaults to csv when format is omitted", async () => {
      const { admin } = await makeUsers();
      const res = await as(admin).get("/reports/attendance-summary/export");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
    });
  });
});
