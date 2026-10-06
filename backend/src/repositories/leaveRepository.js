import { LeaveRequest } from "../models/index.js";
import { startOfDay } from "../utils/dates.js";

export const leaveRepository = {
  // Approved leave touching [from, to) — `to` exclusive — as whole documents, so the
  // caller can clip each one to the month. `userIds` limits it to those people.
  findApprovedInRange: ({ from, to, userIds }) =>
    LeaveRequest.find({
      status: "approved",
      startDate: { $lt: to },
      endDate: { $gte: from },
      ...(userIds ? { user: { $in: userIds } } : {}),
    }).select("user leaveType startDate endDate"),

  create: (data) => LeaveRequest.create(data),
  findById: (id) => LeaveRequest.findById(id),

  // Requests that still claim these days: pending or approved, and touching [startDate, endDate].
  // Two inclusive ranges overlap when each starts on or before the other ends.
  // `excludeId` leaves one request out — the one whose dates are being changed.
  findOverlapping: (userId, startDate, endDate, excludeId) =>
    LeaveRequest.findOne({
      user: userId,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }),

  // Requests of this type that still claim days (pending or approved) and overlap the
  // given calendar year — used to compute the leave balance for that year. Fetched as
  // whole documents (not summed in the query) because a request can straddle two years
  // and the caller needs to clip each one to the year itself. `excludeId` as above.
  findActiveByTypeAndYear: (userId, leaveType, year, excludeId) => {
    const yearStart = startOfDay(new Date(Date.UTC(year, 0, 1)));
    const yearEnd = startOfDay(new Date(Date.UTC(year, 11, 31)));
    return LeaveRequest.find({
      user: userId,
      leaveType,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
  },

  // New dates for a request that is still pending; null if it was decided meanwhile
  // (same atomic "status: pending" guard as reviewIfPending).
  updateDatesIfPending: (id, changes) =>
    LeaveRequest.findOneAndUpdate({ _id: id, status: "pending" }, { $set: changes }, { returnDocument: "after" })
      .populate("user", "name email department")
      .populate("reviewedBy", "name email")
      .populate("editedBy", "name email"),

  // Filtering on status "pending" inside the update makes the transition atomic:
  // of two concurrent reviews only one matches; the other gets null.
  reviewIfPending: (id, { status, reviewedBy, reviewNote }) =>
    LeaveRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status, reviewedBy, reviewNote, reviewedAt: new Date() },
      { returnDocument: "after" }
    )
      .populate("user", "name email department")
      .populate("reviewedBy", "name email")
      .populate("editedBy", "name email"),

  // startDate/endDate select requests overlapping that window (not just starting inside it).
  list: async ({ userId, status, leaveType, startDate, endDate, page = 1, pageSize = 20 } = {}) => {
    const query = {};
    if (userId) query.user = userId;
    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;
    if (startDate) query.endDate = { $gte: startOfDay(startDate) };
    if (endDate) query.startDate = { $lte: startOfDay(endDate) };

    // _id as a tiebreaker: many requests share a start date, so sorting by date alone would let rows shift between pages.
    const [items, totalItems] = await Promise.all([
      LeaveRequest.find(query)
        .populate("user", "name email department")
        .populate("reviewedBy", "name email")
        .populate("editedBy", "name email")
        .sort({ startDate: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      LeaveRequest.countDocuments(query),
    ]);
    return { items, totalItems };
  },
};
