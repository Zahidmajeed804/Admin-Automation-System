import { reportRepository } from "../repositories/reportRepository.js";
import { NotFoundError, BadRequestError } from "../errors/AppError.js";

// Litres/hours/money are kept to 2 decimals so float noise never reaches the
// client, same convention as generatorService's round2.
const round2 = (n) => Math.round((n || 0) * 100) / 100;

/**
 * "YYYY-MM" -> the UTC month it names as a [from, to) range, `to` exclusive.
 * No month given defaults to the current UTC month. Used by every
 * month-scoped report (running hours, fuel cost, ...) so "this month" means
 * the same thing everywhere.
 */
export function resolveMonthRange(month) {
  const now = new Date();
  let year = now.getUTCFullYear();
  let monthIndex = now.getUTCMonth(); // 0-based
  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) throw new BadRequestError("month must be in YYYY-MM format");
    year = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) throw new BadRequestError("month must be between 01 and 12");
  }
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { from, to, year, month: monthIndex + 1 };
}

/**
 * An arbitrary [from, to] range (inclusive both ends, matching
 * generatorLogRepository.list's own from/to convention), for reports that
 * aren't locked to a calendar month. With nothing given, defaults to "this
 * month so far": from the 1st of the current UTC month, to now.
 */
export function resolveDateRange({ from, to } = {}) {
  const now = new Date();
  const resolvedTo = to ? new Date(to) : now;
  const resolvedFrom = from ? new Date(from) : new Date(Date.UTC(resolvedTo.getUTCFullYear(), resolvedTo.getUTCMonth(), 1));
  if (resolvedFrom > resolvedTo) throw new BadRequestError("from must not be after to");
  return { from: resolvedFrom, to: resolvedTo };
}

async function generatorsFor(generatorId) {
  const generators = await reportRepository.resolveGenerators(generatorId);
  if (generatorId && !generators.length) throw new NotFoundError("Generator not found");
  return generators;
}

// Builds the { generator, ...zeroed metric fields } rows every by-generator
// report starts from, so a generator with no logs/jobs in the period still
// shows up with zeros instead of being silently missing.
function seedRows(generators, zeroFields) {
  const rows = new Map();
  for (const generator of generators) {
    rows.set(String(generator._id), { generator: { id: generator._id, tag: generator.tag, name: generator.name }, ...zeroFields });
  }
  return rows;
}

export const reportService = {
  /**
   * Monthly running-hours report (spec 4.2: "monthly tracking of running
   * hours"). One row per active generator (or just the one requested),
   * summed from its usage logs for the month; generators with no logs that
   * month still appear, at 0 hours.
   */
  async getRunningHoursReport({ generatorId, month } = {}) {
    const { from, to, year, month: monthNumber } = resolveMonthRange(month);
    const generators = await generatorsFor(generatorId);
    if (!generators.length) return { year, month: monthNumber, from, to, totalHoursRun: 0, generators: [] };

    const rows = seedRows(generators, { hoursRun: 0, logCount: 0 });
    const aggregated = await reportRepository.runningHoursByGenerator(
      generators.map((g) => g._id),
      from,
      to
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id));
      if (entry) {
        entry.hoursRun = round2(row.hoursRun);
        entry.logCount = row.logCount;
      }
    }

    const result = [...rows.values()];
    return {
      year,
      month: monthNumber,
      from,
      to,
      totalHoursRun: round2(result.reduce((sum, r) => sum + r.hoursRun, 0)),
      generators: result,
    };
  },

  /**
   * Diesel-consumption report (spec 4.2: "diesel consumption — additions,
   * opening/closing fuel, consumption"). One row per active generator (or
   * just the one requested), summed from its usage logs over an arbitrary
   * date range; a generator with no logs in range still appears, at 0.
   */
  async getDieselConsumptionReport({ generatorId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const generators = await generatorsFor(generatorId);
    if (!generators.length) {
      return { ...range, totalFuelConsumedLiters: 0, totalFuelAddedLiters: 0, generators: [] };
    }

    const rows = seedRows(generators, { fuelConsumedLiters: 0, fuelAddedLiters: 0, logCount: 0 });
    const aggregated = await reportRepository.fuelByGenerator(
      generators.map((g) => g._id),
      range.from,
      range.to
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id));
      if (entry) {
        entry.fuelConsumedLiters = round2(row.fuelConsumedLiters);
        entry.fuelAddedLiters = round2(row.fuelAddedLiters);
        entry.logCount = row.logCount;
      }
    }

    const result = [...rows.values()];
    return {
      ...range,
      totalFuelConsumedLiters: round2(result.reduce((sum, r) => sum + r.fuelConsumedLiters, 0)),
      totalFuelAddedLiters: round2(result.reduce((sum, r) => sum + r.fuelAddedLiters, 0)),
      generators: result,
    };
  },
};
