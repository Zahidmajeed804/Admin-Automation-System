import { User, Attendance, OvertimeRequest } from "../models/index.js";

// Every attendance-summary report is scoped to employees who still exist in
// the system (deactivated staff included — same convention as
// attendanceService.listEmployees, so a former employee's history stays
// reachable). With an employeeId, resolves to that one user (or an empty
// array if it doesn't exist, which callers turn into a 404); without one,
// every user, for a company-wide report.
async function resolveEmployees(employeeId) {
  if (employeeId) {
    const employee = await User.findById(employeeId).select("name email employeeId department isActive");
    return employee ? [employee] : [];
  }
  return User.find().select("name email employeeId department isActive").sort({ name: 1 });
}

export const reportsRepository = {
  resolveEmployees,

  // Per-status counts, total worked minutes and record count per employee
  // within [from, to] (inclusive both ends, matching
  // attendanceRepository.list's own startDate/endDate convention).
  attendanceSummaryByEmployee: (userIds, from, to) =>
    Attendance.aggregate([
      { $match: { user: { $in: userIds }, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$user",
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          workedMinutes: { $sum: "$workedMinutes" },
          recordCount: { $sum: 1 },
        },
      },
    ]),

  // Per-status request counts and approved overtime minutes per employee
  // within [from, to] (inclusive both ends, matching overtimeRepository.list's
  // own startDate/endDate convention — ranged on the request's `date`, which
  // is copied from its attendance record).
  overtimeSummaryByEmployee: (userIds, from, to) =>
    OvertimeRequest.aggregate([
      { $match: { user: { $in: userIds }, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$user",
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          approvedMinutes: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$overtimeMinutes", 0] } },
          totalRequests: { $sum: 1 },
        },
      },
    ]),
};
