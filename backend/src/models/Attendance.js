import mongoose from "mongoose";
import { ATTENDANCE_STATUSES } from "../constants/attendance.js";

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Normalized to midnight UTC so there's exactly one record per user per day.
    date: { type: Date, required: true, index: true },
    clockIn: { type: Date },
    clockOut: { type: Date },
    workedMinutes: { type: Number, default: 0 },
    // Minutes short of a full shift, set on clock-out (0 = full shift). No default:
    // an open day or a record from before this field has no value.
    earlyDepartureMinutes: { type: Number, min: 0 },
    // Shift length this day was measured against, copied from the person's designation
    // at clock-out so editing the designation later doesn't rewrite past days. Absent on
    // open days and on records from before designations existed.
    shiftMinutes: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: "present",
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// One attendance record per user per day.
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
