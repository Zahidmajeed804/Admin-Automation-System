import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { Generator, GeneratorLog, GeneratorMaintenance } from "../src/models/index.js";
import { generatorRepository } from "../src/repositories/generatorRepository.js";
import { generatorLogRepository } from "../src/repositories/generatorLogRepository.js";
import { generatorMaintenanceRepository } from "../src/repositories/generatorMaintenanceRepository.js";
import { generatorService, computeAlertStatus, computeFuelFigures, daysUntilDue, withAlertInfo } from "../src/services/generatorService.js";
import { NotFoundError, ConflictError } from "../src/errors/AppError.js";
import { createGenerator, UNKNOWN_ID } from "./helpers/generatorTestUtils.js";

// A fixed "now" mid-afternoon UTC, so "due at 00:00 today" is already in the past.
const NOW = new Date("2026-10-10T15:30:00Z");
const job = (scheduledDate, extra = {}) => ({ status: "scheduled", alertThresholdDays: 7, scheduledDate: new Date(scheduledDate), ...extra });
const userId = () => new mongoose.Types.ObjectId();

afterEach(() => jest.restoreAllMocks());

describe("computeAlertStatus (pure)", () => {
  it.each([
    ["the day before today", "2026-10-09", {}, "overdue"],
    ["a year ago", "2025-10-10", {}, "overdue"],
    ["today, even though 00:00 has already passed", "2026-10-10T00:00:00Z", {}, "upcoming"],
    ["today, late in the day", "2026-10-10T23:59:00Z", {}, "upcoming"],
    ["tomorrow", "2026-10-11", {}, "upcoming"],
    ["exactly the threshold away (7 days)", "2026-10-17", {}, "upcoming"],
    ["one day past the threshold (8 days)", "2026-10-18", {}, "scheduled"],
    ["far in the future", "2027-10-10", {}, "scheduled"],
    ["today with a threshold of 0", "2026-10-10", { alertThresholdDays: 0 }, "upcoming"],
    ["tomorrow with a threshold of 0", "2026-10-11", { alertThresholdDays: 0 }, "scheduled"],
    ["25 days out with a threshold of 30", "2026-11-04", { alertThresholdDays: 30 }, "upcoming"],
    ["4 days out with the threshold missing (defaults to 7)", "2026-10-14", { alertThresholdDays: undefined }, "upcoming"],
    ["9 days out with the threshold missing (defaults to 7)", "2026-10-19", { alertThresholdDays: undefined }, "scheduled"],
  ])("a scheduled job due %s is %s", (_label, due, extra, expected) => {
    expect(computeAlertStatus(job(due, extra), NOW)).toBe(expected);
  });

  it.each(["completed", "cancelled"])("returns %s jobs as-is, however old — they are never alerts", (status) => {
    expect(computeAlertStatus(job("2020-01-01", { status }), NOW)).toBe(status);
  });

  it("works on a mongoose document and does not modify its input", async () => {
    const gen = await createGenerator();
    const doc = await GeneratorMaintenance.create({ generator: gen._id, description: "x", scheduledDate: new Date("2026-10-09") });
    const before = JSON.stringify(doc);

    expect(computeAlertStatus(doc, NOW)).toBe("overdue");
    expect(generatorService.computeAlertStatus(doc, NOW)).toBe("overdue"); // also exposed on the service
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("daysUntilDue and withAlertInfo (pure)", () => {
  it("counts whole calendar days: 0 today, positive ahead, negative overdue", () => {
    expect(daysUntilDue(new Date("2026-10-10T00:00:00Z"), NOW)).toBe(0);
    expect(daysUntilDue(new Date("2026-10-10T23:59:00Z"), NOW)).toBe(0);
    expect(daysUntilDue(new Date("2026-10-13"), NOW)).toBe(3);
    expect(daysUntilDue(new Date("2026-10-05"), NOW)).toBe(-5);
  });

  it("attaches alertStatus and daysUntilDue to a plain copy, leaving the original untouched", () => {
    const original = job("2026-10-13");

    const view = withAlertInfo(original, NOW);

    expect(view).toMatchObject({ alertStatus: "upcoming", daysUntilDue: 3 });
    expect(original.alertStatus).toBeUndefined();
  });
});

describe("computeFuelFigures (pure)", () => {
  it.each([
    ["consumption is opening + added - closing", { openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 120 }, { fuelConsumedLiters: 30 }],
    ["consumption with no fuel added", { openingFuelLiters: 100, closingFuelLiters: 70 }, { fuelConsumedLiters: 30 }],
    ["closing equal to opening + added means 0 consumed", { openingFuelLiters: 10, fuelAddedLiters: 5, closingFuelLiters: 15 }, { fuelConsumedLiters: 0 }],
    ["numbers sent as strings", { openingFuelLiters: "100", fuelAddedLiters: "50", closingFuelLiters: "120" }, { fuelConsumedLiters: 30 }],
    ["float noise is rounded away (0.1 + 0.2 - 0.3)", { openingFuelLiters: 0.1, fuelAddedLiters: 0.2, closingFuelLiters: 0.3 }, { fuelConsumedLiters: 0 }],
    ["only an opening reading derives nothing", { openingFuelLiters: 100, fuelAddedLiters: 50 }, {}],
    ["only a closing reading derives nothing", { closingFuelLiters: 100 }, {}],
    ["cost is litres added x price", { fuelAddedLiters: 40, fuelCostPerLiter: 285.5 }, { fuelCostTotal: 11420 }],
    ["cost is rounded to 2 decimals", { fuelAddedLiters: 3, fuelCostPerLiter: 0.333 }, { fuelCostTotal: 1 }],
    ["a price with no litres added derives no cost", { fuelCostPerLiter: 285 }, {}],
    ["a price with 0 litres added derives no cost", { fuelAddedLiters: 0, fuelCostPerLiter: 285 }, {}],
    ["a price of 0 is honoured (free fuel)", { fuelAddedLiters: 10, fuelCostPerLiter: 0 }, { fuelCostTotal: 0 }],
    ["both figures together", { openingFuelLiters: 100, fuelAddedLiters: 50, closingFuelLiters: 120, fuelCostPerLiter: 2 }, { fuelConsumedLiters: 30, fuelCostTotal: 100 }],
    ["an empty input", {}, {}],
    ["no input at all", undefined, {}],
  ])("%s", (_label, input, expected) => {
    expect(computeFuelFigures(input)).toEqual(expected);
  });

  it("is also exposed on the service and does not modify its input", () => {
    const input = { openingFuelLiters: 10, fuelAddedLiters: 5, closingFuelLiters: 4 };
    const before = { ...input };

    expect(generatorService.computeFuelFigures(input)).toEqual({ fuelConsumedLiters: 11 });
    expect(input).toEqual(before);
  });
});

describe("recordLog / removeLog", () => {
  it("recordLog stores the entry and adds its hours to the generator", async () => {
    const gen = await createGenerator();

    const { log, generator } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 2.5, reason: "outage" });

    expect(log).toMatchObject({ hoursRun: 2.5, reason: "outage" });
    expect(generator.runningHoursTotal).toBe(2.5);
  });

  it("loses no hours when many entries are recorded at the same moment", async () => {
    const gen = await createGenerator();

    await Promise.all(Array.from({ length: 10 }, () => generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 1 })));

    expect((await Generator.findById(gen._id)).runningHoursTotal).toBe(10);
    expect(await GeneratorLog.countDocuments({ generator: gen._id })).toBe(10);
  });

  it("rejects an unknown or deleted generator without leaving a log behind", async () => {
    const deleted = await createGenerator({ isActive: false });

    await expect(generatorService.recordLog({ generatorId: UNKNOWN_ID, recordedBy: userId(), hoursRun: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(generatorService.recordLog({ generatorId: deleted._id, recordedBy: userId(), hoursRun: 1 })).rejects.toBeInstanceOf(NotFoundError);
    expect(await GeneratorLog.countDocuments()).toBe(0);
  });

  it("stores derived fuel consumption and cost, overriding client-sent values, and keeps the vendor", async () => {
    const gen = await createGenerator();

    const { log } = await generatorService.recordLog({
      generatorId: gen._id,
      recordedBy: userId(),
      hoursRun: 3,
      openingFuelLiters: 100,
      fuelAddedLiters: 50,
      closingFuelLiters: 120,
      fuelCostPerLiter: 285.5,
      fuelVendor: "PSO Pump",
      fuelConsumedLiters: 999,
      fuelCostTotal: 1,
    });

    expect(log).toMatchObject({ fuelConsumedLiters: 30, fuelCostTotal: 14275, fuelVendor: "PSO Pump" });
    expect(await GeneratorLog.findById(log._id)).toMatchObject({ fuelConsumedLiters: 30, fuelCostTotal: 14275 }); // persisted
  });

  it("keeps a client-supplied consumed figure and total when they cannot be derived", async () => {
    const gen = await createGenerator();

    const { log } = await generatorService.recordLog({
      generatorId: gen._id,
      recordedBy: userId(),
      hoursRun: 1,
      fuelAddedLiters: 20,
      fuelConsumedLiters: 8,
      fuelCostTotal: 5000,
    });

    expect(log).toMatchObject({ fuelConsumedLiters: 8, fuelCostTotal: 5000 });
  });

  it("leaves the new fuel fields unset on an old-style entry", async () => {
    const gen = await createGenerator();

    const { log } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 2, fuelAddedLiters: 10 });

    expect(log.openingFuelLiters).toBeUndefined();
    expect(log.closingFuelLiters).toBeUndefined();
    expect(log.fuelCostTotal).toBeUndefined();
    expect(log.fuelConsumedLiters).toBe(0);
  });

  it("removes the log again if adding its hours fails, so history and total stay consistent", async () => {
    const gen = await createGenerator();
    jest.spyOn(generatorRepository, "incrementRunningHours").mockRejectedValue(new Error("database hiccup"));

    await expect(generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 3 })).rejects.toThrow("database hiccup");

    expect(await GeneratorLog.countDocuments()).toBe(0);
    expect((await Generator.findById(gen._id)).runningHoursTotal).toBe(0);
  });

  it("removeLog deletes the entry and subtracts its hours; an unknown log is NotFound", async () => {
    const gen = await createGenerator();
    await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 2 });
    const { log } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 5 });

    const removed = await generatorService.removeLog(log._id);

    expect(removed.generator.runningHoursTotal).toBe(2);
    expect(await GeneratorLog.findById(log._id)).toBeNull();
    await expect(generatorService.removeLog(UNKNOWN_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateLog", () => {
  const hoursOf = async (gen) => (await Generator.findById(gen._id)).runningHoursTotal;

  it("adjusts the generator's total by the change in hours run", async () => {
    const gen = await createGenerator();
    const { log } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 4 });

    const { log: updated, generator } = await generatorService.updateLog(log._id, { hoursRun: 1.5 });

    expect(updated.hoursRun).toBe(1.5);
    expect(generator.runningHoursTotal).toBe(1.5);
    expect(await hoursOf(gen)).toBe(1.5);
  });

  it("rejects an unknown log with NotFound and changes nothing", async () => {
    const gen = await createGenerator();
    await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 4 });

    await expect(generatorService.updateLog(UNKNOWN_ID, { hoursRun: 9 })).rejects.toBeInstanceOf(NotFoundError);
    expect(await hoursOf(gen)).toBe(4);
  });

  it("puts the hours back if the log itself cannot be updated, so total and history stay consistent", async () => {
    const gen = await createGenerator();
    const { log } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 4 });
    jest.spyOn(generatorLogRepository, "updateById").mockRejectedValue(new Error("database hiccup"));

    await expect(generatorService.updateLog(log._id, { hoursRun: 10 })).rejects.toThrow("database hiccup");

    expect(await hoursOf(gen)).toBe(4);
    expect((await GeneratorLog.findById(log._id)).hoursRun).toBe(4);
  });

  it("puts the hours back if the log disappeared while it was being corrected", async () => {
    const gen = await createGenerator();
    const { log } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 4 });
    jest.spyOn(generatorLogRepository, "updateById").mockResolvedValue(null);

    await expect(generatorService.updateLog(log._id, { hoursRun: 10 })).rejects.toBeInstanceOf(NotFoundError);

    expect(await hoursOf(gen)).toBe(4);
  });

  it("does nothing, and writes nothing, for an empty change", async () => {
    const gen = await createGenerator();
    const { log } = await generatorService.recordLog({ generatorId: gen._id, recordedBy: userId(), hoursRun: 4 });
    const spy = jest.spyOn(generatorLogRepository, "updateById");

    const { generator } = await generatorService.updateLog(log._id, {});

    expect(spy).not.toHaveBeenCalled();
    expect(generator.runningHoursTotal).toBe(4);
  });
});

