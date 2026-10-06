import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { makeUsers } from "./helpers/generatorTestUtils.js";
import { createUserWithRole } from "./helpers/testAuth.js";
import { OvertimeRequest } from "../src/models/index.js";

const API = "/api/v1";
const UNKNOWN_ID = "64b1f0c0c0c0c0c0c0c0c0c0";

const as = (user) => ({
  get: (path) => request(app).get(API + path).set("Authorization", `Bearer ${user.token}`),
});
const anonymous = { get: (path) => request(app).get(API + path) };

const toQuery = (params) => (Object.keys(params).length ? `?${new URLSearchParams(params)}` : "");

const day = (s) => new Date(s); // "YYYY-MM-DD" is already midnight UTC

// No referential-integrity check on OvertimeRequest.attendance at the DB
// layer, so tests create requests directly without a real Attendance doc —
// just a distinct ObjectId per request (the unique index is on `attendance`).
const fakeAttendanceId = () => new mongoose.Types.ObjectId();

describe("Overtime Summary report API — /api/v1/reports/overtime-summary", () => {
  describe("authentication and permissions", () => {
    it("rejects without a token (401)", async () => {
      expect((await anonymous.get("/reports/overtime-summary")).status).toBe(401);
      expect((await anonymous.get("/reports/overtime-summary/export")).status).toBe(401);
    });

    it("staff cannot read the report or export it (403)", async () => {
      const { staff } = await makeUsers();
      expect((await as(staff).get("/reports/overtime-summary")).status).toBe(403);
      expect((await as(staff).get("/reports/overtime-summary/export")).status).toBe(403);
    });

    it("manager and admin can read the report (200)", async () => {
      const { admin, manager } = await makeUsers();
      expect((await as(manager).get("/reports/overtime-summary")).status).toBe(200);
      expect((await as(admin).get("/reports/overtime-summary")).status).toBe(200);
    });
  });

  describe("validation", () => {
    it("rejects an invalid employeeId", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/overtime-summary?employeeId=not-an-id")).status).toBe(400);
    });

    it("rejects a malformed from/to date", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/overtime-summary?from=not-a-date")).status).toBe(400);
    });

    it("rejects a from after to", async () => {
      const { admin } = await makeUsers();
      const badRange = toQuery({ from: "2026-05-01", to: "2026-01-01" });
      expect((await as(admin).get(`/reports/overtime-summary${badRange}`)).status).toBe(400);
    });

    it("404s a report scoped to an employeeId that doesn't exist", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get(`/reports/overtime-summary?employeeId=${UNKNOWN_ID}`)).status).toBe(404);
    });

    it("rejects an unsupported export format", async () => {
      const { admin } = await makeUsers();
      expect((await as(admin).get("/reports/overtime-summary/export?format=xml")).status).toBe(400);
    });
  });

  describe("multiple statuses per employee (real overtime requests)", () => {
    it("aggregates per-status counts and approved hours for a scoped employee", async () => {
      const { admin } = await makeUsers();
      const { user: alice } = await createUserWithRole("staff", { name: "Alice", department: "Ops" });

      await OvertimeRequest.create({ user: alice._id, attendance: fakeAttendanceId(), date: day("2026-03-01"), overtimeMinutes: 60, status: "approved" });
      await OvertimeRequest.create({ user: alice._id, attendance: fakeAttendanceId(), date: day("2026-03-02"), overtimeMinutes: 90, status: "approved" });
      await OvertimeRequest.create({ user: alice._id, attendance: fakeAttendanceId(), date: day("2026-03-03"), overtimeMinutes: 45, status: "pending" });
      await OvertimeRequest.create({ user: alice._id, attendance: fakeAttendanceId(), date: day("2026-03-04"), overtimeMinutes: 30, status: "rejected" });

      const range = toQuery({ employeeId: String(alice._id), from: "2026-03-01", to: "2026-03-04" });
      const res = await as(admin).get(`/reports/overtime-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      const row = res.body.data.employees[0];
      expect(row.employee.name).toBe("Alice");
      expect(row.approved).toBe(2);
      expect(row.pending).toBe(1);
      expect(row.rejected).toBe(1);
      expect(row.totalRequests).toBe(4);
      expect(row.approvedHours).toBe(2.5); // (60+90)/60, pending/rejected minutes excluded
      expect(res.body.data.totalApprovedHours).toBe(2.5);
      expect(res.body.data.totalRequests).toBe(4);
    });

    it("pending and rejected requests don't contribute to approvedHours", async () => {
      const { admin } = await makeUsers();
      const { user: bob } = await createUserWithRole("staff", { name: "Bob" });
      await OvertimeRequest.create({ user: bob._id, attendance: fakeAttendanceId(), date: day("2026-03-01"), overtimeMinutes: 120, status: "pending" });
      await OvertimeRequest.create({ user: bob._id, attendance: fakeAttendanceId(), date: day("2026-03-02"), overtimeMinutes: 120, status: "rejected" });

      const range = toQuery({ employeeId: String(bob._id), from: "2026-03-01", to: "2026-03-02" });
      const res = await as(admin).get(`/reports/overtime-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees[0].approvedHours).toBe(0);
      expect(res.body.data.employees[0].totalRequests).toBe(2);
    });

    it("a record outside the range is not counted (range boundaries are inclusive, not beyond)", async () => {
      const { admin } = await makeUsers();
      const { user: carol } = await createUserWithRole("staff", { name: "Carol" });
      await OvertimeRequest.create({ user: carol._id, attendance: fakeAttendanceId(), date: day("2026-03-01"), overtimeMinutes: 60, status: "approved" });
      await OvertimeRequest.create({ user: carol._id, attendance: fakeAttendanceId(), date: day("2026-03-05"), overtimeMinutes: 60, status: "approved" }); // out of range

      const range = toQuery({ employeeId: String(carol._id), from: "2026-03-01", to: "2026-03-01" });
      const res = await as(admin).get(`/reports/overtime-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees[0].totalRequests).toBe(1);
      expect(res.body.data.employees[0].approvedHours).toBe(1);
    });

    it("from === to (a single day) includes just that day's request", async () => {
      const { admin } = await makeUsers();
      const { user: dana } = await createUserWithRole("staff", { name: "Dana" });
      await OvertimeRequest.create({ user: dana._id, attendance: fakeAttendanceId(), date: day("2026-03-02"), overtimeMinutes: 180, status: "approved" });

      const range = toQuery({ employeeId: String(dana._id), from: "2026-03-02", to: "2026-03-02" });
      const res = await as(admin).get(`/reports/overtime-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees[0].totalRequests).toBe(1);
      expect(res.body.data.employees[0].approvedHours).toBe(3);
    });
  });

  describe("zero-row and scoping", () => {
    it("an employee with no overtime requests in range still appears, zeroed", async () => {
      const { admin } = await makeUsers();
      const { user: eve } = await createUserWithRole("staff", { name: "Eve" });

      const range = toQuery({ employeeId: String(eve._id), from: "2026-03-01", to: "2026-03-31" });
      const res = await as(admin).get(`/reports/overtime-summary${range}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      expect(res.body.data.employees[0]).toMatchObject({ pending: 0, approved: 0, rejected: 0, totalRequests: 0, approvedHours: 0 });
    });

    it("without employeeId, every employee appears (company-wide)", async () => {
      const { admin } = await makeUsers();
      await createUserWithRole("staff", { name: "Frank" });
      await createUserWithRole("staff", { name: "Grace" });

      const res = await as(admin).get("/reports/overtime-summary");
      expect(res.status).toBe(200);
      const names = res.body.data.employees.map((e) => e.employee.name);
      expect(names).toEqual(expect.arrayContaining(["Frank", "Grace"]));
    });

    it("scoping to one employeeId excludes every other employee's row", async () => {
      const { admin } = await makeUsers();
      const { user: heidi } = await createUserWithRole("staff", { name: "Heidi" });
      await createUserWithRole("staff", { name: "Ivan" });

      const res = await as(admin).get(`/reports/overtime-summary${toQuery({ employeeId: String(heidi._id) })}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(1);
      expect(res.body.data.employees[0].employee.name).toBe("Heidi");
    });
  });

  describe("export headers", () => {
    it("csv export: correct content-type/content-disposition and a real CSV body", async () => {
      const { admin } = await makeUsers();
      const { user: alice } = await createUserWithRole("staff", { name: "Alice" });
      await OvertimeRequest.create({ user: alice._id, attendance: fakeAttendanceId(), date: day("2026-03-01"), overtimeMinutes: 60, status: "approved" });

      const res = await as(admin).get(`/reports/overtime-summary/export${toQuery({ format: "csv", employeeId: String(alice._id) })}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="overtime-summary-.*\.csv"$/);
      expect(res.text.split("\n")[0]).toBe("Employee,Employee ID,Department,Pending,Approved,Rejected,Total Requests,Approved Hours");
      expect(res.text).toContain("Alice");
    });

    it("pdf export: correct content-type/content-disposition and a real PDF body", async () => {
      const { admin } = await makeUsers();
      const res = await request(app)
        .get(`${API}/reports/overtime-summary/export?format=pdf`)
        .set("Authorization", `Bearer ${admin.token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="overtime-summary-.*\.pdf"$/);
      expect(res.body.slice(0, 4).toString()).toBe("%PDF");
    });

    it("defaults to csv when format is omitted", async () => {
      const { admin } = await makeUsers();
      const res = await as(admin).get("/reports/overtime-summary/export");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
    });
  });
});
