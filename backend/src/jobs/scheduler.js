import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * A tiny, generic wrapper around node-cron. Individual jobs (e.g. the
 * maintenance reminder job, AAS-348) register themselves here by name;
 * nothing is actually scheduled until startScheduler() runs, which
 * server.js calls once at boot. Kept separate from server.js so jest can
 * import job modules without ever starting a real interval, and separate
 * from any one job so a second scheduled job later doesn't need its own
 * plumbing.
 */
const registry = [];

export function registerJob(name, cronExpression, handler) {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression for job "${name}": ${cronExpression}`);
  }
  registry.push({ name, cronExpression, handler });
}

export function startScheduler() {
  for (const { name, cronExpression, handler } of registry) {
    cron.schedule(cronExpression, async () => {
      logger.info(`Job "${name}" starting.`);
      try {
        await handler();
        logger.info(`Job "${name}" finished.`);
      } catch (err) {
        logger.error(`Job "${name}" failed: ${err.message}`);
      }
    });
    logger.info(`Job "${name}" scheduled (${cronExpression}).`);
  }
}

// Test-only: lets jobs/scheduler.test.js inspect what registered without
// reaching into module-private state, and lets tests reset between runs.
export function _resetRegistryForTests() {
  registry.length = 0;
}
export function _getRegistryForTests() {
  return registry;
}

export const emailRemindersEnabled = env.emailRemindersEnabled;
