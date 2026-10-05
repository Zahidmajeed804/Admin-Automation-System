import mongoose from "mongoose";
import { FUEL_TYPES, DEFAULT_FUEL_TYPE } from "../constants/generator.js";

const generatorSchema = new mongoose.Schema(
  {
    tag: { type: String, required: true, trim: true }, // asset tag, e.g. "GEN-01"; uniqueness is a partial index below
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true, index: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    capacityKVA: { type: Number },
    fuelType: {
      type: String,
      enum: FUEL_TYPES,
      default: DEFAULT_FUEL_TYPE,
    },
    fuelTankCapacityLiters: { type: Number },
    status: {
      type: String,
      enum: ["operational", "under_maintenance", "faulty", "decommissioned", "maintenance_due"],
      default: "operational",
      index: true,
    },
    installationDate: { type: Date },
    runningHoursTotal: { type: Number, default: 0 }, // kept in sync by generatorService.recordLog()
    lastServiceDate: { type: Date }, // kept in sync by generatorService.completeMaintenance()
    // Hours-based service reminder, set at creation and editable afterwards.
    // Unset means the generator has no automatic reminder.
    maintenanceIntervalHours: { type: Number, min: 1 },
    // runningHoursTotal baseline the interval counts from; reset by
    // generatorService.completeMaintenance() whenever a job on this
    // generator is completed.
    hoursAtLastMaintenanceReset: { type: Number, default: 0 },
    // Set once generatorService.recordLog() has notified admins that the
    // interval was crossed, so the email only fires once per crossing; the
    // same completeMaintenance() reset above clears it.
    maintenanceDueNotifiedAt: { type: Date },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true }, // only false on generators deleted before deletion became permanent; every read still skips them
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Only active generators compete for a tag: a soft-deleted/leftover
// isActive:false document (e.g. a legacy record from before deletion became
// permanent) must never block a new generator from reusing its tag.
generatorSchema.index({ tag: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.model("Generator", generatorSchema);
