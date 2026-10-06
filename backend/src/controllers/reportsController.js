import { reportsService } from "../services/reportsService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const reportsController = {
  attendanceSummary: asyncHandler(async (req, res) => {
    const { employeeId, from, to } = req.query;
    const report = await reportsService.getAttendanceSummaryReport({ employeeId, from, to });
    sendSuccess(res, { data: report });
  }),
};
