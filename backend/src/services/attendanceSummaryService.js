import { attendanceRepository } from "../repositories/attendanceRepository.js";
import { overtimeRepository } from "../repositories/overtimeRepository.js";
import { leaveRepository } from "../repositories/leaveRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { resolveMonthRange } from "./reportService.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Stored attendance status -> the key it's counted under in the summary.
const STATUS_KEYS = { present: "present", late: "late", "half-day": "halfDay", absent: "absent" };

// Calendar days of the inclusive range [start, end] that fall within [first, last] (inclusive).
const daysWithin = (start, end, first, last) => {
  const from = start > first ? start : first;
  const to = end < last ? end : last;
  return to < from ? 0 : Math.round((to - from) / MS_PER_DAY) + 1;
};

const emptyRow = (user) => ({
  user: {
    _id: user._id,
    name: user.name,
    employeeId: user.employeeId,
    department: user.department,
    designation: user.designation ?? null,
    isActive: user.isActive,
  },
  overtime: { approvedMinutes: 0, pendingMinutes: 0 },
  attendance: { present: 0, late: 0, halfDay: 0, absent: 0 },
  leaveDays: 0,
});

export const attendanceSummaryService = {
  // One month of overtime, attendance and approved leave per person, plus totals.
  // Managers (canViewAll = attendance.update) see everyone and may filter by person
  // or designation; anyone else always gets only their own row. People covered:
  // everyone with attendance, overtime or leave that month, plus every active staff
  // member with a designation (so someone absent all month still shows up).
  async getMonthly({ requesterId, canViewAll = false, month, userId, designationId }) {
    const { from, to, year, month: monthNumber } = resolveMonthRange(month);
    const lastDay = new Date(to.getTime() - MS_PER_DAY);
    const scopedUserId = canViewAll ? userId : requesterId;
    const scopedDesignationId = canViewAll ? designationId : undefined;
    const userIds = scopedUserId ? [scopedUserId] : undefined;

    const [attendance, overtime, leave] = await Promise.all([
      attendanceRepository.countByUserAndStatus({ from, to, userIds }),
      overtimeRepository.sumMinutesByUserAndStatus({ from, to, userIds }),
      leaveRepository.findApprovedInRange({ from, to, userIds }),
    ]);

    const activeIds = new Set([
      ...attendance.map((r) => String(r._id.user)),
      ...overtime.map((r) => String(r._id.user)),
      ...leave.map((l) => String(l.user)),
    ]);
    const users = await userRepository.findForSummary({
      ids: [...activeIds],
      userId: scopedUserId,
      designationId: scopedDesignationId,
    });
    const rows = new Map(users.map((u) => [String(u._id), emptyRow(u)]));

    for (const r of attendance) {
      const row = rows.get(String(r._id.user));
      const key = STATUS_KEYS[r._id.status];
      if (row && key) row.attendance[key] += r.days;
    }
    for (const r of overtime) {
      const row = rows.get(String(r._id.user));
      if (!row) continue;
      if (r._id.status === "approved") row.overtime.approvedMinutes += r.minutes;
      else if (r._id.status === "pending") row.overtime.pendingMinutes += r.minutes;
    }
    for (const l of leave) {
      const row = rows.get(String(l.user));
      if (row) row.leaveDays += daysWithin(l.startDate, l.endDate, from, lastDay);
    }

    const staff = [...rows.values()];
    const totals = {
      staffCount: staff.length,
      approvedOvertimeMinutes: staff.reduce((sum, r) => sum + r.overtime.approvedMinutes, 0),
      pendingOvertimeMinutes: staff.reduce((sum, r) => sum + r.overtime.pendingMinutes, 0),
    };

    return {
      month: `${year}-${String(monthNumber).padStart(2, "0")}`,
      from,
      to: lastDay,
      totals,
      staff,
    };
  },
};
