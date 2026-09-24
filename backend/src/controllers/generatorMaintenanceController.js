import { generatorMaintenanceRepository } from "../repositories/generatorMaintenanceRepository.js";
import { generatorService, withAlertInfo } from "../services/generatorService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError } from "../errors/AppError.js";

// Fields are picked explicitly (never spread from req.body) so a client can't
// set createdBy, completedDate on a new job, or anything else the service owns.
export const generatorMaintenanceController = {
  list: asyncHandler(async (req, res) => {
    const { generatorId, status, page, pageSize } = req.query;
    const { items, ...meta } = await generatorMaintenanceRepository.list({
      generatorId,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    const now = new Date();
    sendSuccess(res, { data: items.map((item) => withAlertInfo(item, now)), meta });
  }),

  alerts: asyncHandler(async (req, res) => {
    const withinDays = req.query.withinDays === undefined ? undefined : Number(req.query.withinDays);
    const alerts = await generatorService.getMaintenanceAlerts({ withinDays });
    sendSuccess(res, { data: alerts });
  }),

  create: asyncHandler(async (req, res) => {
    const { generatorId, type, description, scheduledDate, intervalDays, alertThresholdDays, performedBy, cost, partsReplaced, notes } = req.body;
    const maintenance = await generatorService.scheduleMaintenance({
      generatorId,
      createdBy: req.userId,
      type,
      description,
      scheduledDate,
      intervalDays,
      alertThresholdDays,
      performedBy,
      cost,
      partsReplaced,
      notes,
    });
    sendSuccess(res, { statusCode: 201, message: "Maintenance scheduled", data: maintenance });
  }),

  // One endpoint, three intents: complete (status "completed"), cancel
  // (status "cancelled"), or edit. The validator keeps them from being mixed.
  update: asyncHandler(async (req, res) => {
    const { status, completedDate, type, description, scheduledDate, intervalDays, alertThresholdDays, performedBy, cost, partsReplaced, notes } = req.body;

    if (status === "completed") {
      const result = await generatorService.completeMaintenance(req.params.id, { completedDate, performedBy, cost, partsReplaced, notes });
      return sendSuccess(res, { message: "Maintenance completed", data: result });
    }

    const maintenance = await generatorService.updateMaintenance(req.params.id, {
      status,
      type,
      description,
      scheduledDate,
      intervalDays,
      alertThresholdDays,
      performedBy,
      cost,
      partsReplaced,
      notes,
    });
    sendSuccess(res, { message: status === "cancelled" ? "Maintenance cancelled" : "Maintenance updated", data: maintenance });
  }),

  // Permanently removes a record (a mistaken entry). To keep a job as history
  // without doing it, cancel it instead. Deleting a completed job does not
  // roll back the generator's lastServiceDate.
  remove: asyncHandler(async (req, res) => {
    const removed = await generatorMaintenanceRepository.deleteById(req.params.id);
    if (!removed) throw new NotFoundError("Maintenance record not found");
    sendSuccess(res, { message: "Maintenance record deleted", data: removed });
  }),
};
