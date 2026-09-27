import { reportService } from "../services/reportService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const reportController = {
  runningHours: asyncHandler(async (req, res) => {
    const report = await reportService.getRunningHoursReport({ generatorId: req.query.generatorId, month: req.query.month });
    sendSuccess(res, { data: report });
  }),

  dieselConsumption: asyncHandler(async (req, res) => {
    const { generatorId, from, to } = req.query;
    const report = await reportService.getDieselConsumptionReport({ generatorId, from, to });
    sendSuccess(res, { data: report });
  }),
};
