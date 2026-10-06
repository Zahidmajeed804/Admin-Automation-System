import { reportsRepository } from "../repositories/reportsRepository.js";
import { NotFoundError } from "../errors/AppError.js";
import { resolveDateRange } from "../utils/dateRanges.js";

// Worked hours are kept to 2 decimals so float noise never reaches the
// client, same convention as reportService's (Generator module) round2.
const round2 = (n) => Math.round((n || 0) * 100) / 100;

async function employeesFor(employeeId) {
  const employees = await reportsRepository.resolveEmployees(employeeId);
  if (employeeId && !employees.length) throw new NotFoundError("Employee not found");
  return employees;
}

// The { employee } identity fields every by-employee report row starts
// from, so an employee with no records in the period still shows up with
// zeros instead of being silently missing.
function employeeIdentity(employee) {
  return { id: employee._id, name: employee.name, email: employee.email, employeeId: employee.employeeId, department: employee.department };
}

function seedAttendanceRows(employees) {
  const rows = new Map();
  for (const employee of employees) {
    rows.set(String(employee._id), {
      employee: employeeIdentity(employee),
      present: 0,
      absent: 0,
      halfDay: 0,
      late: 0,
      totalDays: 0,
      workedHours: 0,
    });
  }
  return rows;
}

function seedOvertimeRows(employees) {
  const rows = new Map();
  for (const employee of employees) {
    rows.set(String(employee._id), {
      employee: employeeIdentity(employee),
      pending: 0,
      approved: 0,
      rejected: 0,
      totalRequests: 0,
      approvedHours: 0,
    });
  }
  return rows;
}

export const reportsService = {
  /**
   * Attendance Summary report (Module 7 spec: per-employee status counts and
   * worked hours). One row per employee (or just the one requested) over an
   * arbitrary date range; employees with no attendance records in range
   * still appear, at 0.
   */
  async getAttendanceSummaryReport({ employeeId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const employees = await employeesFor(employeeId);
    if (!employees.length) return { ...range, totalWorkedHours: 0, totalDays: 0, employees: [] };

    const rows = seedAttendanceRows(employees);
    const aggregated = await reportsRepository.attendanceSummaryByEmployee(
      employees.map((e) => e._id),
      range.from,
      range.to
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id));
      if (entry) {
        entry.present = row.present;
        entry.absent = row.absent;
        entry.halfDay = row.halfDay;
        entry.late = row.late;
        entry.totalDays = row.recordCount;
        entry.workedHours = round2(row.workedMinutes / 60);
      }
    }

    const result = [...rows.values()];
    return {
      ...range,
      totalWorkedHours: round2(result.reduce((sum, r) => sum + r.workedHours, 0)),
      totalDays: result.reduce((sum, r) => sum + r.totalDays, 0),
      employees: result,
    };
  },

  /**
   * Overtime Summary report (Module 7 spec: per-employee, per-status
   * overtime request counts and approved hours). One row per employee (or
   * just the one requested) over an arbitrary date range; employees with no
   * overtime requests in range still appear, at 0.
   */
  async getOvertimeSummaryReport({ employeeId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const employees = await employeesFor(employeeId);
    if (!employees.length) return { ...range, totalApprovedHours: 0, totalRequests: 0, employees: [] };

    const rows = seedOvertimeRows(employees);
    const aggregated = await reportsRepository.overtimeSummaryByEmployee(
      employees.map((e) => e._id),
      range.from,
      range.to
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id));
      if (entry) {
        entry.pending = row.pending;
        entry.approved = row.approved;
        entry.rejected = row.rejected;
        entry.totalRequests = row.totalRequests;
        entry.approvedHours = round2(row.approvedMinutes / 60);
      }
    }

    const result = [...rows.values()];
    return {
      ...range,
      totalApprovedHours: round2(result.reduce((sum, r) => sum + r.approvedHours, 0)),
      totalRequests: result.reduce((sum, r) => sum + r.totalRequests, 0),
      employees: result,
    };
  },
};
