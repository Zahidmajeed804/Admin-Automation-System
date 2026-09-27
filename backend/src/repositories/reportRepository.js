import { Generator, GeneratorLog, GeneratorMaintenance } from "../models/index.js";

// Every report is scoped to generators that still exist (not soft-deleted) —
// same convention as generatorRepository.list. With a generatorId, resolves
// to that one generator (or an empty array if it doesn't exist or was
// deleted, which callers turn into a 404); without one, every active
// generator, for a fleet-wide report.
async function resolveGenerators(generatorId) {
  if (generatorId) {
    const generator = await Generator.findOne({ _id: generatorId, isActive: true }).select("tag name");
    return generator ? [generator] : [];
  }
  return Generator.find({ isActive: true }).select("tag name").sort({ tag: 1 });
}

export const reportRepository = {
  resolveGenerators,

  // Total hours run per generator within [from, to), from the usage logs.
  runningHoursByGenerator: (generatorIds, from, to) =>
    GeneratorLog.aggregate([
      { $match: { generator: { $in: generatorIds }, date: { $gte: from, $lt: to } } },
      { $group: { _id: "$generator", hoursRun: { $sum: "$hoursRun" }, logCount: { $sum: 1 } } },
    ]),

  // Fuel cost and litres bought per generator within [from, to), used to work
  // out an average cost per litre.
  fuelCostByGenerator: (generatorIds, from, to) =>
    GeneratorLog.aggregate([
      { $match: { generator: { $in: generatorIds }, date: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: "$generator",
          fuelCostTotal: { $sum: "$fuelCostTotal" },
          fuelAddedLiters: { $sum: "$fuelAddedLiters" },
          logCount: { $sum: 1 },
        },
      },
    ]),

  // Diesel added/consumed per generator within [from, to] (inclusive both
  // ends — same convention as generatorLogRepository.list's from/to).
  fuelByGenerator: (generatorIds, from, to) =>
    GeneratorLog.aggregate([
      { $match: { generator: { $in: generatorIds }, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$generator",
          fuelConsumedLiters: { $sum: "$fuelConsumedLiters" },
          fuelAddedLiters: { $sum: "$fuelAddedLiters" },
          logCount: { $sum: 1 },
        },
      },
    ]),

  // Only completed jobs count as an actual cost — a scheduled or cancelled
  // job never happened. Ranged on completedDate (when the cost was actually
  // incurred), not scheduledDate (when it was originally due), since a job
  // can be completed well after — or, for backlog cleanup, before — that.
  maintenanceCostByGenerator: (generatorIds, from, to) =>
    GeneratorMaintenance.aggregate([
      { $match: { generator: { $in: generatorIds }, status: "completed", completedDate: { $gte: from, $lte: to } } },
      { $group: { _id: "$generator", cost: { $sum: "$cost" }, jobCount: { $sum: 1 } } },
    ]),
};
