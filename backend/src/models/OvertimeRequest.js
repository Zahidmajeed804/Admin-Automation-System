import mongoose from "mongoose";

export const OVERTIME_STATUSES = ["pending", "approved", "rejected"];

const overtimeRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", required: true },
    // Copied from the attendance record (midnight UTC) so date-range queries don't need a join.
    date: { type: Date, required: true, index: true },
    overtimeMinutes: { type: Number, required: true, min: 1 },
    status: { type: String, enum: OVERTIME_STATUSES, default: "pending", index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
  },
  { timestamps: true }
);

// At most one overtime request per attendance record, so re-running clock-out logic can't duplicate it.
overtimeRequestSchema.index({ attendance: 1 }, { unique: true });

export default mongoose.model("OvertimeRequest", overtimeRequestSchema);
