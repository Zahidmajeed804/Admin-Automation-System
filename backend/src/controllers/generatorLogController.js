import { generatorLogRepository } from "../repositories/generatorLogRepository.js";
import { generatorService } from "../services/generatorService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const generatorLogController = {
  list: asyncHandler(async (req, res) => {
    const { generatorId, from, to, page, pageSize } = req.query;
    const { items, ...meta } = await generatorLogRepository.list({
      generatorId,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    sendSuccess(res, { data: items, meta });
  }),

  // Fields are picked explicitly (not spread from req.body) so a client
  // can't set recordedBy, generator, or anything else the service owns.
  create: asyncHandler(async (req, res) => {
    const {
      generatorId, date, hoursRun, meterReadingHours,
      fuelAddedLiters, fuelConsumedLiters, openingFuelLiters, closingFuelLiters,
      fuelCostPerLiter, fuelCostTotal, fuelVendor, reason, notes,
    } = req.body;
    const result = await generatorService.recordLog({
      generatorId,
      recordedBy: req.userId,
      date,
      hoursRun,
      meterReadingHours,
      fuelAddedLiters,
      fuelConsumedLiters,
      openingFuelLiters,
      closingFuelLiters,
      fuelCostPerLiter,
      fuelCostTotal,
      fuelVendor,
      reason,
      notes,
    });
    sendSuccess(res, { statusCode: 201, message: "Log recorded", data: result });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await generatorService.removeLog(req.params.logId);
    sendSuccess(res, { message: "Log deleted", data: result });
  }),
};
