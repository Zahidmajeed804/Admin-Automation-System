import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { registerJob, startScheduler } from "./jobs/scheduler.js";
import { runMaintenanceReminderJob } from "./jobs/maintenanceReminderJob.js";
import { setServers } from "node:dns/promises";
setServers(["1.1.1.1", "8.8.8.8"]);

async function start() {
  await connectDatabase();

  if (env.emailRemindersEnabled) {
    registerJob("maintenance-reminders", env.reminderCronSchedule, runMaintenanceReminderJob);
    startScheduler();
  } else {
    logger.info("Email reminders disabled (EMAIL_REMINDERS_ENABLED=false); no jobs scheduled.");
  }

  const server = app.listen(env.port, () => {
    logger.info(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
    logger.info(`API base: http://localhost:${env.port}/api/${env.apiVersion}`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
