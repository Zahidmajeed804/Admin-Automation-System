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
    // Running-hours reminders (spec: "alerts after predefined running hours"),
    // alongside the calendar-based fields above — a job can use either, both,
    // or neither. Whichever comes due first is what flags the job as an alert
    // (see generatorService.computeAlertStatus).
    intervalHours: { type: Number, min: 1 }, // recurrence: due again this many running hours after hoursAtScheduling
    alertThresholdHours: { type: Number, default: 25, min: 0 }, // start flagging as "upcoming" this many running hours before due
    hoursAtScheduling: { type: Number, min: 0 }, // the generator's running hours when this job's hour-based clock started counting
    performedBy: { type: String, trim: true }, // technician
    vendor: { type: String, trim: true }, // company the service was bought from
    hoursAtService: { type: Number, min: 0 }, // generator's running hours when the job was completed
    cost: { type: Number, min: 0 },
    partsReplaced: { type: String, trim: true },
    notes: { type: String, trim: true },
    // At most one invoice per job — a re-upload replaces it. Absent entirely
    // (not an empty object) when nothing has been uploaded.
    invoice: {
      type: {
        fileName: { type: String, trim: true }, // the name the person uploaded it as
        storedName: { type: String, trim: true }, // the random name it lives under on disk
        mimeType: { type: String, trim: true },
        size: { type: Number, min: 0 }, // bytes
        uploadedAt: { type: Date },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
      _id: false,
      default: undefined,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One generator's maintenance, soonest first.
generatorMaintenanceSchema.index({ generator: 1, scheduledDate: 1 });
// The alerts query: everything still "scheduled", ordered by due date.
generatorMaintenanceSchema.index({ status: 1, scheduledDate: 1 });

export default mongoose.model("GeneratorMaintenance", generatorMaintenanceSchema);
