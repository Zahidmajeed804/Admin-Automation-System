import { User, Attendance, OvertimeRequest, LeaveRequest } from "../models/index.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  // Request count and clipped days per employee, leaveType and status,
  // matched by date-range overlap (not just requests starting inside the
  // range — same overlap convention as leaveRepository.findActiveByTypeAndYear)
  // within [from, to] (inclusive both ends). A request straddling the
  // boundary is clipped to the range before its days are counted, the same
  // way leaveService's own daysInYear clips a request to a calendar year —
  // this is what keeps the usage half in parity with
  // leaveService.getBalanceForYear when the caller passes a calendar year's
  // own inclusive bounds.
  leaveUsageByEmployee: (userIds, from, to) =>
    LeaveRequest.aggregate([
      { $match: { user: { $in: userIds }, startDate: { $lte: to }, endDate: { $gte: from } } },
      {
        $project: {
          user: 1,
          leaveType: 1,
          status: 1,
          clippedStart: { $cond: [{ $gt: ["$startDate", from] }, "$startDate", from] },
          clippedEnd: { $cond: [{ $lt: ["$endDate", to] }, "$endDate", to] },
        },
      },
      {
        $project: {
          user: 1,
          leaveType: 1,
          status: 1,
          days: { $add: [{ $divide: [{ $subtract: ["$clippedEnd", "$clippedStart"] }, MS_PER_DAY] }, 1] },
        },
      },
      {
        $group: {
          _id: { user: "$user", leaveType: "$leaveType", status: "$status" },
          days: { $sum: "$days" },
          requestCount: { $sum: 1 },
        },
      },
    ]),
};
