import dotenv from "dotenv";

dotenv.config();

// Single place that reads process.env. Every other file imports `env`
// instead of touching process.env directly.
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  apiVersion: process.env.API_VERSION || "v1",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/admin_automation_system",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // Worked minutes per day above which the excess becomes overtime (SRS: 10 hours).
  overtimeThresholdMinutes: Number(process.env.OVERTIME_THRESHOLD_MINUTES) || 600,
  // Maintenance invoices: where uploaded files live on disk, and the size cap in MB.
  invoiceUploadDir: process.env.INVOICE_UPLOAD_DIR || "uploads/invoices",
  invoiceMaxSizeMb: Number(process.env.INVOICE_MAX_SIZE_MB) || 5,

  // Outgoing mail. With no SMTP_HOST set, mailer.js falls back to nodemailer's
  // jsonTransport (builds the message but never sends it) so the app runs
  // without real credentials; set these to actually deliver mail.
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || "Admin Automation System <no-reply@example.com>",

  // Maintenance reminder emails: whether the daily job is scheduled at all,
  // and when. Standard 5-field cron syntax, read by node-cron.
  emailRemindersEnabled: process.env.EMAIL_REMINDERS_ENABLED !== "false",
  reminderCronSchedule: process.env.REMINDER_CRON_SCHEDULE || "0 7 * * *", // 07:00 server time, daily
};

export const isProduction = env.nodeEnv === "production";
