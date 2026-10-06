import { describe, it, expect } from "vitest";
import { computeFuelFigures, closingExceedsAvailable, GAUGE_MARKS, gaugeToLiters } from "../fuelFigures";

describe("computeFuelFigures", () => {
  it("derives consumption from both readings and cost from price x added", () => {
    expect(computeFuelFigures({ openingFuelLiters: 100, closingFuelLiters: 120, fuelAddedLiters: 50, fuelCostPerLiter: 285.5 })).toEqual({
      fuelConsumedLiters: 30,
      fuelCostTotal: 14275,
    });
  });

  it("derives nothing when readings are missing", () => {
    expect(computeFuelFigures({ fuelAddedLiters: 10 })).toEqual({});
  });
});

describe("closingExceedsAvailable", () => {
  it("is true when closing exceeds opening + added", () => {
    expect(closingExceedsAvailable({ openingFuelLiters: 100, fuelAddedLiters: 10, closingFuelLiters: 111 })).toBe(true);
  });

  it("is false when either reading is missing", () => {
    expect(closingExceedsAvailable({ closingFuelLiters: 111 })).toBe(false);
  });
});

describe("GAUGE_MARKS", () => {
  it("has the five quarter marks in ascending order", () => {
    expect(GAUGE_MARKS.map((m) => m.value)).toEqual(["E", "1/4", "1/2", "3/4", "F"]);
    expect(GAUGE_MARKS.map((m) => m.fraction)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe("gaugeToLiters", () => {
  it("converts a mark to an amount using the tank capacity", () => {
    expect(gaugeToLiters("1/2", 200)).toBe(100);
    expect(gaugeToLiters("3/4", 200)).toBe(150);
    expect(gaugeToLiters("E", 200)).toBe(0);
    expect(gaugeToLiters("F", 200)).toBe(200);
  });

  it("rounds to 2 decimals", () => {
    expect(gaugeToLiters("1/4", 333)).toBe(83.25);
  });

  it("returns null for an unknown mark", () => {
    expect(gaugeToLiters("half", 200)).toBeNull();
  });

  it("returns null when there is no positive capacity", () => {
    expect(gaugeToLiters("1/2", 0)).toBeNull();
    expect(gaugeToLiters("1/2", undefined)).toBeNull();
    expect(gaugeToLiters("1/2", -5)).toBeNull();
  });
});
