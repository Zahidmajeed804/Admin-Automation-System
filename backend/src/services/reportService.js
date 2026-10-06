import { reportRepository } from "../repositories/reportRepository.js";
import { NotFoundError } from "../errors/AppError.js";
import { resolveMonthRange, resolveDateRange, resolveYearRange } from "../utils/dateRanges.js";

// Re-exported for backward compatibility — resolveMonthRange/resolveDateRange/
// resolveYearRange now live in utils/dateRanges.js, but existing imports from
// reportService.js (e.g. reportService.test.js) keep working.
export { resolveMonthRange, resolveDateRange, resolveYearRange };

// Litres/hours/money are kept to 2 decimals so float noise never reaches the
// client, same convention as generatorService's round2.
const round2 = (n) => Math.round((n || 0) * 100) / 100;

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
    rows.set(String(generator._id), { generator: { id: generator._id, tag: generator.tag, name: generator.name, fuelType: generator.fuelType }, ...zeroFields });
  }
  return rows;
}

export const reportService = {
  /**
   * Running-hours report (spec 4.2: "monthly tracking of running hours",
   * widened to an arbitrary date range so a single day can be reported on
   * too — from and to can be the same day). One row per active generator (or
   * just the one requested), summed from its usage logs in range; generators
   * with no logs in range still appear, at 0 hours.
   */
  async getRunningHoursReport({ generatorId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const generators = await generatorsFor(generatorId);
    if (!generators.length) return { ...range, totalHoursRun: 0, generators: [] };

    const rows = seedRows(generators, { hoursRun: 0, logCount: 0 });
    const aggregated = await reportRepository.runningHoursByGenerator(
      generators.map((g) => g._id),
      range.from,
      range.to
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
      ...range,
      totalHoursRun: round2(result.reduce((sum, r) => sum + r.hoursRun, 0)),
      generators: result,
    };
  },

  /**
   * Monthly fuel-cost report (spec 4.2: "fuel cost"). One row per active
   * generator (or just the one requested), summed from its usage logs for
   * the month, plus an average cost per running hour (0 when nothing was
   * run, rather than a division-by-zero NaN). Hours run — not litres/kg
   * bought — is the basis so diesel/petrol (litres) and CNG (kg) generators
   * are comparable on one measure; a per-fuel-unit average can't mix the two.
   */
  async getFuelCostReport({ generatorId, month } = {}) {
    const { from, to, year, month: monthNumber } = resolveMonthRange(month);
    const generators = await generatorsFor(generatorId);
    if (!generators.length) {
      return { year, month: monthNumber, from, to, totalFuelCost: 0, averageCostPerHour: 0, generators: [] };
    }

    const rows = seedRows(generators, { fuelCostTotal: 0, fuelAddedLiters: 0, hoursRun: 0, logCount: 0 });
    const aggregated = await reportRepository.fuelCostByGenerator(
      generators.map((g) => g._id),
      from,
      to
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id));
      if (entry) {
        entry.fuelCostTotal = round2(row.fuelCostTotal);
        entry.fuelAddedLiters = round2(row.fuelAddedLiters);
        entry.hoursRun = round2(row.hoursRun);
        entry.logCount = row.logCount;
      }
    }

    const result = [...rows.values()].map((row) => ({
      ...row,
      averageCostPerHour: row.hoursRun > 0 ? round2(row.fuelCostTotal / row.hoursRun) : 0,
    }));
    const totalFuelCost = round2(result.reduce((sum, r) => sum + r.fuelCostTotal, 0));
    const totalHoursRun = round2(result.reduce((sum, r) => sum + r.hoursRun, 0));
    return {
      year,
      month: monthNumber,
      from,
      to,
      totalFuelCost,
      averageCostPerHour: totalHoursRun > 0 ? round2(totalFuelCost / totalHoursRun) : 0,
      generators: result,
    };
  },

  /**
   * Fuel-consumption report (spec 4.2: "diesel consumption — additions,
   * opening/closing fuel, consumption"; widened to cover CNG too). One row
   * per active generator (or just the one requested), summed from its usage
   * logs over an arbitrary date range; a generator with no logs in range
   * still appears, at 0. Diesel/petrol generators are measured in litres and
   * CNG ones in kg, so the fleet totals are kept as two separate pairs
   * (never summed together — adding litres to kg would be meaningless).
   */
  async getFuelConsumptionReport({ generatorId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const generators = await generatorsFor(generatorId);
    if (!generators.length) {
      return { ...range, totalFuelConsumedLiters: 0, totalFuelAddedLiters: 0, totalFuelConsumedKg: 0, totalFuelAddedKg: 0, generators: [] };
    }

    const rows = seedRows(generators, { fuelConsumedLiters: 0, fuelAddedLiters: 0, logCount: 0 });
    const aggregated = await reportRepository.fuelConsumptionByGenerator(
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
    const litreRows = result.filter((r) => r.generator.fuelType !== "cng");
    const kgRows = result.filter((r) => r.generator.fuelType === "cng");
    return {
      ...range,
      totalFuelConsumedLiters: round2(litreRows.reduce((sum, r) => sum + r.fuelConsumedLiters, 0)),
      totalFuelAddedLiters: round2(litreRows.reduce((sum, r) => sum + r.fuelAddedLiters, 0)),
      totalFuelConsumedKg: round2(kgRows.reduce((sum, r) => sum + r.fuelConsumedLiters, 0)),
      totalFuelAddedKg: round2(kgRows.reduce((sum, r) => sum + r.fuelAddedLiters, 0)),
      generators: result,
    };
  },

  /**
   * Maintenance-cost report (spec 4.2: "maintenance — cost"). One row per
   * active generator (or just the one requested), summed from its completed
   * maintenance jobs over an arbitrary date range; a generator with no
   * completed jobs in range still appears, at 0.
   */
  async getMaintenanceCostReport({ generatorId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const generators = await generatorsFor(generatorId);
    if (!generators.length) return { ...range, totalCost: 0, totalJobCount: 0, generators: [] };

    const rows = seedRows(generators, { cost: 0, jobCount: 0 });
    const aggregated = await reportRepository.maintenanceCostByGenerator(
      generators.map((g) => g._id),
      range.from,
      range.to
    );
    for (const row of aggregated) {
      const entry = rows.get(String(row._id));
      if (entry) {
        entry.cost = round2(row.cost);
        entry.jobCount = row.jobCount;
      }
    }

    const result = [...rows.values()];
    return {
      ...range,
      totalCost: round2(result.reduce((sum, r) => sum + r.cost, 0)),
      totalJobCount: result.reduce((sum, r) => sum + r.jobCount, 0),
      generators: result,
    };
  },

  /**
   * Yearly operating-cost report (spec 4.2: "yearly operating cost"). Fuel
   * cost (from usage logs) plus maintenance cost (from completed jobs),
   * combined into a 12-month trend across the requested year — fleet-wide,
   * or for just one generator when generatorId is given. Every month
   * appears even with nothing in it, at 0, so the trend line has no gaps.
   */
  async getOperatingCostReport({ generatorId, year } = {}) {
    const { from, to, year: y } = resolveYearRange(year);
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, fuelCost: 0, maintenanceCost: 0, operatingCost: 0 }));
    const generators = await generatorsFor(generatorId);
    if (!generators.length) return { year: y, from, to, totalFuelCost: 0, totalMaintenanceCost: 0, totalOperatingCost: 0, months };

    const generatorIds = generators.map((g) => g._id);
    const [fuelRows, maintenanceRows] = await Promise.all([
      reportRepository.fuelByGeneratorMonth(generatorIds, from, to),
      reportRepository.maintenanceCostByGeneratorMonth(generatorIds, from, to),
    ]);

    const byMonth = new Map(months.map((m) => [m.month, m]));
    for (const row of fuelRows) {
      const entry = byMonth.get(row._id.month);
      if (entry) entry.fuelCost = round2(entry.fuelCost + (row.fuelCostTotal || 0));
    }
    for (const row of maintenanceRows) {
      const entry = byMonth.get(row._id.month);
      if (entry) entry.maintenanceCost = round2(entry.maintenanceCost + (row.cost || 0));
    }
    for (const m of months) m.operatingCost = round2(m.fuelCost + m.maintenanceCost);

    return {
      year: y,
      from,
      to,
      totalFuelCost: round2(months.reduce((sum, m) => sum + m.fuelCost, 0)),
      totalMaintenanceCost: round2(months.reduce((sum, m) => sum + m.maintenanceCost, 0)),
      totalOperatingCost: round2(months.reduce((sum, m) => sum + m.operatingCost, 0)),
      months,
    };
  },

  // "History" defaults to jobs that are actually done with — completed or
  // cancelled — not the open work already covered by the maintenance page's
  // own list/alerts endpoints. A single `status` overrides that, e.g. to
  // pull just "completed" jobs for an invoice audit.
  /**
   * Service-history report (spec 4.2: "maintenance service history"). A
   * paginated, filterable list of past maintenance jobs, ranged on
   * scheduledDate like the diesel/maintenance-cost reports.
   */
  async getServiceHistoryReport({ generatorId, status, from, to, page, pageSize } = {}) {
    const range = resolveDateRange({ from, to });
    const generators = await generatorsFor(generatorId);
    const statuses = status ? [status] : ["completed", "cancelled"];

    if (!generators.length) {
      return { ...range, page: page || 1, pageSize: pageSize || 20, totalItems: 0, totalPages: 0, items: [] };
    }

    const { items, ...meta } = await reportRepository.serviceHistory({
      generatorIds: generators.map((g) => g._id),
      statuses,
      from: range.from,
      to: range.to,
      page,
      pageSize,
    });
    return { ...range, ...meta, items };
  },

  /**
   * Cost-analysis summary (spec 4.2: "cost-analysis dashboard" — this is the
   * data behind it; the dashboard UI itself is a later story). Fuel cost
   * plus maintenance cost, combined per generator over an arbitrary range,
   * sorted highest total cost first, with each generator's share of the
   * fleet total — the breakdown a dashboard would chart.
   */
  async getCostSummaryReport({ generatorId, from, to } = {}) {
    const range = resolveDateRange({ from, to });
    const generators = await generatorsFor(generatorId);
    if (!generators.length) {
      return { ...range, totalFuelCost: 0, totalMaintenanceCost: 0, totalCost: 0, generators: [] };
    }

    const rows = seedRows(generators, { fuelCost: 0, maintenanceCost: 0 });
    const generatorIds = generators.map((g) => g._id);
    const [fuelRows, maintenanceRows] = await Promise.all([
      reportRepository.fuelCostByGeneratorRange(generatorIds, range.from, range.to),
      reportRepository.maintenanceCostByGenerator(generatorIds, range.from, range.to),
    ]);
    for (const row of fuelRows) {
      const entry = rows.get(String(row._id));
      if (entry) entry.fuelCost = round2(row.fuelCostTotal);
    }
    for (const row of maintenanceRows) {
      const entry = rows.get(String(row._id));
      if (entry) entry.maintenanceCost = round2(row.cost);
    }

    const totalCost = round2([...rows.values()].reduce((sum, r) => sum + r.fuelCost + r.maintenanceCost, 0));
    const result = [...rows.values()]
      .map((row) => {
        const rowTotal = round2(row.fuelCost + row.maintenanceCost);
        return { ...row, totalCost: rowTotal, percentOfFleetCost: totalCost > 0 ? round2((rowTotal / totalCost) * 100) : 0 };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    return {
      ...range,
      totalFuelCost: round2(result.reduce((sum, r) => sum + r.fuelCost, 0)),
      totalMaintenanceCost: round2(result.reduce((sum, r) => sum + r.maintenanceCost, 0)),
      totalCost,
      generators: result,
    };
  },
};
