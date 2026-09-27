import { reportService } from "../services/reportService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const reportController = {
  runningHours: asyncHandler(async (req, res) => {
    const report = await reportService.getRunningHoursReport({ generatorId: req.query.generatorId, month: req.query.month });
    sendSuccess(res, { data: report });
  }),
};
