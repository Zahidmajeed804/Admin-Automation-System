import mongoose from "mongoose";
import { FUEL_GAUGE_MARK_KEYS } from "../constants/generator.js";

const generatorLogSchema = new mongoose.Schema(
  {
    generator: { type: mongoose.Schema.Types.ObjectId, ref: "Generator", required: true },
    date: { type: Date, required: true, default: Date.now },
    hoursRun: { type: Number, required: true, min: 0 }, // hours run in this entry
    meterReadingHours: { type: Number, min: 0 }, // cumulative hour-meter reading, for cross-checking
    fuelAddedLiters: { type: Number, default: 0, min: 0 },
    fuelConsumedLiters: { type: Number, default: 0, min: 0 },
    openingFuelLiters: { type: Number, min: 0 }, // tank level before this entry
    closingFuelLiters: { type: Number, min: 0 }, // tank level after this entry
    // The needle-gauge mark each tank-level reading was actually taken at, on
    // a "gauge"-measurement generator (see Generator.fuelMeasurementType).
    // The converted liters still live in openingFuelLiters/closingFuelLiters
    // above — this is kept alongside them so the UI can show the mark the
    // entry was really read at (e.g. "½ tank (≈100 L)"), not just the number.
    openingFuelGaugeReading: { type: String, enum: FUEL_GAUGE_MARK_KEYS },
    fuelGaugeReading: { type: String, enum: FUEL_GAUGE_MARK_KEYS },
    fuelCostPerLiter: { type: Number, min: 0 }, // price paid for the fuel added
    fuelCostTotal: { type: Number, min: 0 }, // total paid for the fuel added (litres x price per litre)
    fuelVendor: { type: String, trim: true }, // who the fuel was bought from
    reason: { type: String, trim: true }, // e.g. "power outage", "scheduled test"
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Most common query: one generator's logs, newest first.
generatorLogSchema.index({ generator: 1, date: -1 });

export default mongoose.model("GeneratorLog", generatorLogSchema);
