import { generatorRepository } from "../repositories/generatorRepository.js";
import { generatorLogRepository } from "../repositories/generatorLogRepository.js";
import { generatorMaintenanceRepository } from "../repositories/generatorMaintenanceRepository.js";
import { NotFoundError, ConflictError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ALERT_THRESHOLD_DAYS = 7;

// Whole UTC days since the epoch — lets us compare calendar days rather
// than instants, so a job due "today" isn't called overdue at 10am.
const utcDay = (d) => Math.floor(new Date(d).getTime() / MS_PER_DAY);

const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Builds the update that puts `keys` back to what `original` had: fields it
// had are $set again, fields it didn't have are $unset.
function restoreUpdate(original, keys) {
  const $set = {};
  const $unset = {};
  keys.forEach((k) => (original[k] === undefined ? ($unset[k] = 1) : ($set[k] = original[k])));
  return {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
}

async function findActiveGenerator(id) {
  const generator = await generatorRepository.findById(id);
  if (!generator || !generator.isActive) throw new NotFoundError("Generator not found");
  return generator;
}

/** Whole days from `now` until the due date: 0 = today, negative = overdue. */
export function daysUntilDue(scheduledDate, now = new Date()) {
  return utcDay(scheduledDate) - utcDay(now);
}

/**
 * Pure function: what should we tell the user about this maintenance record
 * today? Nothing is stored — the answer depends on the date, so it is
 * computed on read.
 *
 *   completed / cancelled -> returned as-is (not an alert)
 *   overdue   -> due date is before today
 *   upcoming  -> due today, or within alertThresholdDays days from today
 *   scheduled -> further out than the threshold
 */
export function computeAlertStatus(maintenance, now = new Date()) {
  if (maintenance.status !== "scheduled") return maintenance.status;

  const threshold = maintenance.alertThresholdDays ?? DEFAULT_ALERT_THRESHOLD_DAYS;
  const days = daysUntilDue(maintenance.scheduledDate, now);

  if (days < 0) return "overdue";
  if (days <= threshold) return "upcoming";
  return "scheduled";
}

/** A plain-object copy of a maintenance record with its computed alert fields attached. */
export function withAlertInfo(maintenance, now = new Date()) {
  const plain = typeof maintenance.toObject === "function" ? maintenance.toObject() : { ...maintenance };
  return {
    ...plain,
    alertStatus: computeAlertStatus(plain, now),
    daysUntilDue: daysUntilDue(plain.scheduledDate, now),
  };
}

export const generatorService = {
  computeAlertStatus,

  /**
   * Records a usage/fuel log and adds its hoursRun to the generator's
   * runningHoursTotal. The increment itself is atomic ($inc); the two
   * writes are not a transaction, so if the increment fails the log is
   * removed again to keep the total and the log history consistent.
   */
  async recordLog({ generatorId, recordedBy, ...fields }) {
    await findActiveGenerator(generatorId);

    const log = await generatorLogRepository.create({ ...fields, generator: generatorId, recordedBy });

    let generator;
    try {
      generator = await generatorRepository.incrementRunningHours(generatorId, log.hoursRun);
    } catch (err) {
      await generatorLogRepository.deleteById(log._id);
      throw err;
    }

    return { log, generator };
  },

  /**
   * Deletes a log and subtracts its hoursRun from the generator's total —
   * the reverse of recordLog, so removing a mistaken entry doesn't leave
   * runningHoursTotal overstated.
   */
  async removeLog(logId) {
    const log = await generatorLogRepository.deleteById(logId);
    if (!log) throw new NotFoundError("Log entry not found");

    const generator = await generatorRepository.incrementRunningHours(log.generator, -log.hoursRun);
    return { log, generator };
  },

  /**
   * Schedules a new maintenance job for an existing, active generator. A new
   * job is always "scheduled" — status and completedDate can't be supplied
   * here, because finishing a job goes through completeMaintenance (which
   * keeps lastServiceDate and recurrence right).
   */
  async scheduleMaintenance({ generatorId, createdBy, ...fields }) {
    await findActiveGenerator(generatorId);
    return generatorMaintenanceRepository.create({ ...withoutUndefined(fields), generator: generatorId, createdBy });
  },

  /**
   * Edits or cancels a maintenance job. Only jobs that are still "scheduled"
   * can change — completed and cancelled jobs are history. The check is the
   * atomic updateIfScheduled, so it also holds against a concurrent
   * completion. (Completing is a separate operation: completeMaintenance.)
   */
  async updateMaintenance(maintenanceId, changes) {
    const updated = await generatorMaintenanceRepository.updateIfScheduled(maintenanceId, withoutUndefined(changes));
    if (updated) return updated;

    const exists = await generatorMaintenanceRepository.findById(maintenanceId);
    if (!exists) throw new NotFoundError("Maintenance record not found");
    throw new ConflictError("Only scheduled maintenance can be changed");
  },

  /**
   * Marks a scheduled maintenance record completed, moves the generator's
   * lastServiceDate forward, and — if the record recurs (intervalDays) —
   * schedules the next one intervalDays after the day it was actually done.
   *
   * The status flip is an atomic "only if still scheduled", so a repeated or
   * racing request gets a 409 instead of a duplicate next occurrence. The
   * remaining writes are not a transaction; if one fails, the earlier ones
   * are undone so nothing is left half-completed.
   */
  async completeMaintenance(maintenanceId, { completedDate, performedBy, cost, partsReplaced, notes } = {}) {
    const original = await generatorMaintenanceRepository.findById(maintenanceId);
    if (!original) throw new NotFoundError("Maintenance record not found");

    const when = completedDate ? new Date(completedDate) : new Date();
    const changes = withoutUndefined({ status: "completed", completedDate: when, performedBy, cost, partsReplaced, notes });

    const maintenance = await generatorMaintenanceRepository.updateIfScheduled(maintenanceId, changes);
    if (!maintenance) throw new ConflictError("Only scheduled maintenance can be completed");

    let next = null;
    try {
      if (original.intervalDays) {
        next = await generatorMaintenanceRepository.create({
          generator: original.generator,
          type: original.type,
          description: original.description,
          scheduledDate: new Date(when.getTime() + original.intervalDays * MS_PER_DAY),
          intervalDays: original.intervalDays,
          alertThresholdDays: original.alertThresholdDays,
          createdBy: original.createdBy,
        });
      }
      const generator = await generatorRepository.recordServiceDate(original.generator, when);
      return { maintenance, next, generator };
    } catch (err) {
      try {
        if (next) await generatorMaintenanceRepository.deleteById(next._id);
        await generatorMaintenanceRepository.updateById(maintenanceId, restoreUpdate(original, Object.keys(changes)));
      } catch (undoErr) {
        logger.error(`Could not roll back maintenance ${maintenanceId}: ${undoErr.message}`);
      }
      throw err;
    }
  },

  /**
   * The alerts feed: every open job that is overdue or coming up, split into
   * two lists (most overdue / soonest first). By default each job uses its own
   * alertThresholdDays to decide "upcoming"; passing `withinDays` overrides
   * that for all jobs, to look further (or nearer) ahead. Jobs belonging to
   * soft-deleted generators are left out.
   */
  async getMaintenanceAlerts({ withinDays, now = new Date() } = {}) {
    const open = await generatorMaintenanceRepository.listOpen();
    const overdue = [];
    const upcoming = [];

    for (const record of open) {
      if (!record.generator || !record.generator.isActive) continue;

      const view = withAlertInfo(record, now);
      const status = withinDays === undefined ? view.alertStatus : computeAlertStatus({ ...view, alertThresholdDays: withinDays }, now);
      if (status === "overdue") overdue.push({ ...view, alertStatus: status });
      else if (status === "upcoming") upcoming.push({ ...view, alertStatus: status });
    }

    return { counts: { overdue: overdue.length, upcoming: upcoming.length }, overdue, upcoming };
  },
};
