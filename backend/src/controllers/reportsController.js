import { reportsService } from "../services/reportsService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { rowsToCsv } from "../utils/csvExport.js";
import { rowsToPdf } from "../utils/pdfExport.js";

const ATTENDANCE_SUMMARY_COLUMNS = [
  { key: "name", header: "Employee" },
  { key: "employeeId", header: "Employee ID" },
  { key: "department", header: "Department" },
  { key: "present", header: "Present" },
  { key: "absent", header: "Absent" },
  { key: "halfDay", header: "Half Day" },
  { key: "late", header: "Late" },
  { key: "totalDays", header: "Total Days" },
  { key: "workedHours", header: "Worked Hours" },
];

const toRows = (report) =>
  report.employees.map((e) => ({
    name: e.employee.name,
    employeeId: e.employee.employeeId || "",
    department: e.employee.department || "",
    present: e.present,
    absent: e.absent,
    halfDay: e.halfDay,
    late: e.late,
    totalDays: e.totalDays,
    workedHours: e.workedHours,
  }));

const OVERTIME_SUMMARY_COLUMNS = [
  { key: "name", header: "Employee" },
  { key: "employeeId", header: "Employee ID" },
  { key: "department", header: "Department" },
  { key: "pending", header: "Pending" },
  { key: "approved", header: "Approved" },
  { key: "rejected", header: "Rejected" },
  { key: "totalRequests", header: "Total Requests" },
  { key: "approvedHours", header: "Approved Hours" },
];

const toOvertimeRows = (report) =>
  report.employees.map((e) => ({
    name: e.employee.name,
    employeeId: e.employee.employeeId || "",
    department: e.employee.department || "",
    pending: e.pending,
    approved: e.approved,
    rejected: e.rejected,
    totalRequests: e.totalRequests,
    approvedHours: e.approvedHours,
  }));

// Casual/sick/annual carry a balance (allocated/used/pending/remaining);
// unpaid has no allocation, so it only gets its own usage columns — same
// quota distinction reportsService.getLeaveUsageReport itself makes.
const QUOTA_LEAVE_TYPES = ["casual", "sick", "annual"];

const LEAVE_USAGE_COLUMNS = [
  { key: "name", header: "Employee" },
  { key: "employeeId", header: "Employee ID" },
  { key: "department", header: "Department" },
  ...QUOTA_LEAVE_TYPES.flatMap((type) => [
    { key: `${type}Allocated`, header: `${capitalize(type)} Allocated` },
    { key: `${type}Used`, header: `${capitalize(type)} Used` },
    { key: `${type}Pending`, header: `${capitalize(type)} Pending` },
    { key: `${type}Remaining`, header: `${capitalize(type)} Remaining` },
  ]),
  { key: "unpaidUsed", header: "Unpaid Used" },
  { key: "unpaidPending", header: "Unpaid Pending" },
  { key: "totalApprovedDays", header: "Total Approved Days" },
];

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Flattens each employee's nested per-leaveType usage/balance into one row
// — a report row can't have a variable number of columns, so every quota
// type's balance fields and unpaid's usage fields are spread out by name.
const toLeaveRows = (report) =>
  report.employees.map((e) => {
    const row = { name: e.employee.name, employeeId: e.employee.employeeId || "", department: e.employee.department || "" };
    for (const type of QUOTA_LEAVE_TYPES) {
      const t = e.leaveTypes[type];
      row[`${type}Allocated`] = t.allocated;
      row[`${type}Used`] = t.used;
      row[`${type}Pending`] = t.pending;
      row[`${type}Remaining`] = t.remaining;
    }
    row.unpaidUsed = e.leaveTypes.unpaid.approvedDays;
    row.unpaidPending = e.leaveTypes.unpaid.pendingDays;
    row.totalApprovedDays = e.totalApprovedDays;
    return row;
  });

const dateStamp = (date) => date.toISOString().slice(0, 10);

export const reportsController = {
  attendanceSummary: asyncHandler(async (req, res) => {
    const { employeeId, from, to } = req.query;
    const report = await reportsService.getAttendanceSummaryReport({ employeeId, from, to });
    sendSuccess(res, { data: report });
  }),

  // Same filters as attendanceSummary, re-fetched fresh (not cached from the
  // view) so a direct export link always reflects the current data.
  attendanceSummaryExport: asyncHandler(async (req, res) => {
    const { employeeId, from, to, format = "csv" } = req.query;
    const report = await reportsService.getAttendanceSummaryReport({ employeeId, from, to });
    const rows = toRows(report);
    const filename = `attendance-summary-${dateStamp(report.from)}-to-${dateStamp(report.to)}`;

    if (format === "pdf") {
      const buffer = await rowsToPdf({
        title: "Attendance Summary Report",
        meta: [
          `Period: ${dateStamp(report.from)} to ${dateStamp(report.to)}`,
          `Total worked hours: ${report.totalWorkedHours}`,
        ],
        columns: ATTENDANCE_SUMMARY_COLUMNS,
        rows,
      });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` });
      return res.send(buffer);
    }

    const csv = await rowsToCsv(rows, ATTENDANCE_SUMMARY_COLUMNS);
    res.set({ "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}.csv"` });
    return res.send(csv);
  }),

  overtimeSummary: asyncHandler(async (req, res) => {
    const { employeeId, from, to } = req.query;
    const report = await reportsService.getOvertimeSummaryReport({ employeeId, from, to });
    sendSuccess(res, { data: report });
  }),

  // Same filters as overtimeSummary, re-fetched fresh — same convention as
  // attendanceSummaryExport.
  overtimeSummaryExport: asyncHandler(async (req, res) => {
    const { employeeId, from, to, format = "csv" } = req.query;
    const report = await reportsService.getOvertimeSummaryReport({ employeeId, from, to });
    const rows = toOvertimeRows(report);
    const filename = `overtime-summary-${dateStamp(report.from)}-to-${dateStamp(report.to)}`;

    if (format === "pdf") {
      const buffer = await rowsToPdf({
        title: "Overtime Summary Report",
        meta: [
          `Period: ${dateStamp(report.from)} to ${dateStamp(report.to)}`,
          `Total approved hours: ${report.totalApprovedHours}`,
        ],
        columns: OVERTIME_SUMMARY_COLUMNS,
        rows,
      });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` });
      return res.send(buffer);
    }

    const csv = await rowsToCsv(rows, OVERTIME_SUMMARY_COLUMNS);
    res.set({ "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}.csv"` });
    return res.send(csv);
  }),

  leaveUsage: asyncHandler(async (req, res) => {
    const { employeeId, year } = req.query;
    const report = await reportsService.getLeaveUsageReport({ employeeId, year });
    sendSuccess(res, { data: report });
  }),

  // Same filters as leaveUsage, re-fetched fresh — same convention as the
  // other two reports' export actions.
  leaveUsageExport: asyncHandler(async (req, res) => {
    const { employeeId, year, format = "csv" } = req.query;
    const report = await reportsService.getLeaveUsageReport({ employeeId, year });
    const rows = toLeaveRows(report);
    const filename = `leave-usage-${report.year}`;

    if (format === "pdf") {
      const buffer = await rowsToPdf({
        title: "Leave Usage Report",
        meta: [`Year: ${report.year}`, `Total approved days: ${report.totalApprovedDays}`],
        columns: LEAVE_USAGE_COLUMNS,
        rows,
      });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` });
      return res.send(buffer);
    }

    const csv = await rowsToCsv(rows, LEAVE_USAGE_COLUMNS);
    res.set({ "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}.csv"` });
    return res.send(csv);
  }),
};
