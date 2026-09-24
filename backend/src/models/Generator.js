import mongoose from "mongoose";

const generatorSchema = new mongoose.Schema(
  {
    tag: { type: String, required: true, unique: true, trim: true }, // asset tag, e.g. "GEN-01"
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true, index: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    capacityKVA: { type: Number },
    fuelType: {
      type: String,
      enum: ["diesel", "petrol", "gas"],
      default: "diesel",
    },
    fuelTankCapacityLiters: { type: Number },
    status: {
      type: String,
      enum: ["operational", "under_maintenance", "faulty", "decommissioned"],
      default: "operational",
      index: true,
    },
    installationDate: { type: Date },
    runningHoursTotal: { type: Number, default: 0 }, // kept in sync by generatorService.recordLog()
    lastServiceDate: { type: Date }, // kept in sync by generatorService.completeMaintenance()
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true }, // only false on generators deleted before deletion became permanent; every read still skips them
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Generator", generatorSchema);
