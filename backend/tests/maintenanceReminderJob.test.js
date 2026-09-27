import { jest } from "@jest/globals";
import { GeneratorMaintenance } from "../src/models/index.js";
import { runMaintenanceReminderJob } from "../src/jobs/maintenanceReminderJob.js";
import { mailer } from "../src/utils/mailer.js";
import { getMaintenanceReminderRecipients } from "../src/services/notificationRecipients.js";
import { buildMaintenanceReminderEmail } from "../src/utils/emailTemplates/maintenanceReminder.js";
import { createGenerator, makeUsers, inDays } from "./helpers/generatorTestUtils.js";

// The mailer is the one thing every test here mocks: no real network I/O
// (or even the jsonTransport fallback) should happen in the suite, and
// mocking it is what lets these tests assert exactly who was emailed and
// when, without depending on nodemailer's own behavior.
afterEach(() => jest.restoreAllMocks());

async function scheduleJob(generator, overrides = {}) {
  return GeneratorMaintenance.create({
    generator: generator._id,
    description: "Service",
    status: "scheduled",
    scheduledDate: inDays(0),
    ...overrides,
  });
}

describe("runMaintenanceReminderJob", () => {
  it("emails nobody and sends nothing when there are no open alerts", async () => {
    const sendMail = jest.spyOn(mailer, "sendMail");
    const result = await runMaintenanceReminderJob();
    expect(result).toEqual({ sent: false, reason: "nothing-new", overdue: 0, upcoming: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not send, and does not mark anything notified, when nobody holds generator.update", async () => {
    const sendMail = jest.spyOn(mailer, "sendMail");
    const generator = await createGenerator();
    const job = await scheduleJob(generator, { scheduledDate: inDays(-5) });

    const result = await runMaintenanceReminderJob();

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("no-recipients");
    expect(sendMail).not.toHaveBeenCalled();
    const reloaded = await GeneratorMaintenance.findById(job._id);
    expect(reloaded.notifiedStatus).toBeUndefined();
  });

  it("emails every user holding generator.update (manager and admin, not staff) and marks the jobs notified", async () => {
    const { admin, manager, staff } = await makeUsers();
    const sendMail = jest.spyOn(mailer, "sendMail").mockResolvedValue({ messageId: "1" });
    const generator = await createGenerator();
    const overdueJob = await scheduleJob(generator, { scheduledDate: inDays(-3) });
    const upcomingJob = await scheduleJob(generator, { scheduledDate: inDays(3), alertThresholdDays: 7 });

    const result = await runMaintenanceReminderJob();

    expect(result).toMatchObject({ sent: true, recipients: 2, overdue: 1, upcoming: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const [{ to, subject }] = sendMail.mock.calls[0];
    expect(to).toEqual(expect.arrayContaining([admin.user.email, manager.user.email]));
    expect(to).not.toEqual(expect.arrayContaining([staff.user.email]));
    expect(subject).toBe("Generator maintenance alert: 1 overdue, 1 upcoming");

    const reloadedOverdue = await GeneratorMaintenance.findById(overdueJob._id);
    expect(reloadedOverdue.notifiedStatus).toBe("overdue");
    expect(reloadedOverdue.notifiedAt).toBeInstanceOf(Date);
    const reloadedUpcoming = await GeneratorMaintenance.findById(upcomingJob._id);
    expect(reloadedUpcoming.notifiedStatus).toBe("upcoming");
  });

  it("does not re-notify the next run when nothing about the alert has changed", async () => {
    await makeUsers();
    const sendMail = jest.spyOn(mailer, "sendMail").mockResolvedValue({ messageId: "1" });
    const generator = await createGenerator();
    await scheduleJob(generator, { scheduledDate: inDays(-3) });

    await runMaintenanceReminderJob();
    expect(sendMail).toHaveBeenCalledTimes(1);

    const second = await runMaintenanceReminderJob();
    expect(second).toEqual({ sent: false, reason: "nothing-new", overdue: 0, upcoming: 0 });
    expect(sendMail).toHaveBeenCalledTimes(1); // still just the once
  });

  it("re-notifies only the job whose alert escalated from upcoming to overdue", async () => {
    await makeUsers();
    const sendMail = jest.spyOn(mailer, "sendMail").mockResolvedValue({ messageId: "1" });
    const generator = await createGenerator();
    const stableJob = await scheduleJob(generator, { scheduledDate: inDays(-3) });
    const escalatingJob = await scheduleJob(generator, { scheduledDate: inDays(3), alertThresholdDays: 7 });

    await runMaintenanceReminderJob();
    expect(sendMail).toHaveBeenCalledTimes(1);

    await GeneratorMaintenance.findByIdAndUpdate(escalatingJob._id, { scheduledDate: inDays(-1) });
    const second = await runMaintenanceReminderJob();

    expect(second).toMatchObject({ sent: true, overdue: 1, upcoming: 0 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    const reloadedEscalated = await GeneratorMaintenance.findById(escalatingJob._id);
    expect(reloadedEscalated.notifiedStatus).toBe("overdue");
    const reloadedStable = await GeneratorMaintenance.findById(stableJob._id);
    expect(reloadedStable.notifiedStatus).toBe("overdue"); // unchanged from the first run
  });

  it("does not mark a job notified when the send fails, so it is retried on the next run", async () => {
    await makeUsers();
    const sendMail = jest.spyOn(mailer, "sendMail").mockRejectedValue(new Error("smtp down"));
    const generator = await createGenerator();
    const job = await scheduleJob(generator, { scheduledDate: inDays(-3) });

    await expect(runMaintenanceReminderJob()).rejects.toThrow("smtp down");

    const reloaded = await GeneratorMaintenance.findById(job._id);
    expect(reloaded.notifiedStatus).toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("leaves out jobs belonging to a soft-deleted generator", async () => {
    await makeUsers();
    const sendMail = jest.spyOn(mailer, "sendMail").mockResolvedValue({ messageId: "1" });
    const generator = await createGenerator({ isActive: false });
    await scheduleJob(generator, { scheduledDate: inDays(-3) });

    const result = await runMaintenanceReminderJob();
    expect(result).toEqual({ sent: false, reason: "nothing-new", overdue: 0, upcoming: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("getMaintenanceReminderRecipients", () => {
  it("returns only active users holding generator.update", async () => {
    const { admin, manager, staff } = await makeUsers();
    const recipients = await getMaintenanceReminderRecipients();
    expect(recipients).toEqual(expect.arrayContaining([admin.user.email, manager.user.email]));
    expect(recipients).not.toEqual(expect.arrayContaining([staff.user.email]));
  });
});

describe("buildMaintenanceReminderEmail", () => {
  it("returns null when there is nothing to report", () => {
    expect(buildMaintenanceReminderEmail({ overdue: [], upcoming: [] })).toBeNull();
  });

  it("builds a subject and body naming the counts and jobs", () => {
    const email = buildMaintenanceReminderEmail({
      overdue: [{ generator: { tag: "GEN-01", name: "Main" }, description: "Oil change", scheduledDate: new Date(), daysUntilDue: -2 }],
      upcoming: [],
    });
    expect(email.subject).toBe("Generator maintenance alert: 1 overdue");
    expect(email.html).toContain("GEN-01");
    expect(email.text).toContain("Oil change");
  });
});
