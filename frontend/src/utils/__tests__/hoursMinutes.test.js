import { toHoursMinutes, fromHoursMinutes, formatHoursMinutes } from "../hoursMinutes";

describe("toHoursMinutes", () => {
  it("splits a whole-hours decimal", () => {
    expect(toHoursMinutes(4)).toEqual({ h: "4", m: "0" });
  });

  it("splits 20 minutes (0.333... hours) to exactly 20, not 19 or 21 from float noise", () => {
    expect(toHoursMinutes(20 / 60)).toEqual({ h: "0", m: "20" });
  });

  it("splits a mixed value", () => {
    expect(toHoursMinutes(12.5)).toEqual({ h: "12", m: "30" });
  });

  it("keeps the sign on hours for a negative value", () => {
    expect(toHoursMinutes(-2.5)).toEqual({ h: "-2", m: "30" });
  });

  it("returns blanks for '', null and undefined", () => {
    expect(toHoursMinutes("")).toEqual({ h: "", m: "" });
    expect(toHoursMinutes(null)).toEqual({ h: "", m: "" });
    expect(toHoursMinutes(undefined)).toEqual({ h: "", m: "" });
  });
});

describe("fromHoursMinutes", () => {
  it("combines hours and minutes into a decimal-hours string", () => {
    expect(fromHoursMinutes({ h: "12", m: "30" })).toBe("12.5");
  });

  it("round-trips 20 minutes exactly through toHoursMinutes", () => {
    const decimal = Number(fromHoursMinutes({ h: "0", m: "20" }));
    expect(toHoursMinutes(decimal)).toEqual({ h: "0", m: "20" });
  });

  it("treats a blank sub-field as 0", () => {
    expect(fromHoursMinutes({ h: "4", m: "" })).toBe("4");
    expect(fromHoursMinutes({ h: "", m: "30" })).toBe("0.5");
  });

  it("returns '' when both are blank", () => {
    expect(fromHoursMinutes({ h: "", m: "" })).toBe("");
  });

  it("applies a negative hours sign to the combined value", () => {
    expect(fromHoursMinutes({ h: "-2", m: "30" })).toBe("-2.5");
  });
});

describe("formatHoursMinutes", () => {
  it("formats whole hours", () => {
    expect(formatHoursMinutes(4)).toBe("4h 0m");
  });

  it("formats 20 minutes without rounding away", () => {
    expect(formatHoursMinutes(20 / 60)).toBe("0h 20m");
  });

  it("formats a negative value with the sign out front", () => {
    expect(formatHoursMinutes(-2.5)).toBe("-2h 30m");
  });

  it("shows an em dash for blank/invalid input", () => {
    expect(formatHoursMinutes("")).toBe("—");
    expect(formatHoursMinutes(null)).toBe("—");
    expect(formatHoursMinutes(undefined)).toBe("—");
  });
});
