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
};
