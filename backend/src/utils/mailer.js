import { mailTransport, isRealMailTransport } from "../config/mail.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

// An object (not a bare named export), like the repositories, so tests can
// jest.spyOn(mailer, "sendMail") instead of needing jest.unstable_mockModule.
export const mailer = {
  /**
   * Send one email through the app's single transport (config/mail.js).
   * `to` accepts a string or an array of addresses. Throws on failure — the
   * caller (e.g. the reminder job) decides what "failed to send" means for
   * it, such as not marking a job as notified so it's retried next run.
   */
  async sendMail({ to, subject, html, text }) {
    const recipients = Array.isArray(to) ? to.join(", ") : to;
    if (!recipients) throw new Error("sendMail requires at least one recipient");
    if (!subject) throw new Error("sendMail requires a subject");
    if (!html && !text) throw new Error("sendMail requires html or text content");

    const info = await mailTransport.sendMail({
      from: env.mailFrom,
      to: recipients,
      subject,
      html,
      text,
    });

    if (isRealMailTransport) {
      logger.info(`Mail sent to ${recipients}: "${subject}" (${info.messageId})`);
    } else {
      logger.info(`Mail built (not sent, no SMTP configured) to ${recipients}: "${subject}"`);
    }

    return info;
  },
};
