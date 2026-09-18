import mongoose from "mongoose";

const generatorLogSchema = new mongoose.Schema(
  {
    generator: { type: mongoose.Schema.Types.ObjectId, ref: "Generator", required: true },
    date: { type: Date, required: true, default: Date.now },
    hoursRun: { type: Number, required: true, min: 0 }, // hours run in this entry
    meterReadingHours: { type: Number, min: 0 }, // cumulative hour-meter reading, for cross-checking
    fuelAddedLiters: { type: Number, default: 0, min: 0 },
    fuelConsumedLiters: { type: Number, default: 0, min: 0 },
    reason: { type: String, trim: true }, // e.g. "power outage", "scheduled test"
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Most common query: one generator's logs, newest first.
generatorLogSchema.index({ generator: 1, date: -1 });

export default mongoose.model("GeneratorLog", generatorLogSchema);
