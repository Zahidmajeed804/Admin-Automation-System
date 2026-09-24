import mongoose from "mongoose";
import { Generator, GeneratorLog, GeneratorMaintenance } from "../src/models/index.js";
import { createGenerator } from "./helpers/generatorTestUtils.js";

const oid = () => new mongoose.Types.ObjectId();
const hasIndex = async (Model, key) => {
  await Model.init(); // make sure indexes are built before inspecting them
  return (await Model.collection.indexes()).some((i) => JSON.stringify(i.key) === JSON.stringify(key));
};

describe("Generator model", () => {
  it("applies defaults", async () => {
    const gen = await Generator.create({ tag: "GEN-01", name: "Main" });

    expect(gen).toMatchObject({ status: "operational", fuelType: "diesel", runningHoursTotal: 0, isActive: true });
    expect(gen.lastServiceDate).toBeUndefined();
  });

  it("requires a tag and a name, and keeps tags unique", async () => {
    await Generator.init();
    await expect(Generator.create({ name: "No tag" })).rejects.toThrow();
    await expect(Generator.create({ tag: "T" })).rejects.toThrow();
    await Generator.create({ tag: "SAME", name: "A" });
    await expect(Generator.create({ tag: "SAME", name: "B" })).rejects.toThrow();
  });

  it("rejects values outside the status and fuel-type lists", async () => {
    await expect(Generator.create({ tag: "A", name: "A", status: "on_fire" })).rejects.toThrow();
    await expect(Generator.create({ tag: "B", name: "B", fuelType: "unobtainium" })).rejects.toThrow();
  });
});

describe("GeneratorLog model", () => {
  it("applies defaults and links to its generator", async () => {
    const gen = await createGenerator();

    const log = await GeneratorLog.create({ generator: gen._id, hoursRun: 2.5, recordedBy: oid() });

    expect(log).toMatchObject({ fuelAddedLiters: 0, fuelConsumedLiters: 0 });
    expect(log.date).toBeInstanceOf(Date);
    expect((await GeneratorLog.findById(log._id).populate("generator")).generator.tag).toBe(gen.tag);
  });

  it("requires generator, hoursRun and recordedBy", async () => {
    await expect(GeneratorLog.create({})).rejects.toThrow();
    await expect(GeneratorLog.create({ generator: oid(), recordedBy: oid() })).rejects.toThrow(); // no hoursRun
    await expect(GeneratorLog.create({ generator: oid(), hoursRun: 1 })).rejects.toThrow(); // no recordedBy
  });

  it.each([
    ["hoursRun"], ["meterReadingHours"], ["fuelAddedLiters"], ["fuelConsumedLiters"],
    ["openingFuelLiters"], ["closingFuelLiters"], ["fuelCostPerLiter"], ["fuelCostTotal"],
  ])("rejects a negative %s", async (field) => {
    await expect(GeneratorLog.create({ generator: oid(), recordedBy: oid(), hoursRun: 1, [field]: -1 })).rejects.toThrow();
  });

  it("stores the opening/closing fuel, price, total and vendor when given, and trims the vendor", async () => {
    const gen = await createGenerator();

    const log = await GeneratorLog.create({
      generator: gen._id, recordedBy: oid(), hoursRun: 1,
      openingFuelLiters: 100, closingFuelLiters: 60, fuelCostPerLiter: 285.5, fuelCostTotal: 5710, fuelVendor: "  PSO  ",
    });

    expect(await GeneratorLog.findById(log._id)).toMatchObject({
      openingFuelLiters: 100, closingFuelLiters: 60, fuelCostPerLiter: 285.5, fuelCostTotal: 5710, fuelVendor: "PSO",
    });
  });

  it("leaves the new fuel fields unset (not 0) when they are not given", async () => {
    const gen = await createGenerator();

    const log = await GeneratorLog.create({ generator: gen._id, hoursRun: 1, recordedBy: oid() });

    expect(log.openingFuelLiters).toBeUndefined();
    expect(log.closingFuelLiters).toBeUndefined();
    expect(log.fuelCostPerLiter).toBeUndefined();
    expect(log.fuelCostTotal).toBeUndefined();
    expect(log.fuelVendor).toBeUndefined();
  });

  it("accepts 0 for the opening reading, closing reading and price", async () => {
    const gen = await createGenerator();

    await expect(
      GeneratorLog.create({ generator: gen._id, recordedBy: oid(), hoursRun: 1, openingFuelLiters: 0, closingFuelLiters: 0, fuelCostPerLiter: 0 })
    ).resolves.toBeTruthy();
  });

  it("is indexed by generator then date", async () => {
    expect(await hasIndex(GeneratorLog, { generator: 1, date: -1 })).toBe(true);
  });
});

describe("GeneratorMaintenance model", () => {
  const base = () => ({ generator: oid(), description: "x", scheduledDate: new Date("2026-10-01") });

  it("applies defaults, and links to its generator (a path literally named `type` works)", async () => {
    const gen = await createGenerator();

    const job = await GeneratorMaintenance.create({ ...base(), generator: gen._id });

    expect(job).toMatchObject({ type: "scheduled", status: "scheduled", alertThresholdDays: 7 });
    expect(job.completedDate).toBeUndefined();
    expect((await GeneratorMaintenance.findById(job._id).populate("generator")).generator.tag).toBe(gen.tag);
  });

  it("requires generator, description and scheduledDate", async () => {
    await expect(GeneratorMaintenance.create({})).rejects.toThrow();
    await expect(GeneratorMaintenance.create({ generator: oid(), scheduledDate: new Date() })).rejects.toThrow();
    await expect(GeneratorMaintenance.create({ generator: oid(), description: "x" })).rejects.toThrow();
  });

  it("only stores real statuses — `overdue` and `upcoming` are computed, never stored", async () => {
    for (const status of ["overdue", "upcoming", "haunted"]) {
      await expect(GeneratorMaintenance.create({ ...base(), status })).rejects.toThrow();
    }
    for (const status of ["scheduled", "completed", "cancelled"]) {
      await expect(GeneratorMaintenance.create({ ...base(), status })).resolves.toBeTruthy();
    }
  });

  it("rejects an unknown type, intervalDays below 1, and negative threshold or cost", async () => {
    await expect(GeneratorMaintenance.create({ ...base(), type: "surprise" })).rejects.toThrow();
    await expect(GeneratorMaintenance.create({ ...base(), intervalDays: 0 })).rejects.toThrow();
    await expect(GeneratorMaintenance.create({ ...base(), alertThresholdDays: -1 })).rejects.toThrow();
    await expect(GeneratorMaintenance.create({ ...base(), cost: -5 })).rejects.toThrow();
    await expect(GeneratorMaintenance.create({ ...base(), intervalDays: 90, alertThresholdDays: 0, cost: 250.5 })).resolves.toBeTruthy();
  });

  it("is indexed for per-generator listing and for the alerts query", async () => {
    expect(await hasIndex(GeneratorMaintenance, { generator: 1, scheduledDate: 1 })).toBe(true);
    expect(await hasIndex(GeneratorMaintenance, { status: 1, scheduledDate: 1 })).toBe(true);
  });
});
