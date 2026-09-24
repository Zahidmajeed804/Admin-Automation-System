import { overtimeService } from "../services/overtimeService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const overtimeController = {
  list: asyncHandler(async (req, res) => {
    const { userId, status, startDate, endDate, page, pageSize } = req.query;
    const { items, pagination } = await overtimeService.list({
      requesterId: req.userId,
      canViewAll: req.permissions.includes("overtime.approve"),
      userId,
      status,
      startDate,
      endDate,
      page,
      pageSize,
    });
    sendSuccess(res, {
      message: "Overtime requests",
      data: { overtime: items },
      meta: pagination,
    });
  }),

  review: asyncHandler(async (req, res) => {
    const { decision, note } = req.body;
    const overtime = await overtimeService.review(req.params.id, {
      reviewerId: req.userId,
      decision,
      note,
    });
    sendSuccess(res, {
      message: `Overtime request ${overtime.status}`,
      data: { overtime },
    });
  }),
};