describe("completeMaintenance", () => {
  const insertJob = (gen, extra = {}) =>
    GeneratorMaintenance.create({ generator: gen._id, description: "Oil change", scheduledDate: new Date("2026-10-01"), ...extra });

  it("rejects an unknown job (NotFound) and a job that is already completed or cancelled (Conflict)", async () => {
    const gen = await createGenerator();

    await expect(generatorService.completeMaintenance(UNKNOWN_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(generatorService.completeMaintenance((await insertJob(gen, { status: "completed" }))._id)).rejects.toBeInstanceOf(ConflictError);
    await expect(generatorService.completeMaintenance((await insertJob(gen, { status: "cancelled" }))._id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("with two simultaneous requests, exactly one wins and only ONE next occurrence is created", async () => {
    const gen = await createGenerator();
    const recurring = await insertJob(gen, { intervalDays: 30 });

    const results = await Promise.allSettled([
      generatorService.completeMaintenance(recurring._id, { completedDate: "2026-10-05T00:00:00Z" }),
      generatorService.completeMaintenance(recurring._id, { completedDate: "2026-10-05T00:00:00Z" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(await GeneratorMaintenance.countDocuments({ generator: gen._id })).toBe(2); // the original + one next
  });

  it("a cancel racing a completion cannot overwrite it — one wins, the other is rejected", async () => {
    const gen = await createGenerator();
    const racing = await insertJob(gen);

    const results = await Promise.allSettled([
      generatorService.completeMaintenance(racing._id),
      generatorService.updateMaintenance(racing._id, { status: "cancelled" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = await GeneratorMaintenance.findById(racing._id);
    expect(["completed", "cancelled"]).toContain(final.status);
    expect(Boolean(final.completedDate)).toBe(final.status === "completed"); // no half-and-half record
  });

  it("if updating the generator fails, the job goes back to exactly how it was and the next occurrence is removed", async () => {
    const gen = await createGenerator();
    const original = await insertJob(gen, { intervalDays: 30, performedBy: "Original Tech" });
    jest.spyOn(generatorRepository, "recordServiceDate").mockRejectedValue(new Error("boom"));

    await expect(
      generatorService.completeMaintenance(original._id, { completedDate: "2026-10-05T00:00:00Z", performedBy: "New Tech", cost: 99 })
    ).rejects.toThrow("boom");

    const after = await GeneratorMaintenance.findById(original._id);
    expect(after.status).toBe("scheduled");
    expect(after.completedDate).toBeUndefined();
    expect(after.cost).toBeUndefined(); // the completion details are gone…
    expect(after.performedBy).toBe("Original Tech"); // …and the original value is restored, not blanked
    expect(await GeneratorMaintenance.countDocuments({ generator: gen._id })).toBe(1);

    jest.restoreAllMocks();
    await expect(generatorService.completeMaintenance(original._id)).resolves.toBeTruthy(); // and it can still be completed
  });

  it("if creating the next occurrence fails, the job goes back to scheduled and the service date is untouched", async () => {
    const gen = await createGenerator();
    const recurring = await insertJob(gen, { intervalDays: 30 });
    jest.spyOn(generatorMaintenanceRepository, "create").mockRejectedValue(new Error("nope"));

    await expect(generatorService.completeMaintenance(recurring._id)).rejects.toThrow("nope");

    expect((await GeneratorMaintenance.findById(recurring._id)).status).toBe("scheduled");
    expect((await Generator.findById(gen._id)).lastServiceDate).toBeUndefined();
  });
});

describe("updateMaintenance", () => {
  it("edits a scheduled job, ignoring fields that are undefined", async () => {
    const gen = await createGenerator();
    const scheduled = await GeneratorMaintenance.create({ generator: gen._id, description: "Before", scheduledDate: new Date("2026-10-01"), notes: "keep me" });

    const updated = await generatorService.updateMaintenance(scheduled._id, { description: "After", notes: undefined });

    expect(updated.description).toBe("After");
    expect(updated.notes).toBe("keep me");
  });

  it("is NotFound for an unknown job and Conflict for one that is no longer scheduled", async () => {
    const gen = await createGenerator();
    const done = await GeneratorMaintenance.create({ generator: gen._id, description: "x", scheduledDate: new Date("2026-10-01"), status: "completed" });

    await expect(generatorService.updateMaintenance(UNKNOWN_ID, { notes: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(generatorService.updateMaintenance(done._id, { notes: "x" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("getMaintenanceAlerts", () => {
  it("buckets by each job's own threshold, using the `now` it is given", async () => {
    const gen = await createGenerator();
    const at = (description, date, extra = {}) => GeneratorMaintenance.create({ generator: gen._id, description, scheduledDate: new Date(date), ...extra });
    await at("overdue", "2026-10-05");
    await at("today", "2026-10-10T00:00:00Z");
    await at("in-7", "2026-10-17");
    await at("in-8", "2026-10-18");
    await at("in-20-thr-30", "2026-10-30", { alertThresholdDays: 30 });

    const { overdue, upcoming, counts } = await generatorService.getMaintenanceAlerts({ now: NOW });

    expect(overdue.map((j) => j.description)).toEqual(["overdue"]);
    expect(overdue[0].daysUntilDue).toBe(-5);
    expect(upcoming.map((j) => j.description)).toEqual(["today", "in-7", "in-20-thr-30"]);
    expect(upcoming.map((j) => j.daysUntilDue)).toEqual([0, 7, 20]);
    expect(counts).toEqual({ overdue: 1, upcoming: 3 });
  });

  it("withinDays replaces every job's own threshold, but does not touch what is reported as overdue", async () => {
    const gen = await createGenerator();
    const at = (description, date, extra = {}) => GeneratorMaintenance.create({ generator: gen._id, description, scheduledDate: new Date(date), ...extra });
    await at("overdue", "2026-10-05");
    await at("in-3", "2026-10-13");
    await at("in-20-thr-30", "2026-10-30", { alertThresholdDays: 30 });

    const wide = await generatorService.getMaintenanceAlerts({ withinDays: 60, now: NOW });
    const narrow = await generatorService.getMaintenanceAlerts({ withinDays: 5, now: NOW });

    expect(wide.upcoming.map((j) => j.description)).toEqual(["in-3", "in-20-thr-30"]);
    expect(narrow.upcoming.map((j) => j.description)).toEqual(["in-3"]); // its own 30-day threshold no longer applies
    expect(narrow.overdue.map((j) => j.description)).toEqual(["overdue"]);
    expect(narrow.upcoming[0].alertThresholdDays).toBe(7); // the job's stored threshold is not altered in the output
  });

  it("skips jobs on deleted generators and jobs that are not scheduled", async () => {
    const live = await createGenerator();
    const dead = await createGenerator({ isActive: false });
    const make = (gen, description, extra = {}) => GeneratorMaintenance.create({ generator: gen._id, description, scheduledDate: new Date("2026-10-01"), ...extra });
    await make(live, "counts");
    await make(dead, "on-deleted-generator");
    await make(live, "done", { status: "completed" });
    await make(live, "cancelled", { status: "cancelled" });

    const { overdue } = await generatorService.getMaintenanceAlerts({ now: NOW });

    expect(overdue.map((j) => j.description)).toEqual(["counts"]);
  });
});

describe("scheduleMaintenance", () => {
  it("always creates the job as scheduled, ignoring status and completedDate", async () => {
    const gen = await createGenerator();

    const created = await generatorService.scheduleMaintenance({
      generatorId: gen._id,
      createdBy: userId(),
      description: "Inspection",
      scheduledDate: new Date("2026-11-01"),
      status: "completed",
      completedDate: new Date("2026-10-01"),
    });

    expect(created.description).toBe("Inspection");
    expect(created.status).toBe("scheduled");
    expect(created.completedDate).toBeUndefined();
  });

  it("rejects an unknown or deleted generator", async () => {
    const deleted = await createGenerator({ isActive: false });
    const base = { createdBy: userId(), description: "x", scheduledDate: new Date("2026-11-01") };

    await expect(generatorService.scheduleMaintenance({ ...base, generatorId: UNKNOWN_ID })).rejects.toBeInstanceOf(NotFoundError);
    await expect(generatorService.scheduleMaintenance({ ...base, generatorId: deleted._id })).rejects.toBeInstanceOf(NotFoundError);
  });
});
