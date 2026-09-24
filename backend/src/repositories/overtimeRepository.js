import { OvertimeRequest } from "../models/index.js";

export const overtimeRepository = {
  findByAttendanceId: (attendanceId) => OvertimeRequest.findOne({ attendance: attendanceId }),

  // Idempotent: one request per attendance record, so a repeated call returns the existing one.
  createForAttendance: ({ user, attendance, date, overtimeMinutes }) =>
    OvertimeRequest.findOneAndUpdate(
      { attendance },
      { $setOnInsert: { user, attendance, date, overtimeMinutes, status: "pending" } },
      { upsert: true, new: true, runValidators: true }
    ),
};
