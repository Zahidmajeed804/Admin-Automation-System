import { Generator, GeneratorLog } from "../models/index.js";

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
};
