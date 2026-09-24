import { leaveService } from "../services/leaveService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const leaveController = {
  list: asyncHandler(async (req, res) => {
    const { userId, status, leaveType, startDate, endDate, page, pageSize } = req.query;
    const { items, pagination } = await leaveService.list({
      requesterId: req.userId,
      // Anyone who can decide leave needs to see everyone's requests.
      canViewAll: req.permissions.includes("leave.approve") || req.permissions.includes("leave.reject"),
      userId,
      status,
      leaveType,
      startDate,
      endDate,
      page,
      pageSize,
    });
    sendSuccess(res, {
      message: "Leave requests",
      data: { leave: items },
      meta: pagination,
    });
  }),

  create: asyncHandler(async (req, res) => {
    // Whitelist: status, user, totalDays and review fields are never taken from the client.
    const { leaveType, startDate, endDate, reason } = req.body;
    const leave = await leaveService.create(req.userId, { leaveType, startDate, endDate, reason });
    sendSuccess(res, {
      statusCode: 201,
      message: "Leave request submitted",
      data: { leave },
    });
  }),

  review: asyncHandler(async (req, res) => {
    const { decision, note } = req.body;
    const leave = await leaveService.review(req.params.id, {
      reviewerId: req.userId,
      decision,
      note,
    });
    sendSuccess(res, {
      message: `Leave request ${leave.status}`,
      data: { leave },
    });
  }),
};
