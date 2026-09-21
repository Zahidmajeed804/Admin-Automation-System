import mongoose from "mongoose";

const generatorMaintenanceSchema = new mongoose.Schema(
  {
    generator: { type: mongoose.Schema.Types.ObjectId, ref: "Generator", required: true },
    type: {
      type: String,
      enum: ["scheduled", "unscheduled", "inspection"],
      default: "scheduled",
    },
    // Only what is actually stored. "overdue" / "upcoming" are deliberately NOT
    // statuses: they depend on today's date, so they are computed at read time
    // (see generatorService.computeAlertStatus) instead of being kept in sync
    // by a cron job.
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    description: { type: String, required: true, trim: true }, // work planned / performed
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    intervalDays: { type: Number, min: 1 }, // recurrence: on completion, the next one is scheduled this many days later
    alertThresholdDays: { type: Number, default: 7, min: 0 }, // start flagging as "upcoming" this many days before due
    performedBy: { type: String, trim: true }, // technician / vendor
    cost: { type: Number, min: 0 },
    partsReplaced: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One generator's maintenance, soonest first.
generatorMaintenanceSchema.index({ generator: 1, scheduledDate: 1 });
// The alerts query: everything still "scheduled", ordered by due date.
generatorMaintenanceSchema.index({ status: 1, scheduledDate: 1 });

export default mongoose.model("GeneratorMaintenance", generatorMaintenanceSchema);
