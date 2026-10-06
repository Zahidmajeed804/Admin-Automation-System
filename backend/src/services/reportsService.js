import { reportsRepository } from "../repositories/reportsRepository.js";
import { NotFoundError } from "../errors/AppError.js";
import { resolveDateRange, resolveYearRange } from "../utils/dateRanges.js";
import { LEAVE_TYPES } from "../constants/attendance.js";

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

function seedLeaveRows(employees) {
  const rows = new Map();
  for (const employee of employees) {
    const leaveTypes = {};
    for (const leaveType of LEAVE_TYPES) {
      leaveTypes[leaveType] = { requestCount: 0, approvedDays: 0, pendingDays: 0, rejectedDays: 0 };
    }
    rows.set(String(employee._id), { employee: employeeIdentity(employee), leaveTypes, totalApprovedDays: 0 });
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

  /**
   * Leave Usage report (Module 7 spec: per-employee leave usage by type and
   * status, plus leave balances). Scoped to a calendar year — not an
   * arbitrary range, since leaveAllocation and leaveService.getBalanceForYear
   * are themselves year-scoped — via the same resolveYearRange helper the
   * Generator module's operating-cost report uses. One row per employee (or
   * just the one requested); employees with no leave requests in the year
   * still appear, at 0 for every leave type.
   *
   * This subtask (AAS-506) builds the usage half only: per-leaveType request
   * counts and days clipped to the year, split by status. Balance
   * (allocated/used/pending/remaining) is integrated in AAS-507.
   */
  async getLeaveUsageReport({ employeeId, year } = {}) {
    const range = resolveYearRange(year);
    // leaveUsageByEmployee takes inclusive bounds (like every other report
    // repository function). resolveYearRange's `to` is exclusive (next
    // Jan 1, with a time component), so rather than back it up 1ms — which
    // would leave it off the exact-midnight grid every stored date sits on
    // and throw off the day-count division — build the inclusive bound the
    // same way leaveService's own `yearEnd` does: midnight UTC on Dec 31.
    const inclusiveTo = new Date(Date.UTC(range.year, 11, 31));
    const employees = await employeesFor(employeeId);
    if (!employees.length) return { ...range, totalApprovedDays: 0, employees: [] };

    const rows = seedLeaveRows(employees);
    const aggregated = await reportsRepository.leaveUsageByEmployee(
      employees.map((e) => e._id),
      range.from,
      inclusiveTo
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id.user));
      if (!entry) continue;
      const typeEntry = entry.leaveTypes[row._id.leaveType];
      if (!typeEntry) continue;
      const days = Math.round(row.days);
      typeEntry.requestCount += row.requestCount;
      if (row._id.status === "approved") typeEntry.approvedDays = days;
      else if (row._id.status === "pending") typeEntry.pendingDays = days;
      else if (row._id.status === "rejected") typeEntry.rejectedDays = days;
    }

    const result = [...rows.values()];
    for (const entry of result) {
      entry.totalApprovedDays = Object.values(entry.leaveTypes).reduce((sum, t) => sum + t.approvedDays, 0);
    }
    return {
      ...range,
      totalApprovedDays: result.reduce((sum, r) => sum + r.totalApprovedDays, 0),
      employees: result,
    };
  },
};
