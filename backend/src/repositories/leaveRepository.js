import { LeaveRequest } from "../models/index.js";
import { startOfDay } from "../utils/dates.js";

export const leaveRepository = {
  create: (data) => LeaveRequest.create(data),
  findById: (id) => LeaveRequest.findById(id),

  // Requests that still claim these days: pending or approved, and touching [startDate, endDate].
  // Two inclusive ranges overlap when each starts on or before the other ends.
  findOverlapping: (userId, startDate, endDate) =>
    LeaveRequest.findOne({
      user: userId,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }),

  // Filtering on status "pending" inside the update makes the transition atomic:
  // of two concurrent reviews only one matches; the other gets null.
  reviewIfPending: (id, { status, reviewedBy, reviewNote }) =>
    LeaveRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status, reviewedBy, reviewNote, reviewedAt: new Date() },
      { returnDocument: "after" }
    )
      .populate("user", "name email department")
      .populate("reviewedBy", "name email"),

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
        .sort({ startDate: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      LeaveRequest.countDocuments(query),
    ]);
    return { items, totalItems };
  },
};
