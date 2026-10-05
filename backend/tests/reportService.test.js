import { Generator, GeneratorLog, GeneratorMaintenance } from "../src/models/index.js";
import {
  reportService,
  resolveMonthRange,
  resolveDateRange,
  resolveYearRange,
} from "../src/services/reportService.js";
import { createGenerator, UNKNOWN_ID } from "./helpers/generatorTestUtils.js";

const insertLog = (generator, overrides = {}) =>
  GeneratorLog.create({ generator: generator._id, date: new Date(), hoursRun: 1, recordedBy: generator._id, ...overrides });
const insertJob = (generator, overrides = {}) =>
  GeneratorMaintenance.create({ generator: generator._id, description: "Service", scheduledDate: new Date(), ...overrides });

describe("resolveMonthRange (pure)", () => {
  it("parses YYYY-MM into a [from, to) UTC month range", () => {
    const r = resolveMonthRange("2026-02");
    expect(r).toMatchObject({ year: 2026, month: 2 });
    expect(r.from.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("defaults to the current UTC month when no month is given", () => {
    const now = new Date();
    const r = resolveMonthRange();
    expect(r).toMatchObject({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  });

  it.each(["2026-13", "not-a-month", "26-01"])("rejects an invalid month shape (%s)", (month) => {
    expect(() => resolveMonthRange(month)).toThrow(/month/i);
  });
});

describe("resolveDateRange (pure)", () => {
  it("keeps explicit from/to", () => {
    const r = resolveDateRange({ from: "2026-03-01", to: "2026-03-31" });
    expect(r.from.toISOString()).toContain("2026-03-01");
    expect(r.to.toISOString()).toContain("2026-03-31");
  });

  it("defaults to the 1st of the current month through now", () => {
    const now = new Date();
    const r = resolveDateRange({});
    expect(r.from.getUTCDate()).toBe(1);
    expect(r.from.getUTCMonth()).toBe(now.getUTCMonth());
    expect(Math.abs(r.to.getTime() - now.getTime())).toBeLessThan(5000);
  });

  it("rejects a from after to", () => {
    expect(() => resolveDateRange({ from: "2026-05-01", to: "2026-01-01" })).toThrow(/from/i);
  });
});

describe("resolveYearRange (pure)", () => {
  it("spans exactly the given calendar year", () => {
    const r = resolveYearRange(2026);
    expect(r.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it.each([1900, 2200, "abc"])("rejects an out-of-range or non-numeric year (%s)", (year) => {
    expect(() => resolveYearRange(year)).toThrow(/year/i);
  });
});

describe("reportService.getRunningHoursReport", () => {
  it("sums hoursRun per active generator for the given month, excluding other months and soft-deleted generators", async () => {
    const gen1 = await createGenerator();
    const gen2 = await createGenerator();
    const inactive = await createGenerator({ isActive: false });
    const thisMonth = resolveMonthRange().from;
    const lastMonth = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 15));

    await insertLog(gen1, { date: new Date(thisMonth.getTime() + 86400000), hoursRun: 10 });
    await insertLog(gen1, { date: new Date(thisMonth.getTime() + 86400000), hoursRun: 5 });
    await insertLog(gen2, { date: new Date(thisMonth.getTime() + 86400000), hoursRun: 3 });
    await insertLog(gen1, { date: lastMonth, hoursRun: 100 });
    await insertLog(inactive, { date: new Date(thisMonth.getTime() + 86400000), hoursRun: 999 });

    const report = await reportService.getRunningHoursReport({});

    expect(report.generators).toHaveLength(2);
    const a = report.generators.find((g) => String(g.generator.id) === String(gen1._id));
    const b = report.generators.find((g) => String(g.generator.id) === String(gen2._id));
    expect(a).toMatchObject({ hoursRun: 15, logCount: 2 });
    expect(b).toMatchObject({ hoursRun: 3, logCount: 1 });
    expect(report.totalHoursRun).toBe(18);
    expect(report.generators.some((g) => String(g.generator.id) === String(inactive._id))).toBe(false);
  });

  it("still lists a generator with no logs this month, at 0", async () => {
    const gen = await createGenerator();
    const report = await reportService.getRunningHoursReport({});
    expect(report.generators).toEqual([{ generator: { id: gen._id, tag: gen.tag, name: gen.name, fuelType: gen.fuelType }, hoursRun: 0, logCount: 0 }]);
  });

  it("scopes to one generator via generatorId", async () => {
    const gen1 = await createGenerator();
    await createGenerator();
    await insertLog(gen1, { hoursRun: 7 });

    const report = await reportService.getRunningHoursReport({ generatorId: String(gen1._id) });
    expect(report.generators).toHaveLength(1);
    expect(report.totalHoursRun).toBe(7);
  });

  it("throws NotFoundError for an unknown or soft-deleted generatorId", async () => {
    const inactive = await createGenerator({ isActive: false });
    await expect(reportService.getRunningHoursReport({ generatorId: String(inactive._id) })).rejects.toMatchObject({ statusCode: 404 });
    await expect(reportService.getRunningHoursReport({ generatorId: UNKNOWN_ID })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("reportService.getFuelConsumptionReport", () => {
  it("sums fuel added/consumed per generator within an arbitrary inclusive range", async () => {
    const gen1 = await createGenerator();
    const gen2 = await createGenerator();
    await insertLog(gen1, { date: new Date("2026-03-15"), fuelAddedLiters: 50, fuelConsumedLiters: 40 });
    await insertLog(gen1, { date: new Date("2026-03-15"), fuelAddedLiters: 0, fuelConsumedLiters: 10 });
    await insertLog(gen2, { date: new Date("2026-03-15"), fuelAddedLiters: 20, fuelConsumedLiters: 15 });
    await insertLog(gen1, { date: new Date("2026-01-01"), fuelAddedLiters: 999, fuelConsumedLiters: 999 });

    const report = await reportService.getFuelConsumptionReport({ from: "2026-03-01", to: "2026-03-31" });

    const a = report.generators.find((g) => String(g.generator.id) === String(gen1._id));
    expect(a).toMatchObject({ fuelAddedLiters: 50, fuelConsumedLiters: 50, logCount: 2 });
    expect(report.totalFuelAddedLiters).toBe(70);
    expect(report.totalFuelConsumedLiters).toBe(65);
    expect(report.totalFuelAddedKg).toBe(0);
    expect(report.totalFuelConsumedKg).toBe(0);
  });

  it("keeps litres and kg totals separate, never summed together", async () => {
    const dieselGen = await createGenerator({ fuelType: "diesel" });
    const cngGen = await createGenerator({ fuelType: "cng" });
    await insertLog(dieselGen, { date: new Date("2026-03-15"), fuelAddedLiters: 50, fuelConsumedLiters: 40 });
    await insertLog(cngGen, { date: new Date("2026-03-15"), fuelAddedLiters: 30, fuelConsumedLiters: 25 });

    const report = await reportService.getFuelConsumptionReport({ from: "2026-03-01", to: "2026-03-31" });

    expect(report.totalFuelAddedLiters).toBe(50);
    expect(report.totalFuelConsumedLiters).toBe(40);
    expect(report.totalFuelAddedKg).toBe(30);
    expect(report.totalFuelConsumedKg).toBe(25);
  });
});

describe("reportService.getFuelCostReport", () => {
  it("sums fuel cost per generator for the given month and computes an average cost per litre", async () => {
    const gen1 = await createGenerator();
    const gen2 = await createGenerator(); // no logs -> zeros, not an error
    const thisMonth = new Date(resolveMonthRange().from.getTime() + 86400000);

    await insertLog(gen1, { date: thisMonth, fuelAddedLiters: 100, fuelCostTotal: 200 });
    await insertLog(gen1, { date: thisMonth, fuelAddedLiters: 50, fuelCostTotal: 120 });

    const report = await reportService.getFuelCostReport({});
    const a = report.generators.find((g) => String(g.generator.id) === String(gen1._id));
    const b = report.generators.find((g) => String(g.generator.id) === String(gen2._id));

    expect(a.fuelCostTotal).toBe(320);
    expect(a.averageCostPerLiter).toBe(Math.round((320 / 150) * 100) / 100);
    expect(b).toMatchObject({ fuelCostTotal: 0, averageCostPerLiter: 0 }); // no division-by-zero NaN
    expect(report.totalFuelCost).toBe(320);
  });
});

describe("reportService.getMaintenanceCostReport", () => {
  it("only counts completed jobs, ranged on completedDate, excluding scheduled/cancelled ones", async () => {
    const gen = await createGenerator();
    await insertJob(gen, { status: "completed", scheduledDate: new Date("2026-03-10"), completedDate: new Date("2026-03-10"), cost: 100 });
    await insertJob(gen, { status: "completed", scheduledDate: new Date("2026-03-12"), completedDate: new Date("2026-03-12"), cost: 50 });
    await insertJob(gen, { status: "completed", scheduledDate: new Date("2026-01-01"), completedDate: new Date("2026-01-01"), cost: 999 });
    await insertJob(gen, { status: "scheduled", scheduledDate: new Date("2026-03-10"), cost: 500 });
    // Has a completedDate in range and a cost, same as a real completed job would —
    // only the status tells these apart, so this is what actually exercises the filter.
    await insertJob(gen, { status: "cancelled", scheduledDate: new Date("2026-03-10"), completedDate: new Date("2026-03-10"), cost: 500 });

    const report = await reportService.getMaintenanceCostReport({ from: "2026-03-01", to: "2026-03-31" });

    expect(report.totalCost).toBe(150);
    expect(report.totalJobCount).toBe(2);
  });
});

describe("reportService.getOperatingCostReport", () => {
  it("combines fuel cost and maintenance cost into a 12-month trend for the year, leaving other years out", async () => {
    const gen = await createGenerator();
    await insertLog(gen, { date: new Date("2026-02-10"), fuelCostTotal: 100 });
    await insertLog(gen, { date: new Date("2025-02-10"), fuelCostTotal: 999 });
    await insertJob(gen, { status: "completed", scheduledDate: new Date("2026-03-01"), completedDate: new Date("2026-03-05"), cost: 200 });

    const report = await reportService.getOperatingCostReport({ year: 2026 });

    expect(report.months).toHaveLength(12);
    expect(report.months.find((m) => m.month === 2)).toMatchObject({ fuelCost: 100, maintenanceCost: 0, operatingCost: 100 });
    expect(report.months.find((m) => m.month === 3)).toMatchObject({ fuelCost: 0, maintenanceCost: 200, operatingCost: 200 });
    expect(report.months.find((m) => m.month === 1)).toMatchObject({ fuelCost: 0, maintenanceCost: 0, operatingCost: 0 });
    expect(report).toMatchObject({ totalFuelCost: 100, totalMaintenanceCost: 200, totalOperatingCost: 300 });
  });

  it("returns 12 zeroed months, not an error, when there are no active generators", async () => {
    await Generator.updateMany({}, { isActive: false });
    const report = await reportService.getOperatingCostReport({ year: 2026 });
    expect(report.months).toHaveLength(12);
    expect(report.totalOperatingCost).toBe(0);
  });
});

describe("reportService.getServiceHistoryReport", () => {
  it("defaults to completed + cancelled jobs, excluding still-scheduled ones and paginating", async () => {
    const gen = await createGenerator();
    await insertJob(gen, { description: "Completed", status: "completed", scheduledDate: new Date("2026-03-10"), completedDate: new Date("2026-03-10"), cost: 50 });
    await insertJob(gen, { description: "Cancelled", status: "cancelled", scheduledDate: new Date("2026-03-11") });
    await insertJob(gen, { description: "Still scheduled", status: "scheduled", scheduledDate: new Date("2026-03-12") });

    const report = await reportService.getServiceHistoryReport({ from: "2026-03-01", to: "2026-03-31" });

    expect(report.totalItems).toBe(2);
    expect(report.items.map((i) => i.description).sort()).toEqual(["Cancelled", "Completed"]);
    expect(report.items[0].generator).toMatchObject({ tag: gen.tag });
  });

  it("a status filter overrides the default, e.g. to pull just the still-open jobs", async () => {
    const gen = await createGenerator();
    await insertJob(gen, { status: "scheduled", scheduledDate: new Date("2026-03-10") });
    const report = await reportService.getServiceHistoryReport({ status: "scheduled", from: "2026-03-01", to: "2026-03-31" });
    expect(report.totalItems).toBe(1);
  });

  it("paginates with pageSize/page while totalItems reflects the whole set", async () => {
    const gen = await createGenerator();
    await insertJob(gen, { status: "completed", scheduledDate: new Date("2026-03-10"), completedDate: new Date("2026-03-10") });
    await insertJob(gen, { status: "completed", scheduledDate: new Date("2026-03-11"), completedDate: new Date("2026-03-11") });

    const page1 = await reportService.getServiceHistoryReport({ from: "2026-03-01", to: "2026-03-31", page: 1, pageSize: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1).toMatchObject({ totalItems: 2, totalPages: 2 });
  });
});

describe("reportService.getCostSummaryReport", () => {
  it("combines fuel and maintenance cost per generator, sorted by total cost, with each one's share of the fleet", async () => {
    const gen1 = await createGenerator();
    const gen2 = await createGenerator();
    await insertLog(gen1, { date: new Date("2026-03-15"), fuelCostTotal: 300 });
    await insertLog(gen1, { date: new Date("2026-03-31"), fuelCostTotal: 100 }); // exactly on the inclusive "to" boundary
    await insertLog(gen1, { date: new Date("2026-01-01"), fuelCostTotal: 999 }); // out of range
    await insertLog(gen2, { date: new Date("2026-03-15"), fuelCostTotal: 100 });
    await insertJob(gen1, { status: "completed", scheduledDate: new Date("2026-03-15"), completedDate: new Date("2026-03-15"), cost: 100 });
    await insertJob(gen2, { status: "completed", scheduledDate: new Date("2026-03-15"), completedDate: new Date("2026-03-15"), cost: 300 });

    const report = await reportService.getCostSummaryReport({ from: "2026-03-01", to: "2026-03-31" });

    const a = report.generators.find((g) => String(g.generator.id) === String(gen1._id));
    const b = report.generators.find((g) => String(g.generator.id) === String(gen2._id));
    expect(a).toMatchObject({ fuelCost: 400, maintenanceCost: 100, totalCost: 500 });
    expect(b).toMatchObject({ fuelCost: 100, maintenanceCost: 300, totalCost: 400 });
    expect(report.totalCost).toBe(900);
    expect(a.percentOfFleetCost + b.percentOfFleetCost).toBeCloseTo(100, 0);
    expect(report.generators[0].generator.id).toEqual(gen1._id); // sorted highest cost first
  });

  it("a generator with zero cost gets percentOfFleetCost 0, not NaN", async () => {
    const gen = await createGenerator();
    const report = await reportService.getCostSummaryReport({ generatorId: String(gen._id), from: "2026-03-01", to: "2026-03-31" });
    expect(report.generators[0].percentOfFleetCost).toBe(0);
  });
});
