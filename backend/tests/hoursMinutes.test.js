import { roundToMinute, formatHoursMinutes } from "../src/utils/hoursMinutes.js";

describe("roundToMinute", () => {
  it("rounds 20 minutes (0.333... hours) to exactly 1/3, not a 2-decimal truncation", () => {
    expect(roundToMinute(20 / 60)).toBeCloseTo(1 / 3, 10);
  });

  it("leaves a whole-minute value unchanged", () => {
    expect(roundToMinute(1.5)).toBe(1.5);
  });

  it("rounds a fractional-minute value to the nearest minute", () => {
    expect(roundToMinute(1.5083)).toBeCloseTo(1.5, 10); // 1h 30.5m -> nearest minute is 1h 30m or 31m
  });
});

describe("formatHoursMinutes", () => {
  it("formats whole hours", () => {
    expect(formatHoursMinutes(4)).toBe("4h 0m");
  });

  it("formats 20 minutes exactly, not rounded away", () => {
    expect(formatHoursMinutes(20 / 60)).toBe("0h 20m");
  });

  it("formats a mixed value", () => {
    expect(formatHoursMinutes(12.5)).toBe("12h 30m");
  });

  it("formats a negative value with the sign out front", () => {
    expect(formatHoursMinutes(-2.5)).toBe("-2h 30m");
  });

  it("returns null for null/undefined/NaN", () => {
    expect(formatHoursMinutes(null)).toBeNull();
    expect(formatHoursMinutes(undefined)).toBeNull();
    expect(formatHoursMinutes(NaN)).toBeNull();
  });

  it("rounds fractional-minute noise up to the nearest minute", () => {
    expect(formatHoursMinutes(0.999999)).toBe("1h 0m");
  });
});
