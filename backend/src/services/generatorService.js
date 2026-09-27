import fs from "node:fs/promises";
import path from "node:path";
import { generatorRepository } from "../repositories/generatorRepository.js";
import { generatorLogRepository } from "../repositories/generatorLogRepository.js";
import { generatorMaintenanceRepository } from "../repositories/generatorMaintenanceRepository.js";
import { invoiceUploadDir } from "../middleware/uploadInvoice.js";
import { NotFoundError, ConflictError, BadRequestError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ALERT_THRESHOLD_DAYS = 7;
const DEFAULT_ALERT_THRESHOLD_HOURS = 25;

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

const invoiceFilePath = (storedName) => path.join(invoiceUploadDir, storedName);

// Best-effort delete: a file that is already gone (ENOENT) counts as success,
// since the end state — no file — is what was wanted either way. Exported so
// that deleting a maintenance job outright (which bypasses removeInvoice) can
// still clean up any invoice it had, without a second copy of this logic.
export async function deleteInvoiceFile(storedName) {
  try {
    await fs.unlink(invoiceFilePath(storedName));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
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
 * Running hours left until due (spec: "alerts after predefined running
 * hours"), or undefined when it can't be worked out — the job doesn't track
 * hours (no intervalHours), it has no starting point yet (no
 * hoursAtScheduling), or the caller doesn't know the generator's current
 * hours. Negative means overdue, mirroring daysUntilDue.
 */
export function hoursUntilDue(maintenance, currentRunningHours) {
  if (!maintenance.intervalHours) return undefined;
  if (maintenance.hoursAtScheduling === undefined || maintenance.hoursAtScheduling === null) return undefined;
  if (typeof currentRunningHours !== "number") return undefined;

  return maintenance.intervalHours - (currentRunningHours - maintenance.hoursAtScheduling);
}

/**
 * Pure function: what should we tell the user about this maintenance record
 * today? Nothing is stored — the answer depends on the date (and, when the
 * job tracks them, the generator's running hours) — so it is computed on read.
 *
 *   completed / cancelled -> returned as-is (not an alert)
 *   overdue   -> the due date has passed, OR the running-hours threshold has
 *   upcoming  -> due date or running hours are within their alert threshold
 *   scheduled -> both are further out than their threshold (or hours can't be worked out)
 *
 * A job can be flagged by date, by hours, by both, or by neither — whichever
 * comes first wins, since either one means the generator is due for service.
 */
export function computeAlertStatus(maintenance, now = new Date(), currentRunningHours) {
  if (maintenance.status !== "scheduled") return maintenance.status;

  const dayThreshold = maintenance.alertThresholdDays ?? DEFAULT_ALERT_THRESHOLD_DAYS;
  const days = daysUntilDue(maintenance.scheduledDate, now);
  const dayStatus = days < 0 ? "overdue" : days <= dayThreshold ? "upcoming" : "scheduled";

  const hours = hoursUntilDue(maintenance, currentRunningHours);
  const hourThreshold = maintenance.alertThresholdHours ?? DEFAULT_ALERT_THRESHOLD_HOURS;
  const hourStatus = hours === undefined ? "scheduled" : hours < 0 ? "overdue" : hours <= hourThreshold ? "upcoming" : "scheduled";

  if (dayStatus === "overdue" || hourStatus === "overdue") return "overdue";
  if (dayStatus === "upcoming" || hourStatus === "upcoming") return "upcoming";
  return "scheduled";
}

/**
 * A plain-object copy of a maintenance record with its computed alert fields
 * attached. `currentRunningHours` is the owning generator's running-hours
 * total; omit it (or pass a generator the job's hours can't be checked
 * against) and the hours side of the alert simply has no effect.
 */
export function withAlertInfo(maintenance, now = new Date(), currentRunningHours) {
  const plain = typeof maintenance.toObject === "function" ? maintenance.toObject() : { ...maintenance };
  return {
    ...plain,
    alertStatus: computeAlertStatus(plain, now, currentRunningHours),
    daysUntilDue: daysUntilDue(plain.scheduledDate, now),
    hoursUntilDue: hoursUntilDue(plain, currentRunningHours),
  };
}

const isGiven = (v) => v !== undefined && v !== null && v !== "";
// Money and litres are kept to 2 decimals so float noise (0.1 + 0.2) never reaches the database.
const round2 = (n) => Math.max(0, Math.round(n * 100) / 100);

/**
 * Pure function: the fuel figures we work out ourselves instead of trusting
 * the client. Returns only the fields it can derive.
 *
 *   fuelConsumedLiters = opening + added - closing   (needs both readings)
 *   fuelCostTotal      = added x price per litre     (needs a price and litres added)
 */
export function computeFuelFigures({ openingFuelLiters, closingFuelLiters, fuelAddedLiters, fuelCostPerLiter } = {}) {
  const derived = {};
  const added = Number(fuelAddedLiters) || 0;

  if (isGiven(openingFuelLiters) && isGiven(closingFuelLiters)) {
    derived.fuelConsumedLiters = round2(Number(openingFuelLiters) + added - Number(closingFuelLiters));
  }
  if (isGiven(fuelCostPerLiter) && added > 0) {
    derived.fuelCostTotal = round2(added * Number(fuelCostPerLiter));
  }
  return derived;
}

export const generatorService = {
  computeAlertStatus,
  computeFuelFigures,
  deleteInvoiceFile,

  /**
   * Records a usage/fuel log and adds its hoursRun to the generator's
   * runningHoursTotal. The increment itself is atomic ($inc); the two
   * writes are not a transaction, so if the increment fails the log is
   * removed again to keep the total and the log history consistent.
   * Fuel consumed and fuel cost are derived here (see computeFuelFigures)
   * and override anything the client sent for them.
   */
  async recordLog({ generatorId, recordedBy, ...fields }) {
    await findActiveGenerator(generatorId);

    const log = await generatorLogRepository.create({
      ...fields,
      ...computeFuelFigures(fields),
      generator: generatorId,
      recordedBy,
    });

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
   * Permanently deletes a generator together with all of its log entries and
   * maintenance records, so nothing is left behind and its tag can be used
   * again. The related records go first and the generator last: these are
   * separate writes, not a transaction, so if one fails part-way the
   * generator is still there and the delete can simply be repeated.
   */
  async removeGenerator(id) {
    const generator = await findActiveGenerator(id);

    const logs = await generatorLogRepository.deleteByGenerator(id);
    const maintenance = await generatorMaintenanceRepository.deleteByGenerator(id);
    await generatorRepository.deleteById(id);

    return { generator, deleted: { logs: logs.deletedCount, maintenance: maintenance.deletedCount } };
  },

  /**
   * Corrects an existing log entry. `changes` holds only the fields to change;
   * an optional field sent as null is cleared. The generator and who recorded
   * the entry cannot be changed. Consumption and cost are recalculated from the
   * result (see computeFuelFigures), and if hoursRun changes the difference is
   * applied to the generator's running-hours total. Entries recorded after this
   * one are not recalculated.
   */
  async updateLog(logId, changes) {
    const existing = await generatorLogRepository.findById(logId);
    if (!existing) throw new NotFoundError("Log entry not found");
    const before = existing.toObject();

    // The entry as it will look afterwards, so the rules below judge the whole
    // entry and not just the fields that happen to be in this request.
    const merged = { ...before };
    const $set = {};
    const $unset = {};
    for (const [key, value] of Object.entries(withoutUndefined(changes))) {
      if (value === null) {
        delete merged[key];
        $unset[key] = 1;
      } else {
        merged[key] = value;
        $set[key] = value;
      }
    }

    const opening = isGiven(merged.openingFuelLiters) ? Number(merged.openingFuelLiters) : null;
    const closing = isGiven(merged.closingFuelLiters) ? Number(merged.closingFuelLiters) : null;
    const added = Number(merged.fuelAddedLiters) || 0;
    if (opening !== null && closing !== null && closing > opening + added) {
      throw new BadRequestError("Validation failed", [
        { field: "closingFuelLiters", message: "closingFuelLiters cannot exceed openingFuelLiters plus fuelAddedLiters" },
      ]);
    }
    if (isGiven(merged.fuelCostPerLiter) && !(added > 0)) {
      throw new BadRequestError("Validation failed", [
        { field: "fuelCostPerLiter", message: "fuelCostPerLiter needs fuelAddedLiters greater than 0" },
      ]);
    }

    // Derived figures win over anything sent; and figures that were derived
    // before but no longer can be must not be left behind, stale.
    const derived = computeFuelFigures(merged);
    for (const [key, value] of Object.entries(derived)) {
      $set[key] = value;
      delete $unset[key];
    }
    const hadReadings = before.openingFuelLiters != null && before.closingFuelLiters != null;
    if (hadReadings && derived.fuelConsumedLiters === undefined && changes.fuelConsumedLiters === undefined) {
      $set.fuelConsumedLiters = 0;
    }
    const hadCostRule = before.fuelCostPerLiter != null && before.fuelAddedLiters > 0;
    if (hadCostRule && derived.fuelCostTotal === undefined && changes.fuelCostTotal === undefined) {
      $unset.fuelCostTotal = 1;
    }

    const update = {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
    };
    if (!Object.keys(update).length) {
      return { log: existing, generator: await generatorRepository.findById(before.generator) };
    }

    // Signed (a correction can lower the hours), so not round2, which never goes below 0.
    const hoursDelta = changes.hoursRun !== undefined ? Math.round((Number(changes.hoursRun) - before.hoursRun) * 100) / 100 : 0;
    let generator = null;
    if (hoursDelta !== 0) generator = await generatorRepository.incrementRunningHours(before.generator, hoursDelta);

    let log;
    try {
      log = await generatorLogRepository.updateById(logId, update);
      if (!log) throw new NotFoundError("Log entry not found");
    } catch (err) {
      // The two writes are not a transaction: put the hours back if the log did not change.
      if (hoursDelta !== 0) await generatorRepository.incrementRunningHours(before.generator, -hoursDelta);
      throw err;
    }

    generator ??= await generatorRepository.findById(before.generator);
    return { log, generator };
  },

  /**
   * Schedules a new maintenance job for an existing, active generator. A new
   * job is always "scheduled" — status and completedDate can't be supplied
   * here, because finishing a job goes through completeMaintenance (which
   * keeps lastServiceDate and recurrence right).
   */
  async scheduleMaintenance({ generatorId, createdBy, ...fields }) {
    const generator = await findActiveGenerator(generatorId);

    const allowed = withoutUndefined(fields);
    delete allowed.status; // a new job is always "scheduled"…
    delete allowed.completedDate; // …and cannot arrive already completed

    // hoursAtScheduling only means something alongside intervalHours; when
    // that's given without an explicit starting point, count from the
    // generator's current running hours.
    if (allowed.intervalHours !== undefined && allowed.hoursAtScheduling === undefined) {
      allowed.hoursAtScheduling = generator.runningHoursTotal;
    }

    return generatorMaintenanceRepository.create({ ...allowed, generator: generatorId, createdBy });
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
   * A job that only tracks running hours (intervalHours, no intervalDays)
   * does NOT get an automatic next occurrence: scheduledDate is required on
   * every job, and there is no calendar date to derive from hours alone, so
   * a follow-up would have to be scheduled by hand.
   *
   * hoursAtService defaults to the generator's current runningHoursTotal when
   * not given; a client-supplied value (including 0) always wins. When the
   * job recurs and also tracks hours, the next occurrence's hour-based clock
   * (hoursAtScheduling) starts from this job's own resolved hoursAtService.
   *
   * The status flip is an atomic "only if still scheduled", so a repeated or
   * racing request gets a 409 instead of a duplicate next occurrence. The
   * remaining writes are not a transaction; if one fails, the earlier ones
   * are undone so nothing is left half-completed.
   */
  async completeMaintenance(maintenanceId, { completedDate, performedBy, vendor, cost, partsReplaced, notes, hoursAtService } = {}) {
    const original = await generatorMaintenanceRepository.findById(maintenanceId);
    if (!original) throw new NotFoundError("Maintenance record not found");

    const when = completedDate ? new Date(completedDate) : new Date();
    // hoursAtService defaults to the generator's current running-hours total,
    // but an explicit value (e.g. the service actually happened earlier) wins.
    if (hoursAtService === undefined) {
      const generator = await generatorRepository.findById(original.generator);
      hoursAtService = generator?.runningHoursTotal;
    }
    const changes = withoutUndefined({ status: "completed", completedDate: when, performedBy, vendor, cost, partsReplaced, notes, hoursAtService });

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
          intervalHours: original.intervalHours,
          alertThresholdHours: original.alertThresholdHours,
          // Its hour-based clock starts from this job's own resolved
          // hoursAtService, only when this line of recurrence tracks hours.
          hoursAtScheduling: original.intervalHours ? hoursAtService : undefined,
          vendor: original.vendor, // the same vendor usually does the recurring job again
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

      const currentRunningHours = record.generator.runningHoursTotal;
      const view = withAlertInfo(record, now, currentRunningHours);
      const status = withinDays === undefined ? view.alertStatus : computeAlertStatus({ ...view, alertThresholdDays: withinDays }, now, currentRunningHours);
      if (status === "overdue") overdue.push({ ...view, alertStatus: status });
      else if (status === "upcoming") upcoming.push({ ...view, alertStatus: status });
    }

    return { counts: { overdue: overdue.length, upcoming: upcoming.length }, overdue, upcoming };
  },

  /**
   * Attaches an invoice to a job, or replaces the one it already has. `file`
   * is multer's req.file — already saved to disk under invoiceUploadDir by
   * the time this runs. The database write is what actually decides whether
   * the upload "took"; the old file (if any) is only removed once the new
   * metadata is safely stored, and the new file is cleaned up if it isn't.
   */
  async attachInvoice(maintenanceId, { file, uploadedBy }) {
    const existing = await generatorMaintenanceRepository.findById(maintenanceId);
    if (!existing) {
      await deleteInvoiceFile(file.filename);
      throw new NotFoundError("Maintenance record not found");
    }

    const previousInvoice = existing.invoice;
    let updated;
    try {
      updated = await generatorMaintenanceRepository.updateById(maintenanceId, {
        invoice: {
          fileName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy,
        },
      });
    } catch (err) {
      await deleteInvoiceFile(file.filename).catch(() => {}); // the just-uploaded file is now orphaned
      throw err;
    }

    if (!updated) {
      // The record was removed between the two lookups above.
      await deleteInvoiceFile(file.filename).catch(() => {});
      throw new NotFoundError("Maintenance record not found");
    }

    if (previousInvoice?.storedName) {
      await deleteInvoiceFile(previousInvoice.storedName).catch((err) =>
        logger.warn(`Could not remove replaced invoice file ${previousInvoice.storedName}: ${err.message}`)
      );
    }

    return updated;
  },

  /** What a controller needs to stream the file back: where it is on disk, and its original name and type. */
  async getInvoiceFile(maintenanceId) {
    const record = await generatorMaintenanceRepository.findById(maintenanceId);
    if (!record) throw new NotFoundError("Maintenance record not found");
    if (!record.invoice?.storedName) throw new NotFoundError("This maintenance record has no invoice attached");

    return { filePath: invoiceFilePath(record.invoice.storedName), fileName: record.invoice.fileName, mimeType: record.invoice.mimeType };
  },

  /**
   * Detaches the invoice — the maintenance job itself is untouched. The
   * database is updated first (it is the source of truth for whether an
   * invoice exists); the file is only deleted once that has succeeded, so a
   * failed deletion just leaves a harmless orphaned file, never a record
   * pointing at a file that is already gone.
   */
  async removeInvoice(maintenanceId) {
    const record = await generatorMaintenanceRepository.findById(maintenanceId);
    if (!record) throw new NotFoundError("Maintenance record not found");
    if (!record.invoice?.storedName) throw new NotFoundError("This maintenance record has no invoice attached");

    const updated = await generatorMaintenanceRepository.updateById(maintenanceId, { $unset: { invoice: 1 } });
    await deleteInvoiceFile(record.invoice.storedName).catch((err) =>
      logger.warn(`Could not remove invoice file ${record.invoice.storedName}: ${err.message}`)
    );
    return updated;
  },
};
