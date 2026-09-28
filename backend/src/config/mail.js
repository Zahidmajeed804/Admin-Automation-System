import nodemailer from "nodemailer";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * The one nodemailer transporter for the app. With SMTP_HOST unset (the
 * default until real credentials are added to .env), this falls back to
 * nodemailer's built-in jsonTransport: it builds the message, "sends" it
 * instantly and successfully, but never actually delivers anything — so the
 * app and its reminder job work end to end in development without a real
 * mailbox. mailer.js logs which mode is active on every send.
 */
function createTransport() {
  if (!env.smtpHost) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
}

export const mailTransport = createTransport();

export const isRealMailTransport = Boolean(env.smtpHost);

if (!isRealMailTransport) {
  logger.info("Mail: no SMTP_HOST configured, using jsonTransport (messages are built but not sent).");
}
