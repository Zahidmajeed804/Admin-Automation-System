import { Attendance } from "../models/index.js";
import { startOfDay } from "../utils/dates.js";
import { toObjectIds } from "../utils/objectIds.js";

export const attendanceRepository = {
  create: (data) => Attendance.create(data),
  findById: (id) => Attendance.findById(id),
  findTodayForUser: (userId, date = new Date()) =>
    Attendance.findOne({ user: userId, date: startOfDay(date) }),
  updateById: (id, data) => Attendance.findByIdAndUpdate(id, data, { returnDocument: "after" }),
  list: async ({ userId, status, startDate, endDate, page = 1, pageSize = 20 } = {}) => {
    const query = {};
    if (userId) query.user = userId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startOfDay(startDate);
      if (endDate) query.date.$lte = startOfDay(endDate);
    }

    // _id as a tiebreaker: many users share the same date, so sorting by date
    // alone would let rows shift between pages.
    const [items, totalItems] = await Promise.all([
      Attendance.find(query)
        .populate("user", "name email department")
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      Attendance.countDocuments(query),
    ]);
    return { items, totalItems };
  },

  // Days per user per status with `date` in [from, to) — `to` exclusive, like
  // reportService.resolveMonthRange. `userIds` limits it to those people.
  // Resolves to [{ _id: { user, status }, days }].
  countByUserAndStatus: ({ from, to, userIds }) => {
    const match = { date: { $gte: from, $lt: to } };
    if (userIds) match.user = { $in: toObjectIds(userIds) };
    return Attendance.aggregate([
      { $match: match },
      { $group: { _id: { user: "$user", status: "$status" }, days: { $sum: 1 } } },
    ]);
  },
};
