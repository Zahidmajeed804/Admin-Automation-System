import { OvertimeRequest } from "../models/index.js";

// OvertimeRequest.date is copied from Attendance.date (midnight UTC), so day filters normalize the same way.
const startOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const overtimeRepository = {
  findById: (id) => OvertimeRequest.findById(id),
  findByAttendanceId: (attendanceId) => OvertimeRequest.findOne({ attendance: attendanceId }),

  // Idempotent: one request per attendance record, so a repeated call returns the existing one.
  createForAttendance: ({ user, attendance, date, overtimeMinutes }) =>
    OvertimeRequest.findOneAndUpdate(
      { attendance },
      { $setOnInsert: { user, attendance, date, overtimeMinutes, status: "pending" } },
      { upsert: true, new: true, runValidators: true }
    ),

  // Filtering on status "pending" inside the update makes the transition atomic:
  // of two concurrent reviews only one matches; the other gets null.
  reviewIfPending: (id, { status, reviewedBy, reviewNote }) =>
    OvertimeRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status, reviewedBy, reviewNote, reviewedAt: new Date() },
      { new: true }
    )
      .populate("user", "name email department")
      .populate("reviewedBy", "name email"),

  list: async ({ userId, status, startDate, endDate, page = 1, pageSize = 20 } = {}) => {
    const query = {};
    if (userId) query.user = userId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startOfDay(startDate);
      if (endDate) query.date.$lte = startOfDay(endDate);
    }

    const [items, totalItems] = await Promise.all([
      OvertimeRequest.find(query)
        .populate("user", "name email department")
        .populate("reviewedBy", "name email")
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      OvertimeRequest.countDocuments(query),
    ]);
    return { items, totalItems };
  },
};
