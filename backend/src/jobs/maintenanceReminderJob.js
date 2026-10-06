import { generatorService } from "../services/generatorService.js";
import { generatorMaintenanceRepository } from "../repositories/generatorMaintenanceRepository.js";
import { getMaintenanceReminderRecipients } from "../services/notificationRecipients.js";
import { buildMaintenanceReminderEmail } from "../utils/emailTemplates/maintenanceReminder.js";
import { mailer } from "../utils/mailer.js";
import { logger } from "../utils/logger.js";

// Only a job whose alert has actually changed since the last reminder is
// worth emailing about again (see the notifiedStatus comment on the model).
const isFreshAlert = (job) => job.notifiedStatus !== job.alertStatus;

/**
 * The daily maintenance reminder: find what's overdue/upcoming, skip
 * anything already reminded about at its current alert level, email
 * whoever holds generator.update about the rest, and only then record that
 * they were notified — so a failed send (or nobody to send to) is retried
 * on the next run instead of being silently dropped.
 */
export async function runMaintenanceReminderJob(now = new Date()) {
  const { overdue, upcoming } = await generatorService.getMaintenanceAlerts({ now });

  const freshOverdue = overdue.filter(isFreshAlert);
  const freshUpcoming = upcoming.filter(isFreshAlert);

  const email = buildMaintenanceReminderEmail({ overdue: freshOverdue, upcoming: freshUpcoming });
  if (!email) {
    logger.info("Maintenance reminder job: nothing new to notify.");
    return { sent: false, reason: "nothing-new", overdue: 0, upcoming: 0 };
  }

  const recipients = await getMaintenanceReminderRecipients();
  if (!recipients.length) {
    logger.warn("Maintenance reminder job: no recipients hold generator.update; nothing sent.");
    return { sent: false, reason: "no-recipients", overdue: freshOverdue.length, upcoming: freshUpcoming.length };
  }

  await mailer.sendMail({ to: recipients, subject: email.subject, html: email.html, text: email.text });

  await generatorMaintenanceRepository.markNotified(
    [
      ...freshOverdue.map((j) => ({ id: j._id, status: "overdue" })),
      ...freshUpcoming.map((j) => ({ id: j._id, status: "upcoming" })),
    ],
    now
  );

  return {
    sent: true,
    recipients: recipients.length,
    overdue: freshOverdue.length,
    upcoming: freshUpcoming.length,
  };
}
