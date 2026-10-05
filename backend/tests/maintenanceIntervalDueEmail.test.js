import { buildMaintenanceIntervalDueEmail } from "../src/utils/emailTemplates/maintenanceIntervalDue.js";

describe("buildMaintenanceIntervalDueEmail", () => {
  it("formats hours since reset and the interval as 'Xh Ym', not raw decimals", () => {
    const email = buildMaintenanceIntervalDueEmail({
      tag: "GEN-01",
      name: "Main Hall",
      runningHoursTotal: 110.5,
      hoursAtLastMaintenanceReset: 10,
      maintenanceIntervalHours: 100,
    });
    expect(email.subject).toBe("Generator maintenance due: GEN-01 — Main Hall");
    expect(email.text).toContain("100h 30m since its last service");
    expect(email.text).toContain("reaching its 100h 0m maintenance interval");
    expect(email.html).toContain("100h 30m");
    expect(email.html).toContain("100h 0m");
  });

  it("defaults hoursAtLastMaintenanceReset to 0 when unset", () => {
    const email = buildMaintenanceIntervalDueEmail({
      tag: "GEN-02",
      runningHoursTotal: 20,
      maintenanceIntervalHours: 20,
    });
    expect(email.text).toContain("20h 0m since its last service");
  });
});
