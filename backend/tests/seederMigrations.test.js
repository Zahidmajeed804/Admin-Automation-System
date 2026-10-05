import { Generator } from "../src/models/index.js";
import { migrateGeneratorTagPartialIndex, migrateGasFuelTypeToCng } from "../src/seeders/index.js";

describe("migrateGeneratorTagPartialIndex", () => {
  it("drops a pre-existing non-partial tag index and replaces it with the partial one", async () => {
    // Simulate the state before this migration existed: a plain unique index
    // with no partialFilterExpression, the same shape the old schema produced.
    await Generator.init();
    try {
      await Generator.collection.dropIndex("tag_1");
    } catch {
      // may not exist yet in a fresh test DB — fine, createIndex below still proves the point
    }
    await Generator.collection.createIndex({ tag: 1 }, { unique: true, name: "tag_1" });

    await Generator.create({ tag: "OLD-INDEX", name: "Old", isActive: false });
    await expect(Generator.create({ tag: "OLD-INDEX", name: "New" })).rejects.toThrow();

    await migrateGeneratorTagPartialIndex();

    const indexes = await Generator.collection.indexes();
    const tagIndex = indexes.find((i) => i.name === "tag_1");
    expect(tagIndex.partialFilterExpression).toEqual({ isActive: true });

    await expect(Generator.create({ tag: "OLD-INDEX", name: "New" })).resolves.toMatchObject({ tag: "OLD-INDEX" });
  });

  it("is idempotent: running it again when the partial index already exists does nothing harmful", async () => {
    await migrateGeneratorTagPartialIndex();
    await migrateGeneratorTagPartialIndex();
    const indexes = await Generator.collection.indexes();
    expect(indexes.filter((i) => i.name === "tag_1")).toHaveLength(1);
  });
});

describe("migrateGasFuelTypeToCng (idempotency re-check)", () => {
  it("returns 0 and changes nothing when no generator has fuelType 'gas'", async () => {
    await Generator.create({ tag: "NO-GAS", name: "Diesel one", fuelType: "diesel" });
    const modified = await migrateGasFuelTypeToCng();
    expect(modified).toBe(0);
  });
});
