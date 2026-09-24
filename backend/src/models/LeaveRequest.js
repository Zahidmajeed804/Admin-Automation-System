import mongoose from "mongoose";
import { LEAVE_TYPES, LEAVE_STATUSES } from "../constants/attendance.js";

const leaveRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true },
    // Both normalized to midnight UTC, like Attendance.date. endDate is inclusive.
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "endDate must not be before startDate",
      },
    },
    // Calendar days from startDate to endDate inclusive; computed by the service, stored so reports and balances don't recompute it.
    totalDays: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: LEAVE_STATUSES, default: "pending", index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
  },
  { timestamps: true }
);

// Serves the overlap check ("does this user already have leave touching these dates?") and per-user history.
leaveRequestSchema.index({ user: 1, startDate: 1, endDate: 1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
